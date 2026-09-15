import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { parse } from "dotenv";

const root = fileURLToPath(new URL("../", import.meta.url));
const waitingStatuses = ["menunggu_pengiriman", "invoiced", "pending_invoice"];
const destination = "menunggu_po_konfirmasi";
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const canonical = rows => rows.map(row => JSON.stringify(Object.fromEntries(Object.entries(row).sort()))).sort();
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const identity = url => digest(url.trim().replace(/\/+$/, "").toLowerCase());

async function selected(tx, table, column, ids) {
  if (!ids.length) return [];
  return (await tx.execute({ sql: `SELECT * FROM ${table} WHERE ${column} IN (${ids.map(() => "?").join(",")})`, args: ids })).rows.map(row => ({ ...row }));
}

export async function captureSphPo(tx, ids) {
  const sph_documents = await selected(tx, "sph_documents", "id", ids);
  const sph_items = await selected(tx, "sph_items", "sph_id", ids);
  const invoice_documents = await selected(tx, "invoice_documents", "sph_id", ids);
  const invoiceIds = invoice_documents.map(row => row.id);
  const shipment_journeys = await selected(tx, "shipment_journeys", "sph_item_id", sph_items.map(row => row.id));
  return {
    sph_documents, sph_items, invoice_documents,
    invoice_items: await selected(tx, "invoice_items", "invoice_id", invoiceIds),
    invoice_logs: await selected(tx, "invoice_logs", "invoice_id", invoiceIds),
    shipment_journeys,
    shipments: await selected(tx, "shipments", "id", [...new Set(shipment_journeys.map(row => row.shipment_id).filter(Boolean))]),
  };
}

export async function previewSphPo(client) {
  const tx = await client.transaction("read");
  try {
    const rows = (await tx.execute({ sql: "SELECT id FROM sph_documents WHERE status IN (?, ?, ?) ORDER BY id", args: waitingStatuses })).rows;
    const data = await captureSphPo(tx, rows.map(row => row.id));
    await tx.commit();
    return data;
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

export async function applySphPo(client, baseline) {
  const ids = baseline.sph_documents.map(row => row.id);
  if (new Set(ids).size !== ids.length || baseline.sph_documents.some(row => !waitingStatuses.includes(row.status))) throw new Error("Invalid preview target list.");
  const tx = await client.transaction("write");
  try {
    const current = await captureSphPo(tx, ids);
    for (const [table, rows] of Object.entries(baseline)) {
      if (table !== "sph_documents" && !same(rows, current[table])) throw new Error(`Data changed since preview: ${table}. Create a new preview.`);
    }
    const allAlreadyMoved = current.sph_documents.length === ids.length && current.sph_documents.every(row => row.status === destination);
    const withoutStatus = rows => rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => !["status", "updated_at"].includes(key))));
    if (allAlreadyMoved) {
      if (!same(withoutStatus(baseline.sph_documents), withoutStatus(current.sph_documents))) throw new Error("SPH data changed since preview.");
    } else {
      if (!same(baseline.sph_documents, current.sph_documents)) throw new Error("SPH status or data changed since preview. Create a new preview.");
      for (const id of ids) await tx.execute({ sql: "UPDATE sph_documents SET status = ? WHERE id = ? AND status IN (?, ?, ?)", args: [destination, id, ...waitingStatuses] });
    }
    const restored = await captureSphPo(tx, ids);
    if (restored.sph_documents.length !== ids.length || restored.sph_documents.some(row => row.status !== destination) || !same(withoutStatus(baseline.sph_documents), withoutStatus(restored.sph_documents))) throw new Error("SPH verification failed.");
    for (const [table, rows] of Object.entries(baseline)) if (table !== "sph_documents" && !same(rows, restored[table])) throw new Error(`Preservation verification failed: ${table}`);
    await tx.commit();
    return { count: ids.length, alreadyApplied: allAlreadyMoved };
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

export async function applySphPoOnce(client, data, marker, checksum) {
  try {
    const completed = JSON.parse(await readFile(marker, "utf8"));
    if (completed.checksum !== checksum) throw new Error("Applied marker checksum mismatch.");
    return { ...completed, skipped: true };
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const result = await applySphPo(client, data);
  await writeFile(marker, JSON.stringify({ ...result, appliedAt: new Date().toISOString(), checksum }), { flag: "wx" });
  return result;
}

async function main() {
  const [mode, environment, file] = process.argv.slice(2);
  if (!["--preview", "--apply"].includes(mode) || !["development", "production"].includes(environment) || (mode === "--apply" && !file)) throw new Error("Usage: node scripts/migrate-sph-po.mjs --preview development|production OR --apply development|production <backup.json>");
  const env = parse(await readFile(resolve(root, `.env.${environment}.local`)));
  if (!env.TURSO_DATABASE_URL) throw new Error("Database URL missing in environment-specific file.");
  if (environment === "development") {
    const production = parse(await readFile(resolve(root, ".env.production.local")));
    if (identity(env.TURSO_DATABASE_URL) === identity(production.TURSO_DATABASE_URL)) throw new Error("Development points to production.");
  }
  const client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN ?? env.TURSO_DATABASE_TURSO_AUTH_TOKEN });
  try {
    if (mode === "--preview") {
      const data = await previewSphPo(client);
      const directory = resolve(root, "backups/sph-po");
      await mkdir(directory, { recursive: true });
      const path = resolve(directory, `${environment}-${new Date().toISOString().replaceAll(":", "-")}.json`);
      await writeFile(path, JSON.stringify({ version: 1, environment, databaseIdentity: identity(env.TURSO_DATABASE_URL), capturedAt: new Date().toISOString(), checksum: digest(data), data }), { flag: "wx" });
      console.log(`Preview: ${data.sph_documents.length} SPH. Backup: ${path}`);
    } else {
      const path = resolve(file);
      const artifact = JSON.parse(await readFile(path, "utf8"));
      if (artifact.version !== 1 || artifact.environment !== environment || artifact.databaseIdentity !== identity(env.TURSO_DATABASE_URL) || artifact.checksum !== digest(artifact.data)) throw new Error("Backup identity or checksum mismatch.");
      const marker = path + ".applied.json";
      const result = await applySphPoOnce(client, artifact.data, marker, artifact.checksum);
      if (result.skipped) { console.log("Already applied; no changes made."); return; }
      console.log(`Verified: ${result.count} SPH moved; invoices, payments, items and shipments preserved.`);
    }
  } finally { client.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
