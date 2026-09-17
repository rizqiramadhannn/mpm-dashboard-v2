import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  itemHistoryMatchesQuery,
  itemHistoryStatus,
  itemHistoryStatusLabel,
} from "../app/sph/item-history/itemHistory.ts";

test("item history maps current and legacy SPH statuses", () => {
  assert.equal(itemHistoryStatusLabel("-"), "-");

  for (const status of ["cek_harga", "menunggu_po_konfirmasi", "draft"]) {
    assert.equal(itemHistoryStatus(status), "waiting");
    assert.equal(itemHistoryStatusLabel(status), "Waiting");
  }

  for (const status of [
    "menunggu_pengiriman",
    "proses_pengiriman",
    "selesai",
    "pending_invoice",
    "invoiced",
  ]) {
    assert.equal(itemHistoryStatus(status), "deal");
    assert.equal(itemHistoryStatusLabel(status), "Deal");
  }

  for (const status of ["cancel", "cancelled"]) {
    assert.equal(itemHistoryStatus(status), "cancel");
    assert.equal(itemHistoryStatusLabel(status), "Cancel");
  }
});

test("item history search covers every displayed business field", () => {
  const row = {
    customerName: "PT Contoh Customer",
    partName: "Filter Oli Mesin",
    partNumber: "PN-12345",
    sphNo: "SPH2609001ABC",
    status: "menunggu_pengiriman",
  };

  for (const query of ["pn-123", "filter oli", "contoh customer", "2609001", "deal"]) {
    assert.equal(itemHistoryMatchesQuery(row, query), true, query);
  }

  assert.equal(itemHistoryMatchesQuery(row, "tidak ada"), false);
  assert.equal(itemHistoryMatchesQuery(row, ""), true);
});

test("item history page merges live and imported rows with price and links only live SPHs", async () => {
  const source = await readFile(new URL("../app/sph/item-history/page.tsx", import.meta.url), "utf8");

  assert.match(source, /\.from\(sphItems\)/);
  assert.match(source, /\.innerJoin\(sphDocuments/);
  assert.match(source, /\.from\(sphImportedItemHistory\)/);
  assert.match(source, /unitPrice: sphItems\.unitPrice/);
  assert.match(source, /unitPrice: sphImportedItemHistory\.unitPrice/);
  assert.match(source, /pageRows\.map\(\(row\)/);
  assert.match(source, /href=\{`\/sph\/edit\/\$\{row\.sphId\}`\}/);
  assert.match(source, /row\.source === "dashboard"/);
  assert.ok(source.indexOf('columnId="c3"') < source.indexOf('columnId="c0"'));
  assert.ok(source.indexOf('columnId="c1"') < source.indexOf('columnId="c6"'));
  assert.ok(source.indexOf('columnId="c6"') < source.indexOf('columnId="c2"'));
  assert.match(source, /tableId="sph-item-history"/);
});
