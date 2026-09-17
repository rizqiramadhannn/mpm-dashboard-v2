import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

const root = fileURLToPath(new URL("../", import.meta.url));
const tag = "0040_sph_imported_item_history";
const names = [
  "sph_imported_item_history",
  "sph_imported_item_history_source_key_idx",
  "sph_imported_item_history_date_idx",
  "sph_imported_item_history_sph_no_idx",
];

async function inspect(tx) {
  const objects = (await tx.execute({
    sql: `SELECT type,name,sql FROM sqlite_master WHERE name IN (${names.map(() => "?").join(",")}) ORDER BY name`,
    args: names,
  })).rows.map((row) => ({ ...row }));
  const counts = {};
  for (const table of ["sph_documents", "sph_items", "invoice_documents", "invoice_items"]) {
    counts[table] = Number((await tx.execute(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
  }
  return { objects, counts };
}

async function main() {
  const [mode, environment] = process.argv.slice(2);
  if (process.argv.length !== 4 || !["--preview", "--apply"].includes(mode) || !["development", "production"].includes(environment)) {
    throw new Error("Usage: node scripts/migrate-sph-item-history.mjs --preview|--apply development|production");
  }
  const env = parse(await readFile(resolve(root, `.env.${environment}.local`)));
  const authToken = env.TURSO_AUTH_TOKEN ?? env.TURSO_DATABASE_TURSO_AUTH_TOKEN;
  if (!env.TURSO_DATABASE_URL || !authToken) throw new Error("Environment-specific credentials unavailable");
  if (environment === "development") {
    const production = parse(await readFile(resolve(root, ".env.production.local")));
    const identity = (url) => url.trim().replace(/\/+$/, "").toLowerCase();
    if (identity(env.TURSO_DATABASE_URL) === identity(production.TURSO_DATABASE_URL)) throw new Error("Development points to production");
  }

  const migration = await readFile(resolve(root, `drizzle/${tag}.sql`), "utf8");
  const hash = createHash("sha256").update(migration).digest("hex");
  const entries = JSON.parse(await readFile(resolve(root, "drizzle/meta/_journal.json"), "utf8")).entries;
  const entryIndex = entries.findIndex((item) => item.tag === tag);
  const entry = entries[entryIndex];
  const previous = entries[entryIndex - 1];
  if (!entry || !previous) throw new Error("Migration journal unavailable");

  const client = createClient({ url: env.TURSO_DATABASE_URL, authToken });
  const tx = await client.transaction(mode === "--preview" ? "read" : "write");
  try {
    const latest = (await tx.execute("SELECT hash,created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1")).rows[0];
    const before = await inspect(tx);
    if (before.objects.length === names.length && latest?.hash === hash && Number(latest.created_at) === entry.when) {
      const count = Number((await tx.execute("SELECT count(*) AS n FROM sph_imported_item_history")).rows[0].n);
      await tx.commit();
      console.log(JSON.stringify({ environment, alreadyApplied: true, importedRows: count, ...before }));
      return;
    }
    if (before.objects.length || !latest || Number(latest.created_at) !== previous.when) {
      throw new Error("Unexpected schema or pending migrations; inspect before applying");
    }
    if (mode === "--preview") {
      await tx.commit();
      console.log(JSON.stringify({ environment, migration: tag, sha256: hash, changes: "Add an isolated imported SPH item-history table and three indexes; no operational rows are updated", ...before }));
      return;
    }

    const directory = resolve(root, "backups", "sph-item-history");
    await mkdir(directory, { recursive: true });
    const backup = resolve(directory, `${environment}-before-${tag}-${new Date().toISOString().replaceAll(":", "-")}.json`);
    const schema = (await tx.execute("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type,name")).rows.map((row) => ({ ...row }));
    await writeFile(backup, JSON.stringify({ capturedAt: new Date().toISOString(), migration: tag, hash, latest: { ...latest }, schema, ...before }, null, 2), { flag: "wx" });
    for (const statement of migration.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) await tx.execute(statement);
    await tx.execute({ sql: "INSERT INTO __drizzle_migrations(hash,created_at) VALUES(?,?)", args: [hash, entry.when] });
    const after = await inspect(tx);
    const importedRows = Number((await tx.execute("SELECT count(*) AS n FROM sph_imported_item_history")).rows[0].n);
    if (after.objects.length !== names.length || importedRows !== 0 || JSON.stringify(before.counts) !== JSON.stringify(after.counts)) {
      throw new Error("Migration preservation verification failed");
    }
    await tx.commit();
    console.log(JSON.stringify({ environment, applied: true, backup, importedRows, ...after }));
  } catch (error) {
    await tx.rollback().catch(() => {});
    throw error;
  } finally {
    tx.close();
    client.close();
  }
}

main().catch((error) => {
  console.error(`SPH item-history migration failed: ${error.message}`);
  process.exitCode = 1;
});
