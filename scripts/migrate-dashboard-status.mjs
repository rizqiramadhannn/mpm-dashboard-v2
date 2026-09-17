import { createClient } from '@libsql/client';
import { parse } from 'dotenv';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tag = '0039_sph_status_history';
const names = ['sph_status_history', 'dashboard_status_tracking', 'sph_status_history_deal_time_idx', 'sph_status_history_capture'];

async function inspect(tx) {
  const objects = (await tx.execute({sql:`SELECT type,name,sql FROM sqlite_master WHERE name IN (${names.map(()=>'?').join(',')}) ORDER BY name`,args:names})).rows.map(row=>({...row}));
  const counts = {};
  for (const table of ['sph_documents','sph_items','invoice_documents','invoice_items','supplier_notes','supplier_note_imports']) {
    counts[table] = Number((await tx.execute(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
  }
  return {objects, counts};
}

async function main() {
  const [mode, environment] = process.argv.slice(2);
  if (process.argv.length !== 4 || !['--preview','--apply'].includes(mode) || !['development','production'].includes(environment)) throw new Error('Usage: node scripts/migrate-dashboard-status.mjs --preview|--apply development|production');
  const env = parse(await readFile(resolve(root,`.env.${environment}.local`)));
  const authToken = env.TURSO_AUTH_TOKEN ?? env.TURSO_DATABASE_TURSO_AUTH_TOKEN;
  if (!env.TURSO_DATABASE_URL || !authToken) throw new Error('Environment-specific credentials unavailable');
  if (environment === 'development') {
    const production = parse(await readFile(resolve(root,'.env.production.local')));
    const identity = url => url.trim().replace(/\/+$/,'').toLowerCase();
    if (identity(env.TURSO_DATABASE_URL) === identity(production.TURSO_DATABASE_URL)) throw new Error('Development points to production');
  }
  const migration = await readFile(resolve(root,`drizzle/${tag}.sql`),'utf8');
  const hash = createHash('sha256').update(migration).digest('hex');
  const journal = JSON.parse(await readFile(resolve(root,'drizzle/meta/_journal.json'),'utf8')).entries;
  const entry = journal.find(e=>e.tag === tag);
  const previous = journal[journal.indexOf(entry)-1];
  if (!entry || !previous) throw new Error('Migration journal unavailable');
  const client = createClient({url:env.TURSO_DATABASE_URL,authToken});
  const tx = await client.transaction(mode === '--preview' ? 'read' : 'write');
  try {
    const latest = (await tx.execute('SELECT hash,created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1')).rows[0];
    const before = await inspect(tx);
    if (before.objects.length === names.length && latest?.hash === hash && Number(latest.created_at) === entry.when) {
      const marker = await tx.execute('SELECT installed_at FROM dashboard_status_tracking WHERE id=1');
      if (marker.rows.length !== 1) throw new Error('Installation marker missing');
      await tx.commit();
      console.log(JSON.stringify({environment,alreadyApplied:true,trackingSince:marker.rows[0].installed_at,...before}));
      return;
    }
    if (before.objects.length || !latest || Number(latest.created_at) !== previous.when) throw new Error('Unexpected schema or pending migrations; inspect before applying');
    if (mode === '--preview') {
      await tx.commit();
      console.log(JSON.stringify({environment,migration:tag,sha256:hash,changes:'Add two tables, one index and one status-history trigger; no existing data updated',...before}));
      return;
    }
    const directory = resolve(root,'backups/dashboard-status');
    await mkdir(directory,{recursive:true});
    const backup = resolve(directory,`${environment}-${new Date().toISOString().replaceAll(':','-')}.json`);
    const schema = (await tx.execute("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type,name")).rows.map(row=>({...row}));
    await writeFile(backup,JSON.stringify({capturedAt:new Date().toISOString(),migration:tag,hash,latest:{...latest},schema,...before},null,2),{flag:'wx'});
    for (const statement of migration.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean)) await tx.execute(statement);
    await tx.execute({sql:'INSERT INTO __drizzle_migrations(hash,created_at) VALUES(?,?)',args:[hash,entry.when]});
    const after = await inspect(tx);
    if (after.objects.length !== names.length || JSON.stringify(before.counts) !== JSON.stringify(after.counts)) throw new Error('Preservation verification failed');
    if ((await tx.execute('SELECT count(*) AS n FROM sph_status_history')).rows[0].n !== 0) throw new Error('Unexpected historical backfill');
    const marker = await tx.execute('SELECT installed_at FROM dashboard_status_tracking WHERE id=1');
    if (marker.rows.length !== 1) throw new Error('Installation marker missing');
    await tx.commit();
    console.log(JSON.stringify({environment,applied:true,backup,trackingSince:marker.rows[0].installed_at,...after}));
  } catch(error) {await tx.rollback(); throw error;}
  finally {tx.close(); client.close();}
}

main().catch(()=>{console.error('Dashboard status migration failed. Check environment-specific configuration, schema and migration prerequisites; no credentials are logged.');process.exitCode=1;});
