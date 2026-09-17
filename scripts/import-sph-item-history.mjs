import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { parseItemHistoryRows, SOURCE_SHEET_NAME, SOURCE_SPREADSHEET_ID } from "./lib/sph-item-history-import.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const EXPECTED = { records: 615, validRows: 623, skippedRows: 124, duplicateRows: 8 };

async function main() {
  const [mode, environment, sourceFlag, sourceArgument] = process.argv.slice(2);
  if (process.argv.length !== 6 || !["--preview", "--apply"].includes(mode) || !["development", "production"].includes(environment) || sourceFlag !== "--source") {
    throw new Error("Usage: node scripts/import-sph-item-history.mjs --preview|--apply development|production --source <local-json>");
  }
  const sourcePath = resolve(root, sourceArgument);
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  const parsed = parseItemHistoryRows(source.values ?? source.structuredContent?.values ?? []);
  const summary = {
    records: parsed.records.length,
    validRows: parsed.validRows,
    skippedRows: parsed.skippedRows.length,
    duplicateRows: parsed.duplicateRows.length,
  };
  if (JSON.stringify(summary) !== JSON.stringify(EXPECTED)) throw new Error(`Source validation failed: ${JSON.stringify(summary)}`);

  const env = parse(await readFile(resolve(root, `.env.${environment}.local`)));
  const authToken = env.TURSO_AUTH_TOKEN ?? env.TURSO_DATABASE_TURSO_AUTH_TOKEN;
  if (!env.TURSO_DATABASE_URL || !authToken) throw new Error("Environment-specific credentials unavailable");
  if (environment === "development") {
    const production = parse(await readFile(resolve(root, ".env.production.local")));
    const identity = (url) => url.trim().replace(/\/+$/, "").toLowerCase();
    if (identity(env.TURSO_DATABASE_URL) === identity(production.TURSO_DATABASE_URL)) throw new Error("Development points to production");
  }

  const client = createClient({ url: env.TURSO_DATABASE_URL, authToken });
  const tx = await client.transaction(mode === "--preview" ? "read" : "write");
  try {
    const table = await tx.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sph_imported_item_history'");
    if (!table.rows.length) throw new Error("Migration 0040 is not applied");
    const before = Number((await tx.execute({ sql: "SELECT count(*) AS n FROM sph_imported_item_history WHERE source_spreadsheet_id=? AND source_sheet_name=?", args: [SOURCE_SPREADSHEET_ID, SOURCE_SHEET_NAME] })).rows[0].n);
    if (mode === "--preview") {
      await tx.commit();
      console.log(JSON.stringify({ environment, mode: "preview", before, wouldInsert: parsed.records.length - before, ...summary, skippedSourceRows: parsed.skippedRows, duplicateSourceRows: parsed.duplicateRows }));
      return;
    }

    const directory = resolve(root, "backups", "sph-item-history");
    await mkdir(directory, { recursive: true });
    const existing = (await tx.execute({ sql: "SELECT * FROM sph_imported_item_history WHERE source_spreadsheet_id=? AND source_sheet_name=? ORDER BY source_row", args: [SOURCE_SPREADSHEET_ID, SOURCE_SHEET_NAME] })).rows.map((row) => ({ ...row }));
    const sourceChecksum = createHash("sha256").update(JSON.stringify(parsed.records)).digest("hex");
    const backup = resolve(directory, `${environment}-before-import-${new Date().toISOString().replaceAll(":", "-")}.json`);
    await writeFile(backup, JSON.stringify({ capturedAt: new Date().toISOString(), sourcePath, sourceChecksum, existing }, null, 2), { flag: "wx" });

    const sql = `INSERT INTO sph_imported_item_history (id,source_spreadsheet_id,source_sheet_name,source_row,source_key,sph_date,part_number,part_name,customer_name,sph_no,quantity,uom,unit_price,total_price,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_key) DO NOTHING`;
    for (let start = 0; start < parsed.records.length; start += 100) {
      await tx.batch(parsed.records.slice(start, start + 100).map((record) => ({
        sql,
        args: [record.id, record.sourceSpreadsheetId, record.sourceSheetName, record.sourceRow, record.sourceKey, record.sphDate, record.partNumber, record.partName, record.customerName, record.sphNo, record.quantity, record.uom, record.unitPrice, record.totalPrice, record.status],
      })));
    }
    const after = Number((await tx.execute({ sql: "SELECT count(*) AS n FROM sph_imported_item_history WHERE source_spreadsheet_id=? AND source_sheet_name=?", args: [SOURCE_SPREADSHEET_ID, SOURCE_SHEET_NAME] })).rows[0].n);
    const invalidStatuses = Number((await tx.execute({ sql: "SELECT count(*) AS n FROM sph_imported_item_history WHERE source_spreadsheet_id=? AND source_sheet_name=? AND status <> '-'", args: [SOURCE_SPREADSHEET_ID, SOURCE_SHEET_NAME] })).rows[0].n);
    if (after !== EXPECTED.records || invalidStatuses !== 0) throw new Error(`Import verification failed: rows=${after}, invalidStatuses=${invalidStatuses}`);
    await tx.commit();
    console.log(JSON.stringify({ environment, mode: "apply", backup, inserted: after - before, after, idempotent: before === after, ...summary }));
  } catch (error) {
    await tx.rollback().catch(() => {});
    throw error;
  } finally {
    tx.close();
    client.close();
  }
}

main().catch((error) => {
  console.error(`SPH item-history import failed: ${error.message}`);
  process.exitCode = 1;
});
