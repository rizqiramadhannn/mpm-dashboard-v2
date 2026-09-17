import assert from "node:assert/strict";
import test from "node:test";
import {
  googleSerialDateToIso,
  parseItemHistoryRows,
} from "../scripts/lib/sph-item-history-import.mjs";

function row(overrides = {}) {
  const values = [1, "PN-1", "Oil Filter", 2, "pcs", "PT Customer", "SPH2601001ABC", 46038, 125000, 250000];
  for (const [index, value] of Object.entries(overrides)) values[Number(index)] = value;
  return values;
}

test("converts Google serial dates and preserves ISO dates", () => {
  assert.equal(googleSerialDateToIso(46038), "2026-01-16");
  assert.equal(googleSerialDateToIso("2026-07-01"), "2026-07-01");
  assert.equal(googleSerialDateToIso("not-a-date"), null);
});

test("accepts blank part numbers and rejects rows missing price or SPH context", () => {
  const parsed = parseItemHistoryRows([
    row({ 1: "" }),
    row({ 8: "" }),
    row({ 6: "" }),
    row({ 5: "" }),
  ]);

  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].partNumber, "");
  assert.equal(parsed.records[0].status, "-");
  assert.deepEqual(parsed.skippedRows, [9, 10, 11]);
});

test("removes copied nearby rows while retaining a matching later ledger entry", () => {
  const repeated = row();
  const values = [repeated, repeated, ...Array.from({ length: 10 }, (_, index) => row({ 0: index + 2, 1: `PN-${index + 2}` })), repeated];
  const parsed = parseItemHistoryRows(values);

  assert.equal(parsed.validRows, 13);
  assert.equal(parsed.records.length, 12);
  assert.deepEqual(parsed.duplicateRows, [9]);
  assert.equal(new Set(parsed.records.map((record) => record.sourceKey)).size, 12);
});

test("source keys are deterministic for idempotent re-imports", () => {
  const first = parseItemHistoryRows([row()]).records[0];
  const second = parseItemHistoryRows([row()]).records[0];
  assert.equal(first.id, second.id);
  assert.equal(first.sourceKey, second.sourceKey);
});
