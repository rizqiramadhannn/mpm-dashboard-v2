import assert from "node:assert/strict";
import test from "node:test";
import { parseHiddenColumns, validHiddenColumns, tableCookieName, tablePreferenceCookie } from "../app/components/tablePreferences.ts";
import { TABLE_COLUMNS, CONFIGURABLE_TABLE_IDS } from "../app/components/tableDefinitions.ts";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

test("missing/malformed preferences default to all columns; unknown IDs are ignored", () => {
  assert.deepEqual(parseHiddenColumns(""), []);
  assert.deepEqual(parseHiddenColumns("broken.cookie"), []);
  assert.deepEqual(parseHiddenColumns("c1.c1.c2"), ["c1", "c2"]);
  const columns = [{ id: "c0", label: "Date" }, { id: "c1", label: "Name" }];
  assert.deepEqual(validHiddenColumns(["c1", "c99"], columns), ["c1"]);
  assert.deepEqual(validHiddenColumns(["c0", "c1"], columns), []);
  assert.deepEqual(validHiddenColumns(["c1"], [...columns, { id: "c2", label: "New" }]), ["c1"]);
});

test("preferences are isolated by account and table and use one-year secure cookies", () => {
  assert.notEqual(tableCookieName("accountA", "invoices"), tableCookieName("accountB", "invoices"));
  assert.notEqual(tableCookieName("accountA", "invoices"), tableCookieName("accountA", "sph-list"));
  assert.match(tablePreferenceCookie("accountA", "invoices", ["c1"], true), /=c1; Max-Age=31536000; Path=\/; SameSite=Lax; Secure$/);
  assert.match(tablePreferenceCookie("accountA", "invoices", [], false), /Max-Age=0/);
  assert.throws(() => tableCookieName("account;bad", "invoices"));
});

test("each table has stable unique IDs, named columns, and compact cookie storage", () => {
  let total = 0;
  for (const [id, columns] of Object.entries(TABLE_COLUMNS)) {
    assert.equal(new Set(columns.map(column => column.id)).size, columns.length, id);
    assert.ok(columns.every(column => column.label && /^c\d+$/.test(column.id)), id);
    total += tablePreferenceCookie("0123456789abcdef", id, columns.slice(1).map(column => column.id), true).split(";")[0].length + 2;
  }
  assert.ok(total < 4096, `Worst-case cookies total ${total} bytes`);
});

test("column selection exists only on registered list pages", async () => {
  const expected = ["invoices", "sph-item-history", "sph-list", "supplier-items", "supplier-notes"];
  assert.deepEqual([...CONFIGURABLE_TABLE_IDS].sort(), expected);
  const actual = [];
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await inspect(path);
      else if (entry.name.endsWith(".tsx") && entry.name !== "ConfigurableTable.tsx") {
        const source = await readFile(path, "utf8");
        for (const match of source.matchAll(/<ConfigurableTable tableId="([^"]+)"/g)) actual.push(match[1]);
        if (/nota-manual|ImportControls|ItemListModal|CreateSphForm/.test(path)) assert.doesNotMatch(source, /<TableColumnPicker|<ConfigurableTable/, path);
      }
    }
  }
  await inspect("app");
  assert.deepEqual(actual.sort(), expected);
});
