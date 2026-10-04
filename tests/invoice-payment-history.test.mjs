import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { getTableConfig, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import { eq } from 'drizzle-orm';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import * as schema from '../db/schema.ts';
import { invoiceMonthlyReport, paymentHistoryState } from '../app/invoice/payment-history.ts';
import { persistInvoiceChange, readInvoicePaymentAudits, InvoiceChangeConflict } from '../app/invoice/payment-history-storage.ts';

const invoice = (extra = {}) => ({ id: 'i1', invoiceDate: '2026-09-01', totalAmount: 100, paidAmount: 100, status: 'done', processedAt: '2026-10-10T00:00:00Z', ...extra });
function receipt(id, previousEventId, before, after, date, recordedAt = `${date}T03:00:00Z`) {
  return { id, createdAt: recordedAt, detailsJson: { invoiceId: 'i1', paymentHistory: { version: 1, kind: 'receipt', previousEventId, previousPaidAmount: before, paidAmount: after, paymentId: `p-${id}`, amount: after - before, paymentDate: date, settlesInvoice: after >= 100 && before < 100 } } };
}
const observedAt = new Date('2026-12-01T03:00:00Z');
const report = (doc, logs, month = '2026-10') => invoiceMonthlyReport(doc, logs, month, observedAt);

test('September installments and October settlement keep the October target and exclude November', () => {
  const logs = [receipt('s', null, 0, 40, '2026-09-30'), receipt('o', 's', 40, 100, '2026-10-10')];
  const october = report(invoice(), logs);
  assert.equal(october.targetAmount, 60);
  assert.equal(october.openingRemaining, 60);
  assert.equal(october.receivedInPeriod, 60);
  assert.equal(october.closingRemaining, 0);
  assert.equal(october.historyComplete, true);
  assert.equal(october.inclusionStatus, 'include');
  const november = report(invoice(), logs, '2026-11');
  assert.deepEqual([november.targetAmount, november.openingRemaining, november.receivedInPeriod, november.closingRemaining, november.inclusionStatus], [0, 0, 0, 0, 'exclude']);
});

test('November payments cannot change October receipts or the October closing balance', () => {
  const logs = [receipt('s', null, 0, 40, '2026-09-30'), receipt('o', 's', 40, 70, '2026-10-15'), receipt('n', 'o', 70, 100, '2026-11-01')];
  const october = report(invoice({ processedAt: '2026-11-01T00:00:00Z' }), logs);
  assert.deepEqual([october.targetAmount, october.receivedInPeriod, october.closingRemaining], [60, 30, 30]);
  const november = report(invoice({ processedAt: '2026-11-01T00:00:00Z' }), logs, '2026-11');
  assert.deepEqual([november.targetAmount, november.receivedInPeriod, november.closingRemaining], [30, 30, 0]);
});

test('month boundaries use user-confirmed WIB payment dates, not entry/upload timestamps', () => {
  const logs = [receipt('s', null, 0, 40, '2026-09-30', '2026-10-01T06:00:00Z'), receipt('o', 's', 40, 100, '2026-10-01', '2026-10-03T06:00:00Z')];
  const october = report(invoice(), logs);
  assert.equal(october.receivedInPeriod, 60);
  assert.equal(october.openingRemaining, 60);
  assert.equal(october.periodEndExclusive, '2026-11-01');
  assert.equal(report(invoice(), logs, '2026-09').receivedInPeriod, 40);
});

test('October issued invoices start with zero receivables but retain the full target after settlement', () => {
  const logs = [receipt('o', null, 0, 100, '2026-10-10')];
  const result = report(invoice({ invoiceDate: '2026-10-03' }), logs);
  assert.deepEqual([result.targetAmount, result.openingRemaining, result.receivedInPeriod, result.closingRemaining], [100, 0, 100, 0]);
});

test('legacy settlement does not allocate cumulative paidAmount to the settlement month', () => {
  const doc = invoice();
  const october = report(doc, []);
  assert.equal(october.receivedInPeriod, null);
  assert.equal(october.knownReceivedInPeriod, 0);
  assert.equal(october.targetAmount, null);
  assert.equal(october.openingRemaining, null);
  assert.equal(october.closingRemaining, 0);
  assert.equal(october.historyComplete, false);
  assert.equal(october.inclusionStatus, 'review_required');
  assert.ok(october.historyReasons.includes('legacy_unallocated_balance'));
  const november = report(doc, [], '2026-11');
  assert.deepEqual([november.targetAmount, november.receivedInPeriod, november.closingRemaining, november.inclusionStatus], [0, 0, 0, 'exclude']);
  const paidSeptember = report(invoice({ processedAt: '2026-09-30T00:00:00Z' }), []);
  assert.equal(paidSeptember.inclusionStatus, 'exclude');
});

test('legacy audit changes and incomplete baselines are explicit; known cash is only a partial amount', () => {
  const legacy = { id: 'old', createdAt: '2026-10-02 18:00:00', detailsJson: { invoiceId: 'i1', paidAmount: 40 } };
  const logs = [legacy, receipt('o', null, 40, 100, '2026-10-10')];
  const result = report(invoice(), logs);
  assert.equal(result.receivedInPeriod, null);
  assert.equal(result.knownReceivedInPeriod, 60);
  assert.equal(result.targetAmount, null);
  assert.equal(result.historyComplete, false);
  assert.equal(result.inclusionStatus, 'include');
  // Old paid balances that were later cleared still have unknown historical cash.
  const cleared = report(invoice({ paidAmount: 0, status: 'pending', processedAt: null }), [legacy], '2026-10');
  assert.equal(cleared.openingRemaining, null);
  assert.equal(cleared.receivedInPeriod, null);
});

test('a matching cumulative checkpoint before the month establishes opening balance without inventing a receipt', () => {
  const checkpoint = { id: 'old', createdAt: '2026-09-30 03:00:00', detailsJson: { invoiceId: 'i1', paidAmount: 30 } };
  const doc = invoice({ paidAmount: 30, status: 'pending', processedAt: null });
  const october = report(doc, [checkpoint]);
  assert.deepEqual([october.targetAmount, october.openingRemaining, october.receivedInPeriod, october.closingRemaining], [70, 70, 0, 70]);
  assert.equal(october.historyComplete, true);
  assert.equal(october.paymentsInPeriod.length, 0);
  const september = report(doc, [checkpoint], '2026-09');
  assert.equal(september.receivedInPeriod, null);
});

test('date and amount corrections replace one factual receipt without counting a second receipt', () => {
  const a = receipt('a', null, 0, 40, '2026-09-30');
  const b = receipt('b', 'a', 40, 100, '2026-11-01');
  const corrected = { id: 'c', createdAt: '2026-11-02T03:00:00Z', detailsJson: { invoiceId: 'i1', paymentHistory: { version: 1, kind: 'receipt_correction', previousEventId: 'b', previousPaidAmount: 100, paidAmount: 90, paymentId: 'p-b', amount: 50, paymentDate: '2026-10-31' } } };
  const october = report(invoice({ paidAmount: 90, status: 'pending', processedAt: null }), [corrected, b, a]);
  assert.deepEqual([october.receivedInPeriod, october.closingRemaining], [50, 10]);
  assert.equal(october.paymentsInPeriod.length, 1);
  assert.equal(october.paymentsInPeriod[0].corrected, true);
  const november = report(invoice({ paidAmount: 90, status: 'pending', processedAt: null }), [a, b, corrected], '2026-11');
  assert.deepEqual([november.targetAmount, november.receivedInPeriod, november.closingRemaining], [10, 0, 10]);
});

test('broken/missing events and adjustments never appear as verified cash or balances', () => {
  const logs = [receipt('a', null, 0, 50, '2026-10-01'), receipt('b', 'missing', 50, 100, '2026-10-02')];
  const result = report(invoice(), logs);
  assert.equal(result.receivedInPeriod, null);
  assert.equal(result.closingRemaining, null);
  assert.ok(result.historyReasons.includes('broken_event_chain'));
  const adjustment = { id: 'adj', createdAt: '2026-10-03T00:00:00Z', detailsJson: { invoiceId: 'i1', paymentHistory: { version: 1, kind: 'unallocated_adjustment', previousEventId: null, previousPaidAmount: 0, paidAmount: 100 } } };
  const corrected = report(invoice(), [adjustment]);
  assert.equal(corrected.receivedInPeriod, null);
  assert.equal(corrected.knownReceivedInPeriod, 0);
});

test('unallocated reductions with later receipt-date amendments cannot fabricate negative historical paid balances', () => {
  const a = receipt('a', null, 0, 100, '2026-10-01');
  const b = { id: 'b', createdAt: '2026-11-10T03:00:00Z', detailsJson: { invoiceId: 'i1', paymentHistory: { version: 1, kind: 'unallocated_adjustment', previousEventId: 'a', previousPaidAmount: 100, paidAmount: 50 } } };
  const c = { id: 'c', createdAt: '2026-12-21T03:00:00Z', detailsJson: { invoiceId: 'i1', paymentHistory: { version: 1, kind: 'receipt_correction', previousEventId: 'b', previousPaidAmount: 50, paidAmount: 50, paymentId: 'p-a', amount: 100, paymentDate: '2026-12-20' } } };
  const result = report(invoice({ paidAmount: 50, status: 'pending', processedAt: null }), [a, b, c], '2026-11');
  assert.equal(result.closingRemaining, null);
  assert.equal(result.balanceComplete, false);
});

async function fixture(run) {
  const tempRoot = resolve(tmpdir());
  const directory = await mkdtemp(join(tempRoot, 'mpm-payment-history-'));
  const client = createClient({ url: `file:${join(directory, 'fixture.db').replaceAll('\\', '/')}` });
  try {
    const dialect = new SQLiteSyncDialect();
    for (const table of [schema.invoiceDocuments, schema.appAdminAuditLogs]) {
      const config = getTableConfig(table);
      const columns = config.columns.map(c => {
        let value = `"${c.name}" ${c.getSQLType()}${c.primary ? ' PRIMARY KEY' : ''}${c.notNull ? ' NOT NULL' : ''}`;
        if (c.default !== undefined) value += ` DEFAULT ${typeof c.default === 'string' ? `'${c.default.replaceAll("'", "''")}'` : typeof c.default === 'number' || typeof c.default === 'boolean' ? Number(c.default) : dialect.sqlToQuery(c.default).sql}`;
        return value;
      });
      await client.execute(`CREATE TABLE "${config.name}" (${columns.join(', ')})`);
    }
    const db = drizzle(client, { schema });
    await db.insert(schema.invoiceDocuments).values({ id: 'i1', sphId: 's1', invoiceNo: 'INV1', invoiceDate: '2026-09-01', customerName: 'Customer', totalAmount: 100, status: 'pending' });
    await run(db, client);
  } finally {
    client.close();
    assert.equal(dirname(directory), tempRoot);
    assert.ok(basename(directory).startsWith('mpm-payment-history-'));
    await rm(directory, { recursive: true, force: true, maxRetries: 2, retryDelay: 20 }).catch(error => { if (error.code !== 'EBUSY') throw error; });
  }
}
const actor = { id: 'admin', username: 'superadmin', ipAddress: '127.0.0.1' };
const load = async db => (await db.select().from(schema.invoiceDocuments).where(eq(schema.invoiceDocuments.id, 'i1')))[0];

test('invoice and receipt audits commit atomically, reject stale writes, and reconcile corrected events', () => fixture(async db => {
  const initial = await load(db);
  await persistInvoiceChange(db, initial, { paidAmount: 40 }, { expectedPaidAmount: 0, paymentKind: 'receipt', receivedDate: '2026-09-30' }, {}, actor, new Date('2026-09-30T03:00:00Z'));
  await assert.rejects(persistInvoiceChange(db, initial, { paidAmount: 60 }, { expectedPaidAmount: 0, paymentKind: 'receipt', receivedDate: '2026-09-30' }, {}, actor), InvoiceChangeConflict);
  await persistInvoiceChange(db, await load(db), { paidAmount: 100 }, { expectedPaidAmount: 40, paymentKind: 'receipt', receivedDate: '2026-10-01' }, {}, actor, new Date('2026-10-02T03:00:00Z'));
  let state = await load(db);
  assert.equal(state.processedAt, '2026-10-01T00:00:00.000Z');
  let logs = await readInvoicePaymentAudits(db, ['i1']);
  assert.equal(logs.length, 2);
  assert.equal(report(state, logs).receivedInPeriod, 60);
  await persistInvoiceChange(db, state, { processedAt: '2026-09-30T00:00:00.000Z' }, { paymentDate: '2026-09-30' }, {}, actor, new Date('2026-10-03T03:00:00Z'));
  state = await load(db); logs = await readInvoicePaymentAudits(db, ['i1']);
  assert.equal(report(state, logs).receivedInPeriod, 0);
  const receiptToCorrect = paymentHistoryState(state, logs).payments.find(p => p.amount === 60);
  await persistInvoiceChange(db, state, {}, { expectedPaidAmount: 100, paymentEventId: receiptToCorrect.paymentId, paymentEventAmount: 50, paymentEventDate: '2026-10-01', correctionReason: 'Nominal pada bukti bayar dikoreksi' }, {}, actor, new Date('2026-10-04T03:00:00Z'));
  state = await load(db); logs = await readInvoicePaymentAudits(db, ['i1']);
  assert.equal(state.paidAmount, 90);
  assert.equal(state.status, 'pending');
  assert.equal(report(state, logs).receivedInPeriod, 50);
  assert.equal(report(state, logs).closingRemaining, 10);
  assert.equal(logs.length, 4);
  // An unchanged cumulative amount is not a legacy financial change.
  await persistInvoiceChange(db, state, { paidAmount: 90 }, {}, {}, actor, new Date('2026-10-04T04:00:00Z'));
  assert.equal(paymentHistoryState(await load(db), await readInvoicePaymentAudits(db, ['i1'])).valid, true);
}));

test('audit failure rolls back the invoice amount; ambiguous/future payments cannot be saved', () => fixture(async (db, client) => {
  const before = await load(db);
  await assert.rejects(persistInvoiceChange(db, before, { paidAmount: 50 }, { expectedPaidAmount: 0 }, {}, actor));
  await assert.rejects(persistInvoiceChange(db, before, { paidAmount: 50 }, { expectedPaidAmount: 0, paymentKind: 'receipt', receivedDate: '2026-10-05' }, {}, actor, new Date('2026-10-04T03:00:00Z')));
  await assert.rejects(persistInvoiceChange(db, before, { paidAmount: 100, processedAt: '2026-10-02T00:00:00Z' }, { expectedPaidAmount: 0, paymentKind: 'receipt', receivedDate: '2026-10-01', paymentDate: '2026-10-02' }, {}, actor, new Date('2026-10-04T03:00:00Z')));
  assert.equal((await load(db)).paidAmount, 0);
  await client.execute("CREATE TRIGGER reject_payment_audit BEFORE INSERT ON app_admin_audit_logs BEGIN SELECT RAISE(ABORT, 'fixture audit failure'); END");
  await assert.rejects(persistInvoiceChange(db, before, { paidAmount: 50 }, { expectedPaidAmount: 0, paymentKind: 'receipt', receivedDate: '2026-10-04' }, {}, actor, new Date('2026-10-04T03:00:00Z')));
  assert.equal((await load(db)).paidAmount, 0);
  assert.equal((await readInvoicePaymentAudits(db, ['i1'])).length, 0);
}));
