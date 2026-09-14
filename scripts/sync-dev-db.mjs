import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { parse } from "dotenv";

const root = fileURLToPath(new URL("../", import.meta.url));
const quote = name => `"${name.replaceAll('"', '""')}"`;
async function envFile(name) {
  try { return parse(await readFile(resolve(root, name))); }
  catch (error) { if (error.code === "ENOENT") return {}; throw error; }
}
function connect(env) {
  if (!env.TURSO_DATABASE_URL) throw new Error("Database URL is missing.");
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN ?? env.TURSO_DATABASE_TURSO_AUTH_TOKEN, intMode: "bigint" });
}
function encode(value) {
  if (typeof value === "bigint") return { bigint: String(value) };
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return { blob: Buffer.from(value instanceof ArrayBuffer ? new Uint8Array(value) : value).toString("base64") };
  return value;
}
const serialize = value => JSON.stringify(value, (_key, item) => encode(item));
const checksum = rows => createHash("sha256").update(rows.map(serialize).sort().join("\n")).digest("hex");

async function tableRows(tx, table) {
  const rows = [];
  const pageSize = table.columns.some(column => /base64|files_json/.test(column)) ? 5 : 200;
  for (let offset = 0; ; offset += pageSize) {
    const result = await tx.execute(`SELECT ${table.columns.map(quote).join(", ")} FROM ${quote(table.name)} LIMIT ${pageSize} OFFSET ${offset}`);
    rows.push(...result.rows.map(row => table.columns.map(column => row[column])));
    if (result.rows.length < pageSize) break;
  }
  return rows;
}
async function snapshot(client, label) {
  const tx = await client.transaction("read");
  try {
    const schema = (await tx.execute("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type, name")).rows.map(row => ({ type: row.type, name: row.name, table: row.tbl_name, sql: row.sql }));
    const tables = [];
    for (const item of schema.filter(item => item.type === "table")) {
      const columns = (await tx.execute(`PRAGMA table_xinfo(${quote(item.name)})`)).rows.filter(row => Number(row.hidden) === 0).map(row => row.name);
      const table = { name: item.name, columns };
      table.rows = await tableRows(tx, table);
      table.checksum = checksum(table.rows);
      tables.push(table);
      console.log(`${label}: ${table.name} (${table.rows.length} rows)`);
    }
    const hasSequence = (await tx.execute("SELECT name FROM sqlite_master WHERE name='sqlite_sequence'")).rows.length;
    const sequences = hasSequence ? (await tx.execute("SELECT name, seq FROM sqlite_sequence")).rows.map(row => [row.name, row.seq]) : [];
    await tx.commit();
    return { capturedAt: new Date().toISOString(), schema, tables, sequences };
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

async function replaceDevelopment(client, source) {
  const tx = await client.transaction("write");
  try {
    await tx.execute("PRAGMA defer_foreign_keys = ON");
    const existing = (await tx.execute("SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND type IN ('trigger', 'view', 'table') ORDER BY CASE type WHEN 'trigger' THEN 0 WHEN 'view' THEN 1 ELSE 2 END")).rows;
    for (const item of existing) await tx.execute(`DROP ${item.type.toUpperCase()} IF EXISTS ${quote(item.name)}`);
    for (const item of source.schema.filter(item => item.type === "table")) await tx.execute(item.sql);
    for (const table of source.tables) {
      const sql = `INSERT INTO ${quote(table.name)} (${table.columns.map(quote).join(", ")}) VALUES (${table.columns.map(() => "?").join(", ")})`;
      let batch = [];
      let bytes = 0;
      for (const row of table.rows) {
        const rowBytes = Buffer.byteLength(serialize(row)) + Buffer.byteLength(sql);
        if (batch.length && (bytes + rowBytes > 1_000_000 || batch.length >= 100)) {
          await tx.batch(batch);
          batch = []; bytes = 0;
        }
        batch.push({ sql, args: row.map(value => value instanceof ArrayBuffer ? new Uint8Array(value) : value) });
        bytes += rowBytes;
      }
      if (batch.length) await tx.batch(batch);
      console.log(`Restored: ${table.name} (${table.rows.length} rows)`);
    }
    // Create triggers after inserts so a restore does not generate extra data.
    for (const type of ["index", "view", "trigger"]) for (const item of source.schema.filter(item => item.type === type)) await tx.execute(item.sql);
    if (source.sequences.length) {
      await tx.execute("DELETE FROM sqlite_sequence");
      for (const row of source.sequences) await tx.execute({ sql: "INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)", args: row });
    }
    for (const table of source.tables) {
      if (checksum(await tableRows(tx, table)) !== table.checksum) throw new Error(`Verification failed: ${table.name}. Rolling back.`);
    }
    const restoredSchema = (await tx.execute("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type, name")).rows.map(row => ({ type: row.type, name: row.name, table: row.tbl_name, sql: row.sql }));
    if (serialize(restoredSchema) !== serialize(source.schema)) throw new Error("Schema verification failed. Rolling back.");
    const foreignKeys = await tx.execute("PRAGMA foreign_key_check");
    if (foreignKeys.rows.length) throw new Error("Foreign key verification failed. Rolling back.");
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

const base = { ...await envFile(".env"), ...await envFile(".env.local") };
const dev = { ...base, ...await envFile(".env.development.local") };
const prod = { ...base, ...await envFile(".env.production.local") };
if (!dev.TURSO_DATABASE_URL || !prod.TURSO_DATABASE_URL) throw new Error("Configure development and production database URLs before syncing.");
const identity = value => value.trim().replace(/\/+$/, "").toLowerCase();
if (identity(dev.TURSO_DATABASE_URL) === identity(prod.TURSO_DATABASE_URL)) throw new Error("Refusing to sync: development points to production.");
const production = connect(prod);
const development = connect(dev);
try {
  const source = await snapshot(production, "Production snapshot");
  const backup = await snapshot(development, "Development backup");
  const directory = resolve(root, "backups", "dev-db");
  await mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const backupPath = resolve(directory, `${stamp}-before-sync.json`);
  await writeFile(backupPath, serialize(backup), { flag: "wx" });
  await writeFile(resolve(directory, `${stamp}-production-snapshot.json`), serialize(source), { flag: "wx" });
  console.log(`Development backup saved: ${backupPath}`);
  await replaceDevelopment(development, source);
  console.log(`Development database synchronized and verified: ${source.tables.length} tables. Production was read only.`);
} finally {
  production.close();
  development.close();
}
