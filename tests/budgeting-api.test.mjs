import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getTableConfig, SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import * as schema from "../db/schema.ts";
import { budgetingApiAuthorization, isBudgetingApiScope } from "../app/budgeting-api-auth.ts";

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
const { proxy } = await import("../proxy.ts");

let database;
let dbReads = 0;
mock.module("../db/index.ts", { namedExports: { getDb: async () => { dbReads++; return database; } } });
const { parseBudgetingQuery, agingFields, readBudgetingDocuments } = await import("../app/budgeting/query.ts");
const { GET: listInvoices } = await import("../app/api/budgeting/invoices/route.ts");
const { GET: detailInvoice } = await import("../app/api/budgeting/invoices/[id]/route.ts");
const { GET: listNotes } = await import("../app/api/budgeting/supplier-notes/route.ts");
const { GET: detailNote } = await import("../app/api/budgeting/supplier-notes/[id]/route.ts");

const token = "a".repeat(43);
const hash = createHash("sha256").update(token).digest("hex");
const req = (path, auth = `Bearer ${token}`, method = "GET") => new Request(`https://example.test/api/budgeting/${path}`, { method, headers: auth ? { Authorization: auth } : {} });
const query = value => parseBudgetingQuery(new URLSearchParams(`asOf=2026-10-04&${value}`));

test("budgeting auth fails closed and has an independent GET-only scope", async () => {
  const oldHash = process.env.BUDGETING_API_TOKEN_SHA256;
  const oldExpiry = process.env.BUDGETING_API_TOKEN_EXPIRES_AT;
  const oldSupplierHash = process.env.SUPPLIER_NOTES_API_TOKEN_SHA256;
  const oldSupplierExpiry = process.env.SUPPLIER_NOTES_API_TOKEN_EXPIRES_AT;
  try {
    process.env.BUDGETING_API_TOKEN_SHA256 = hash;
    process.env.BUDGETING_API_TOKEN_EXPIRES_AT = "2099-01-01T00:00:00Z";
    const writeToken = "b".repeat(43);
    process.env.SUPPLIER_NOTES_API_TOKEN_SHA256 = createHash("sha256").update(writeToken).digest("hex");
    process.env.SUPPLIER_NOTES_API_TOKEN_EXPIRES_AT = "2099-01-01T00:00:00Z";
    assert.equal(await budgetingApiAuthorization(req("invoices")), 200);
    const proxyRequest = request => ({ nextUrl: new URL(request.url), url: request.url, method: request.method, headers: request.headers, cookies: { get: () => ({ value: "existing-cookie" }) } });
    assert.equal((await proxy(proxyRequest(req("invoices")))).headers.get("x-middleware-next"), "1");
    assert.equal((await proxy(proxyRequest(req("invoices", null)))).status, 401);
    assert.equal((await proxy(proxyRequest(req("invoices", `Bearer ${writeToken}`)))).status, 401);
    assert.equal((await proxy(proxyRequest(req("invoices", undefined, "POST")))).status, 403);
    assert.equal((await proxy(proxyRequest(req("../invoices", undefined, "PATCH")))).status, 401);
    for (const path of ["invoices", "invoices/id", "supplier-notes", "supplier-notes/id"]) {
      assert.equal(isBudgetingApiScope(`/api/budgeting/${path}`, "GET"), true);
      for (const method of ["POST", "PATCH", "DELETE", "PUT", "HEAD", "OPTIONS"]) assert.equal(await budgetingApiAuthorization(req(path, undefined, method)), 403);
    }
    for (const path of ["invoices/id/extra", "supplier-notes/manual", "../invoices", "../supplier-notes"]) {
      // 'manual' is an ID on a read-only detail route, never a write endpoint.
      if (path === "supplier-notes/manual") continue;
      assert.equal(await budgetingApiAuthorization(req(path)), 403);
    }
    for (const auth of [null, "Basic abc", "Bearer short", `Bearer ${"b".repeat(43)}`]) assert.equal(await budgetingApiAuthorization(req("invoices", auth)), 401);
    dbReads = 0;
    assert.equal((await listInvoices(req("invoices", null))).status, 401);
    assert.equal(dbReads, 0);
    process.env.BUDGETING_API_TOKEN_EXPIRES_AT = "2000-01-01T00:00:00Z";
    assert.equal(await budgetingApiAuthorization(req("invoices")), 401);
    delete process.env.BUDGETING_API_TOKEN_SHA256;
    assert.equal(await budgetingApiAuthorization(req("invoices")), 401);
  } finally {
    if (oldHash === undefined) delete process.env.BUDGETING_API_TOKEN_SHA256; else process.env.BUDGETING_API_TOKEN_SHA256 = oldHash;
    if (oldExpiry === undefined) delete process.env.BUDGETING_API_TOKEN_EXPIRES_AT; else process.env.BUDGETING_API_TOKEN_EXPIRES_AT = oldExpiry;
    if (oldSupplierHash === undefined) delete process.env.SUPPLIER_NOTES_API_TOKEN_SHA256; else process.env.SUPPLIER_NOTES_API_TOKEN_SHA256 = oldSupplierHash;
    if (oldSupplierExpiry === undefined) delete process.env.SUPPLIER_NOTES_API_TOKEN_EXPIRES_AT; else process.env.SUPPLIER_NOTES_API_TOKEN_EXPIRES_AT = oldSupplierExpiry;
  }
});

test("filters reject invalid dates, ranges, enums, pagination and unknown parameters", () => {
  for (const value of ["dateFrom=2026-02-30", "dueTo=2026-13-01", "page=0", "page=-1", "pageSize=201", "page=1.1", "page=1&page=2", "asOf=", "token=secret", "dateFrom=2026-10-05&dateTo=2026-10-04", "dueFrom=2026-10-05&dueTo=2026-10-04", "paymentStatus=done", "dueStatus=bad"]) assert.throws(() => parseBudgetingQuery(new URLSearchParams(value)));
  assert.equal(parseBudgetingQuery(new URLSearchParams(), new Date("2026-10-03T18:00:00Z")).asOf, "2026-10-04");
  assert.equal(agingFields("2026-10-03", 70, "DP", "2026-10-04").daysPastDue, 1);
  assert.equal(agingFields(null, 70, "DP", "2026-10-04").dueStatus, "no_due_date");
  assert.equal(agingFields("2026-10-04", 70, "DP", "2026-10-04").isOnDue, true);
  assert.equal(agingFields("2026-10-01", 0, "LUNAS", "2026-10-04").isOverdue, false);
});

test("real SQL lists and details: boundaries, items, sums, pagination, private projection, read-only", async () => {
  const client = createClient({ url: ":memory:" });
  const previousHash = process.env.BUDGETING_API_TOKEN_SHA256;
  const previousExpiry = process.env.BUDGETING_API_TOKEN_EXPIRES_AT;
  try {
    const dialect = new SQLiteSyncDialect();
    for (const table of [schema.sphDocuments, schema.invoiceDocuments, schema.invoiceItems, schema.suppliers, schema.supplierNotes, schema.supplierNoteItems]) {
      const config = getTableConfig(table);
      const columns = config.columns.map(c => {
        let value = `"${c.name}" ${c.getSQLType()}${c.primary ? " PRIMARY KEY" : ""}${c.notNull ? " NOT NULL" : ""}`;
        if (c.default !== undefined) value += ` DEFAULT ${typeof c.default === "string" ? `'${c.default.replaceAll("'", "''")}'` : typeof c.default === "number" || typeof c.default === "boolean" ? Number(c.default) : dialect.sqlToQuery(c.default).sql}`;
        return value;
      });
      await client.execute(`CREATE TABLE "${config.name}" (${columns.join(", ")})`);
    }
    database = drizzle(client, { schema });
    await database.insert(schema.sphDocuments).values([
      { id: "s1", sphNo: "SPH1", yy: "26", mm: "10", sequence: 1, customerCode: "C1", customerId: "c1", customerName: "Customer", sphDate: "2026-10-01", status: "selesai" },
      { id: "s2", sphNo: "SPH2", yy: "26", mm: "10", sequence: 2, customerCode: "C2", customerName: "Excluded", sphDate: "2026-10-01", status: "cek_harga" },
      { id: "s3", sphNo: "SPH3", yy: "26", mm: "10", sequence: 3, customerCode: "C3", customerName: "Missing invoice", sphDate: "2026-10-01", status: "selesai" },
    ]);
    await database.insert(schema.invoiceDocuments).values([
      { id: "i1", invoiceNo: "INV1", sphId: "s1", invoiceDate: "2026-10-01", customerName: "Customer snapshot", totalAmount: 100, paidAmount: 30, paymentTerm: "TOP 2", status: "pending", ttdMateraiFileBase64: "PRIVATE" },
      { id: "i2", invoiceNo: "INV2", sphId: "s1", invoiceDate: "2026-10-01", paymentDueDate: "2026-10-04", customerName: "Customer", totalAmount: 200, status: "pending" },
      { id: "i3", invoiceNo: "INV3", sphId: "s1", invoiceDate: "2026-10-02", customerName: "Customer", totalAmount: 100, paidAmount: 120, status: "done" },
      { id: "i4", invoiceNo: "INV4", sphId: "s2", invoiceDate: "2026-10-01", customerName: "Excluded", totalAmount: 100 },
      { id: "i5", invoiceNo: "INV5", sphId: "s1", invoiceDate: "2026-09-01", customerName: "Cancelled", totalAmount: 100, status: "cancelled" },
    ]);
    await database.insert(schema.invoiceItems).values({ id: "item1", invoiceId: "i1", lineNo: 1, partName: "Part", quantity: 2, unitPrice: 50, totalPrice: 100 });
    await database.insert(schema.suppliers).values({ id: "sup1", name: "Supplier", normalizedName: "SUPPLIER", accountNumber: "PRIVATE" });
    await database.insert(schema.supplierNotes).values([
      { id: "n1", supplierId: "sup1", noteNo: "N1", noteDate: "2026-10-01", amount: 100, paidAmount: 30, remainingPayment: 999, paymentStatus: "DP", paymentDeadline: "2026-10-04", invoiceFileBase64: "PRIVATE" },
      { id: "n2", supplierId: "sup1", noteNo: "N2", noteDate: "2026-10-01", amount: 200 },
      { id: "n3", supplierId: "sup1", noteNo: "N3", noteDate: "2026-10-01", amount: 100, paymentStatus: "CANCELLED", paymentDeadline: "2026-10-01" },
    ]);
    await database.insert(schema.supplierNoteItems).values({ id: "ni1", supplierNoteId: "n1", lineNo: 1, description: "Part", quantity: 0.5, unitPrice: 200, totalPrice: 100, dueDate: "2026-10-03" });
    const snapshot = async () => Promise.all(["invoice_documents", "supplier_notes", "sph_documents"].map(table => client.execute(`SELECT * FROM ${table} ORDER BY id`)));
    const before = await snapshot();
    const overdue = await readBudgetingDocuments(database, "invoices", query("dueStatus=overdue&paymentStatus=DP&customerId=c1"));
    assert.equal(overdue.data.length, 1);
    assert.equal(overdue.data[0].remainingPayment, 70);
    assert.equal(overdue.data[0].dueDate, "2026-10-03");
    assert.equal(overdue.data[0].items[0].totalPrice, 100);
    const page = await readBudgetingDocuments(database, "invoices", query("pageSize=1&dateFrom=2026-10-01&dateTo=2026-10-01&dueFrom=2026-10-03&dueTo=2026-10-04"));
    assert.equal(page.pagination.total, 2);
    assert.equal(page.pagination.hasNextPage, true);
    assert.equal(page.data[0].id, "i1");
    assert.equal((await readBudgetingDocuments(database, "invoices", query("pageSize=1&page=2&dateFrom=2026-10-01&dateTo=2026-10-01"))).data[0].id, "i2");
    assert.equal((await readBudgetingDocuments(database, "invoices", query("dueStatus=on_due"))).data[0].id, "i2");
    assert.equal((await readBudgetingDocuments(database, "invoices", query("dueStatus=settled"))).data[0].remainingPayment, 0);
    assert.equal((await readBudgetingDocuments(database, "supplier-notes", query("dueStatus=no_due_date"))).data[0].id, "n2");
    const notes = await readBudgetingDocuments(database, "supplier-notes", query("supplierId=sup1&dueStatus=on_due"));
    assert.equal(notes.data[0].remainingPayment, 70);
    assert.equal(notes.data[0].storedRemainingPayment, 999);
    assert.equal(notes.data[0].items[0].quantity, 0.5);
    assert.equal((await readBudgetingDocuments(database, "supplier-notes", query("dueStatus=cancelled"))).data[0].remainingPayment, 0);
    assert.ok(!JSON.stringify([overdue, notes]).includes("PRIVATE"));
    assert.equal((await readBudgetingDocuments(database, "invoices", query("page=100"))).data.length, 0);
    await assert.rejects(readBudgetingDocuments(database, "invoices", query("supplierId=sup1")));
    process.env.BUDGETING_API_TOKEN_SHA256 = hash;
    process.env.BUDGETING_API_TOKEN_EXPIRES_AT = "2099-01-01T00:00:00Z";
    for (const [getter, path, id] of [[detailInvoice, "invoices", "i1"], [detailNote, "supplier-notes", "n1"]]) {
      const response = await getter(req(`${path}/${id}?asOf=2026-10-04`), { params: Promise.resolve({ id }) });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal((await response.json()).data.id, id);
      assert.equal((await getter(req(`${path}/missing`), { params: Promise.resolve({ id: "missing" }) })).status, 404);
      assert.equal((await getter(req(`${path}/${id}?page=1`), { params: Promise.resolve({ id }) })).status, 400);
    }
    assert.equal((await listNotes(req("supplier-notes?asOf=2026-10-04"))).status, 200);
    assert.equal((await listInvoices(req("invoices?pageSize=201"))).status, 400);
    assert.deepEqual(await snapshot(), before);
    database = undefined;
    const failed = await listInvoices(req("invoices"));
    assert.equal(failed.status, 500);
    assert.deepEqual(await failed.json(), { error: "Gagal membaca dokumen budgeting." });
  } finally {
    client.close();
    if (previousHash === undefined) delete process.env.BUDGETING_API_TOKEN_SHA256; else process.env.BUDGETING_API_TOKEN_SHA256 = previousHash;
    if (previousExpiry === undefined) delete process.env.BUDGETING_API_TOKEN_EXPIRES_AT; else process.env.BUDGETING_API_TOKEN_EXPIRES_AT = previousExpiry;
  }
});
