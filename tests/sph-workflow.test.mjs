import { getInvoiceOmset, calculateOmsetBonus } from "../app/employee/bonus.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.ts";
import { approveSphPrice, confirmSphPo } from "../app/sph/workflow-actions.ts";
import { isInvoiceEligibleSph, monthlyOutstandingAmount } from "../app/sph/workflow.ts";
import { isMigratableSphStatus } from "../app/sph/list/migration.ts";
import { previewSphPo, applySphPo, applySphPoOnce, captureSphPo } from "../scripts/migrate-sph-po.mjs";

async function fixture(t) {
  const prefix = join(tmpdir(), "mpm-sph-workflow-");
  const directory = await mkdtemp(prefix);
  const client = createClient({ url: pathToFileURL(join(directory, "test.db")).href });
  const transactions = [];
  const transaction = client.transaction.bind(client);
  client.transaction = async (...args) => {
    const tx = await transaction(...args);
    transactions.push(tx);
    return tx;
  };
  t.after(async () => {
    for (const tx of transactions) tx.close();
    client.close();
    if (!directory.startsWith(prefix)) throw new Error("Unexpected cleanup path");
    // Windows may retain SQLite native handles until the test process exits.
    try { await rm(directory, { recursive: true, force: true }); }
    catch (error) { if (error.code !== "EBUSY") throw error; }
  });
  const snapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0038_snapshot.json", import.meta.url), "utf8"));
  for (const name of ["sph_documents", "sph_items", "invoice_documents", "invoice_items", "invoice_logs", "shipment_journeys", "shipments"]) {
    const table = snapshot.tables[name];
    const columns = Object.values(table.columns).map(c => `"${c.name}" ${c.type}${c.primaryKey ? " PRIMARY KEY" : ""}${c.notNull ? " NOT NULL" : ""}${c.default === undefined ? "" : " DEFAULT " + c.default}`);
    await client.execute(`CREATE TABLE "${name}" (${columns.join(",")})`);
    for (const index of Object.values(table.indexes)) await client.execute(`CREATE ${index.isUnique ? "UNIQUE " : ""}INDEX "${index.name}" ON "${name}" (${index.columns.map(c => '"' + c + '"').join(",")})`);
  }
  await client.executeMultiple(await readFile(new URL("../drizzle/0039_sph_status_history.sql", import.meta.url), "utf8"));
  const db = drizzle(client, { schema });
  const seed = async (id, status = "cek_harga", withItem = true) => {
    await db.insert(schema.sphDocuments).values({ id, sphNo: "SPH" + id, yy: "26", mm: "09", sequence: 1, customerCode: "ABC", customerName: "Customer", sphDate: "2026-09-15", totalAmount: 1000, status });
    if (withItem) await db.insert(schema.sphItems).values({ id: "item-" + id, sphId: id, lineNo: 1, partName: "Part", quantity: 1, unitPrice: 1000, totalPrice: 1000 });
  };
  const status = async id => (await db.select({ status: schema.sphDocuments.status }).from(schema.sphDocuments).where(eq(schema.sphDocuments.id, id)))[0].status;
  return { client, db, seed, status, directory };
}

test("price approval waits for PO; PO creates a single invoice and repeated clicks preserve it", async t => {
  const { client, db, seed, status } = await fixture(t);
  await seed("one");
  await assert.rejects(confirmSphPo(db, "one"), /Menunggu PO/);
  await approveSphPrice(db, "one");
  assert.equal(await status("one"), "menunggu_po_konfirmasi");
  assert.equal((await db.select().from(schema.invoiceDocuments)).length, 0);
  assert.equal(await approveSphPrice(db, "one"), null);
  await confirmSphPo(db, "one");
  assert.equal(await status("one"), "menunggu_pengiriman");
  const [invoice] = await db.select().from(schema.invoiceDocuments);
  assert.equal(invoice.invoiceNo, "INVone");
  assert.equal((await db.select().from(schema.invoiceItems)).length, 1);
  await db.update(schema.invoiceDocuments).set({ paidAmount: 500 }).where(eq(schema.invoiceDocuments.id, invoice.id));
  assert.equal(await confirmSphPo(db, "one"), null);
  assert.equal((await db.select().from(schema.invoiceDocuments)).length, 1);
  assert.equal((await db.select().from(schema.invoiceDocuments))[0].paidAmount, 500);
  const history = (await client.execute("SELECT * FROM sph_status_history WHERE from_status='menunggu_po_konfirmasi' AND to_status='menunggu_pengiriman'")).rows;
  assert.equal(history.length, 1);
  assert.equal(history[0].sph_id, "one");
});

test("reactivating a retained invoice syncs sales data while preserving payment data", async t => {
  const { db, seed } = await fixture(t);
  await seed("old", "menunggu_po_konfirmasi");
  await confirmSphPo(db, "old");
  await db.update(schema.invoiceDocuments).set({ paidAmount: 1000, status: "done", poNo: "PO-42", feeAmount: 50, paymentProofFilesJson: [{ name: "proof", base64: "abc" }] });
  await db.update(schema.sphDocuments).set({ status: "menunggu_po_konfirmasi", totalAmount: 2000, amountInWords: "Dua ribu rupiah" });
  await db.update(schema.sphItems).set({ quantity: 2, totalPrice: 2000 });
  await confirmSphPo(db, "old");
  const [invoice] = await db.select().from(schema.invoiceDocuments);
  assert.equal(invoice.totalAmount, 2000);
  assert.equal(invoice.amountInWords, "Dua ribu rupiah");
  assert.equal(invoice.paidAmount, 1000);
  assert.equal(invoice.status, "pending");
  assert.equal(invoice.poNo, "PO-42");
  assert.equal(invoice.feeAmount, 50);
  assert.deepEqual(invoice.paymentProofFilesJson, [{ name: "proof", base64: "abc" }]);
  const [item] = await db.select().from(schema.invoiceItems);
  assert.equal(item.quantity, 2);
  assert.equal(item.totalPrice, 2000);
});

test("invalid states and missing items cannot be approved", async t => {
  const { db, seed, status } = await fixture(t);
  for (const state of ["cancel", "proses_pengiriman", "selesai"]) {
    await seed(state, state);
    await assert.rejects(approveSphPrice(db, state));
    await assert.rejects(confirmSphPo(db, state));
    assert.equal(await status(state), state);
  }
  await seed("empty", "menunggu_po_konfirmasi", false);
  await assert.rejects(confirmSphPo(db, "empty"), /memiliki item/);
});

test("invoice failure rolls back invoice insertion and status transition", async t => {
  const { client, db, seed, status } = await fixture(t);
  await seed("fail", "menunggu_po_konfirmasi");
  await client.execute("CREATE TRIGGER fail_item BEFORE INSERT ON invoice_items BEGIN SELECT RAISE(ABORT, 'forced failure'); END");
  await assert.rejects(confirmSphPo(db, "fail"));
  assert.equal(await status("fail"), "menunggu_po_konfirmasi");
  assert.equal((await db.select().from(schema.invoiceDocuments)).length, 0);
});

test("waiting PO is excluded even with retained invoice; confirmed unpaid invoices use remaining balance", () => {
  const sphs = [
    { id: "waiting", status: "menunggu_po_konfirmasi", sphDate: "2026-09-01", totalAmount: 10000 },
    { id: "active", status: "menunggu_pengiriman", sphDate: "2026-09-01", totalAmount: 1000 },
    { id: "draft", status: "cek_harga", sphDate: "2026-09-01", totalAmount: 9000 },
  ];
  const invoices = [
    { sphId: "waiting", status: "pending", invoiceDate: "2026-09-01", totalAmount: 10000, paidAmount: 0 },
    { sphId: "active", status: "pending", invoiceDate: "2026-09-01", totalAmount: 1000, paidAmount: 300 },
  ];
  assert.equal(monthlyOutstandingAmount(sphs, invoices, "2026-09"), 700);
  assert.equal(monthlyOutstandingAmount(sphs, invoices, "2026-08"), 0);
  assert.equal(monthlyOutstandingAmount(sphs, [], "2026-09"), 1000);
  assert.equal(isInvoiceEligibleSph("menunggu_po_konfirmasi"), false);
  assert.equal(isInvoiceEligibleSph("invoiced"), true);
  assert.equal(isMigratableSphStatus("menunggu_po_konfirmasi"), true);
});

test("mass migration preserves invoices, payments and shipping data, and ignores later SPH", async t => {
  const { client, db, seed, status } = await fixture(t);
  await seed("target", "menunggu_po_konfirmasi");
  await confirmSphPo(db, "target");
  await db.update(schema.invoiceDocuments).set({ paidAmount: 400, poNo: "OLD-PO" });
  await db.insert(schema.shipments).values({ id: "shipment", shipmentNo: "TTB001", shipmentDate: "2026-09-15" });
  await db.insert(schema.shipmentJourneys).values({ id: "journey", sphItemId: "item-target", shipmentId: "shipment", quantity: 1 });
  await seed("done", "selesai");
  await seed("process", "proses_pengiriman");
  const baseline = await previewSphPo(client);
  assert.deepEqual(baseline.sph_documents.map(row => row.id), ["target"]);
  await seed("later", "menunggu_pengiriman");
  assert.equal((await applySphPo(client, baseline)).count, 1);
  assert.equal(await status("target"), "menunggu_po_konfirmasi");
  assert.equal(await status("later"), "menunggu_pengiriman");
  assert.equal(await status("done"), "selesai");
  assert.equal(await status("process"), "proses_pengiriman");
  const after = await captureSphPo(client, ["target"]);
  for (const table of Object.keys(baseline).filter(table => table !== "sph_documents")) assert.deepEqual(after[table], baseline[table]);
  assert.equal((await applySphPo(client, baseline)).alreadyApplied, true);
});

test("mass migration rejects stale preview without changing status", async t => {
  const { client, db, seed, status } = await fixture(t);
  await seed("stale", "menunggu_pengiriman");
  const baseline = await previewSphPo(client);
  await db.update(schema.sphDocuments).set({ status: "proses_pengiriman" });
  await assert.rejects(applySphPo(client, baseline), /changed since preview/);
  assert.equal(await status("stale"), "proses_pengiriman");
});

test("saved applied marker prevents moving a reconfirmed SPH on rerun", async t => {
  const { client, db, seed, status, directory } = await fixture(t);
  await seed("once", "menunggu_pengiriman");
  const baseline = await previewSphPo(client);
  const marker = join(directory, "migration.applied.json");
  await applySphPoOnce(client, baseline, marker, "fixture-checksum");
  await confirmSphPo(db, "once");
  assert.equal((await applySphPoOnce(client, baseline, marker, "fixture-checksum")).skipped, true);
  assert.equal(await status("once"), "menunggu_pengiriman");
});

test("payroll turnover excludes hidden, cancelled and orphan invoices and uses previous invoice month", async t => {
  const { db, seed } = await fixture(t);
  for (const id of ["active-payroll", "waiting-payroll", "cancelled-payroll", "draft-payroll", "outside-payroll"]) {
    await seed(id, "menunggu_po_konfirmasi");
    await confirmSphPo(db, id);
  }
  await db.update(schema.sphDocuments).set({ status: "menunggu_po_konfirmasi" }).where(eq(schema.sphDocuments.id, "waiting-payroll"));
  await db.update(schema.sphDocuments).set({ status: "cek_harga" }).where(eq(schema.sphDocuments.id, "draft-payroll"));
  await db.update(schema.invoiceDocuments).set({ status: "cancelled" }).where(eq(schema.invoiceDocuments.sphId, "cancelled-payroll"));
  await db.update(schema.invoiceDocuments).set({ invoiceDate: "2026-08-31" }).where(eq(schema.invoiceDocuments.sphId, "outside-payroll"));
  await db.insert(schema.invoiceDocuments).values({ id: "orphan", sphId: "missing-sph", invoiceNo: "INV-orphan", customerName: "Orphan", invoiceDate: "2026-09-15", totalAmount: 99999 });
  assert.equal(await getInvoiceOmset(db, "2026-10"), 1000);
  assert.equal(await getInvoiceOmset(db, "2026-09"), 1000);
  await db.update(schema.invoiceDocuments).set({ paidAmount: 1000, status: "done" }).where(eq(schema.invoiceDocuments.sphId, "active-payroll"));
  assert.equal(await getInvoiceOmset(db, "2026-10"), 1000);
  await confirmSphPo(db, "waiting-payroll");
  assert.equal(await getInvoiceOmset(db, "2026-10"), 2000);
});

test("bonus keeps one percent divided by four, rounded and capped at one million", () => {
  assert.equal(calculateOmsetBonus(0), 0);
  assert.equal(calculateOmsetBonus(170497000), 426243);
  assert.equal(calculateOmsetBonus(149302000), 373255);
  assert.equal(calculateOmsetBonus(400000000), 1000000);
  assert.equal(calculateOmsetBonus(900000000), 1000000);
});
