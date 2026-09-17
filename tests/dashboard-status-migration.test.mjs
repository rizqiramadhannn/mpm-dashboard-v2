import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const root = resolve(import.meta.dirname, '..');

async function fixture(t, fail=false) {
  await mkdir(join(root,'tmp'),{recursive:true});
  const directory=await mkdtemp(join(root,'tmp','dashboard-migration-'));
  await mkdir(join(directory,'scripts'));
  await mkdir(join(directory,'drizzle/meta'),{recursive:true});
  const script=join(directory,'scripts/migrate-dashboard-status.mjs');
  await writeFile(script,await readFile(join(root,'scripts/migrate-dashboard-status.mjs')));
  const journal=await readFile(join(root,'drizzle/meta/_journal.json'));
  await writeFile(join(directory,'drizzle/meta/_journal.json'),journal);
  const previous=JSON.parse(journal).entries.at(-2);
  let sql=await readFile(join(root,'drizzle/0039_sph_status_history.sql'),'utf8');
  if(fail) sql+='\n--> statement-breakpoint\nSELECT * FROM missing_table;';
  await writeFile(join(directory,'drizzle/0039_sph_status_history.sql'),sql);
  const clients=[];
  for(const env of ['development','production']) {
    const url=pathToFileURL(join(directory,`${env}.db`)).href;
    await writeFile(join(directory,`.env.${env}.local`),`TURSO_DATABASE_URL=${url}\nTURSO_AUTH_TOKEN=fixture\n`);
    const c=createClient({url});clients.push(c);
    await c.executeMultiple(`CREATE TABLE __drizzle_migrations(id INTEGER PRIMARY KEY,hash TEXT,created_at NUMERIC);
      CREATE TABLE sph_documents(id TEXT PRIMARY KEY,sph_no TEXT,status TEXT);
      CREATE TABLE sph_items(id TEXT);CREATE TABLE invoice_documents(id TEXT);
      CREATE TABLE invoice_items(id TEXT);CREATE TABLE supplier_notes(id TEXT);
      CREATE TABLE supplier_note_imports(id TEXT);INSERT INTO sph_documents VALUES('one','SPH-one','menunggu_po_konfirmasi');`);
    await c.execute({sql:'INSERT INTO __drizzle_migrations(hash,created_at) VALUES(?,?)',args:['previous',previous.when]});
  }
  t.after(()=>clients.forEach(c=>c.close()));
  return {clients,cli:(mode,env)=>run(process.execPath,[script,mode,env],{cwd:directory})};
}

test('preview is read-only; production fixture apply preserves rows and records migration once',async t=>{
  const {clients,cli}=await fixture(t);
  const c=clients[1];
  assert.equal(JSON.parse((await cli('--preview','production')).stdout).objects.length,0);
  assert.equal((await c.execute("SELECT name FROM sqlite_master WHERE name='sph_status_history'")).rows.length,0);
  const applied=JSON.parse((await cli('--apply','production')).stdout);
  assert.equal(applied.applied,true);assert.equal(applied.counts.sph_documents,1);
  assert.equal((await c.execute('SELECT count(*) AS n FROM sph_status_history')).rows[0].n,0);
  assert.equal(JSON.parse((await cli('--apply','production')).stdout).alreadyApplied,true);
  assert.equal((await c.execute('SELECT count(*) AS n FROM __drizzle_migrations')).rows[0].n,2);
  await c.execute("UPDATE sph_documents SET status='menunggu_pengiriman'");
  assert.equal((await c.execute('SELECT count(*) AS n FROM sph_status_history')).rows[0].n,1);
  assert.equal((await clients[0].execute("SELECT name FROM sqlite_master WHERE name='sph_status_history'")).rows.length,0);
});

test('failure rolls back additive schema and migration journal',async t=>{
  const {clients,cli}=await fixture(t,true);
  await assert.rejects(cli('--apply','development'));
  assert.equal((await clients[0].execute("SELECT name FROM sqlite_master WHERE name='sph_status_history'")).rows.length,0);
  assert.equal((await clients[0].execute('SELECT count(*) AS n FROM __drizzle_migrations')).rows[0].n,1);
});
