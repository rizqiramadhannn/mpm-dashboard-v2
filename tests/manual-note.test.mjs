import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import * as schema from "../db/schema.ts";
import { createManualNote, listManualNotes } from "../app/supplier/nota-manual/storage.ts";
import { manualNoteNumber, validateManualNote } from "../app/supplier/nota-manual/model.ts";
import { generateManualNotePdf } from "../app/supplier/nota-manual/pdf.ts";

const actor = { id: "user-1", username: "tester", ipAddress: "127.0.0.1" };
const payload = (overrides = {}) => ({ noteDate: "2026-09-12", supplierId: "supplier-1", idempotencyKey: crypto.randomUUID(), items: [{ description: "POMPA STEERING", quantity: 2, unitPrice: 2000000 }], ...overrides });

async function fixture(run) {
  const dir = await mkdtemp(join(tmpdir(), "mpm-manual-test-"));
  const url = `file:${join(dir, "notes.db").replaceAll("\\", "/")}`;
  const clients = [createClient({ url }), createClient({ url })];
  try {
    const client = clients[0];
    await client.execute("PRAGMA journal_mode = WAL");
    await client.execute("PRAGMA foreign_keys = ON");
    const dialect = new SQLiteSyncDialect();
    // Build the pre-migration shape from current columns, then apply the real
    // migration. Defaults match the actual Drizzle schema used by inserts.
    const newColumns = new Set(["note_source", "manual_idempotency_key", "manual_payload_hash"]);
    for (const table of [schema.suppliers, schema.appUsers, schema.supplierNotes, schema.supplierNoteItems, schema.appAdminAuditLogs]) {
      const config = getTableConfig(table);
      const columns = config.columns.filter(column => !newColumns.has(column.name)).map(column => {
        let value = `"${column.name}" ${column.getSQLType()}${column.primary ? " PRIMARY KEY" : ""}${column.notNull ? " NOT NULL" : ""}`;
        if (column.default !== undefined) {
          const def = column.default;
          value += ` DEFAULT ${typeof def === "string" ? `'${def.replaceAll("'", "''")}'` : typeof def === "number" || typeof def === "boolean" ? Number(def) : dialect.sqlToQuery(def).sql}`;
        }
        return value;
      });
      await client.execute(`CREATE TABLE "${config.name}" (${columns.join(", ")})`);
    }
    await client.execute("CREATE UNIQUE INDEX supplier_notes_supplier_note_no_idx ON supplier_notes(supplier_id, note_no)");
    const migration = await readFile(new URL("../drizzle/0038_supplier_manual_notes.sql", import.meta.url), "utf8");
    await client.executeMultiple(migration.replaceAll("--> statement-breakpoint", ""));
    const dbs = clients.map(client => drizzle(client, { schema }));
    await dbs[0].insert(schema.suppliers).values([{ id: "supplier-1", name: "GIBRIL", normalizedName: "GIBRIL" }, { id: "supplier-2", name: "ALI IMRAN", normalizedName: "ALI IMRAN" }]);
    await dbs[0].insert(schema.appUsers).values({ id: actor.id, username: actor.username, passwordHash: "not-a-password", role: "user" });
    await run(dbs, client);
  } finally {
    clients.forEach(client => client.close());
    await rm(dir, { recursive: true, force: true, maxRetries: 2, retryDelay: 20 }).catch(error => {
      // Native libsql can retain Windows file handles until process exit.
      if (error.code !== "EBUSY") throw error;
    });
  }
}

test("strict validation and server-calculated amounts", () => {
  const data = validateManualNote(payload({ amount: 1, items: [{ description: " A ", quantity: 1.5, unitPrice: 101, totalPrice: 1 }] }));
  assert.equal(data.amount, 152); assert.equal(data.items[0].description, "A");
  for (const noteDate of ["2026-02-30", "2026-13-01", "invalid", "0000-01-01"]) assert.throws(() => validateManualNote(payload({ noteDate })));
  for (const items of [[], [{ description: "", quantity: 1, unitPrice: 10 }], [{ description: "A", quantity: 0, unitPrice: 10 }], [{ description: "A", quantity: NaN, unitPrice: 10 }], [{ description: "A", quantity: 1, unitPrice: -1 }], [{ description: "A", quantity: 1, unitPrice: 1.5 }], [{ description: "A", quantity: 1e6, unitPrice: Number.MAX_SAFE_INTEGER }]]) assert.throws(() => validateManualNote(payload({ items })));
  assert.equal(manualNoteNumber("2026-09-12", 2), "NM20260912002");
  assert.equal(manualNoteNumber("2026-09-12", 1000), "NM202609121000");
});

test("atomic creation, cross-supplier daily sequence, backdating, history and PDF", () => fixture(async ([db], client) => {
  const first = await createManualNote(db, payload(), actor);
  const second = await createManualNote(db, payload({ supplierId: "supplier-2" }), actor);
  const yesterday = await createManualNote(db, payload({ noteDate: "2026-09-11" }), actor);
  assert.equal(first.noteNo, "NM20260912001"); assert.equal(second.noteNo, "NM20260912002"); assert.equal(yesterday.noteNo, "NM20260911001");
  const row = (await client.execute("SELECT * FROM supplier_notes WHERE note_no = 'NM20260912001'")).rows[0];
  assert.equal(row.payment_status, "BELUM BAYAR"); assert.equal(row.paid_amount, 0); assert.equal(row.remaining_payment, 4000000);
  assert.equal(row.invoice_file_mime_type, "application/pdf"); assert.equal(row.invoice_file_name, `${first.noteNo}.pdf`);
  assert.match(Buffer.from(row.invoice_file_base64, "base64").toString("latin1"), /^%PDF-1.4/);
  assert.equal((await listManualNotes(db)).length, 3);
  assert.equal((await client.execute("SELECT count(*) AS n FROM app_admin_audit_logs")).rows[0].n, 3);
}));

test("idempotent retry does not consume number; payload conflicts rejected", () => fixture(async ([db], client) => {
  const input = payload();
  const first = await createManualNote(db, input, actor);
  const retry = await createManualNote(db, input, actor);
  assert.equal(first.id, retry.id); assert.equal(retry.reused, true);
  await assert.rejects(createManualNote(db, { ...input, supplierId: "supplier-2" }, actor), /data berbeda/);
  assert.equal((await client.execute("SELECT last_sequence FROM manual_note_counters")).rows[0].last_sequence, 1);
  assert.equal((await listManualNotes(db)).length, 1);
}));

test("concurrent requests and concurrent identical retries", () => fixture(async ([a, b]) => {
  const same = payload();
  const results = await Promise.all([createManualNote(a, same, actor), createManualNote(b, same, actor)]);
  assert.equal(results[0].id, results[1].id);
  const next = await Promise.all([createManualNote(a, payload(), actor), createManualNote(b, payload({ supplierId: "supplier-2" }), actor)]);
  assert.deepEqual(next.map(note => note.noteNo).sort(), ["NM20260912002", "NM20260912003"]);
}));

test("PDF, missing supplier and item/audit DB failures roll back everything", () => fixture(async ([db], client) => {
  await assert.rejects(createManualNote(db, payload(), actor, () => { throw new Error("PDF failed"); }), /PDF failed/);
  await assert.rejects(createManualNote(db, payload({ supplierId: "missing" }), actor), /Supplier tidak ditemukan/);
  await client.execute("CREATE TRIGGER fail_items BEFORE INSERT ON supplier_note_items BEGIN SELECT RAISE(ABORT, 'items failed'); END");
  await assert.rejects(createManualNote(db, payload(), actor), error => /items failed/.test(error.cause?.message));
  await client.execute("DROP TRIGGER fail_items");
  await client.execute("CREATE TRIGGER fail_audit BEFORE INSERT ON app_admin_audit_logs BEGIN SELECT RAISE(ABORT, 'audit failed'); END");
  await assert.rejects(createManualNote(db, payload(), actor), error => /audit failed/.test(error.cause?.message));
  assert.equal((await listManualNotes(db)).length, 0);
  assert.equal((await client.execute("SELECT count(*) AS n FROM manual_note_counters")).rows[0].n, 0);
  assert.equal((await client.execute("SELECT count(*) AS n FROM supplier_note_items")).rows[0].n, 0);
}));

test("PDF wraps long unbroken descriptions and paginates without lost items", () => {
  const items = Array.from({ length: 35 }, (_, i) => ({ description: `ITEM-${i} ${"W".repeat(600)}`, quantity: 2, unitPrice: 100, totalPrice: 200 }));
  const bytes = generateManualNotePdf({ noteNo: "NM20260912001", noteDate: "2026-09-12", supplierName: "SUPPLIER", items, amount: 7000 });
  const pdf = Buffer.from(bytes).toString("latin1");
  assert.ok(Number(pdf.match(/\/Count (\d+)/)?.[1]) > 1); assert.match(pdf, /ITEM-34/); assert.match(pdf, /Hormat Kami/);
  assert.equal((pdf.match(/Hormat Kami/g) ?? []).length, 1);
});
