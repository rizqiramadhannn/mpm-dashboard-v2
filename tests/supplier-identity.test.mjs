import assert from "node:assert/strict";
import test from "node:test";
import { canonicalSupplierName, normalizeSupplierName } from "../app/supplier/identity.ts";

test("ANHAR MALIK and HAMZAH resolve to the same supplier identity", () => {
  for (const alias of ["ANHAR MALIK", "Hamzah", "ANHAR MALIK / HAMZAH"]) {
    assert.equal(normalizeSupplierName(alias), "ANHAR MALIK HAMZAH");
    assert.equal(canonicalSupplierName(alias), "ANHAR MALIK / HAMZAH");
  }
  assert.equal(normalizeSupplierName("PT SANY HEAVY INDUSTRY INDONESIA"), "SANY HEAVY INDUSTRY INDONESIA");
});
