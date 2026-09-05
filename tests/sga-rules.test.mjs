import assert from "node:assert/strict";
import test from "node:test";
import { isInternalJagoTransfer } from "../app/sga/rules.ts";

const internalJagoDestinations = [
  "JAGO ONGKIR",
  "JAGO/RYAN",
  "REK JAGO OPERASIONAL",
  "DANA JAGO MPM",
  "JAGO POCKET RIYAN",
  "JAGO DANA MPM",
  "POKET JAGO DANA MPM",
  "Jago Pocket Riyan",
];

test("excludes transfers from BCA MPM to JAGO accounts", () => {
  for (const destination of internalJagoDestinations) {
    assert.equal(
      isInternalJagoTransfer("BCA MPM", destination),
      true,
      destination
    );
  }
});

test("matches harmless source and destination formatting variations", () => {
  assert.equal(isInternalJagoTransfer("  bca-mpm ", "rek. jago operasional"), true);
});

test("keeps external expenses and non-BCA transfers in SGA", () => {
  assert.equal(isInternalJagoTransfer("BCA MPM", "BCA SUPPLIER"), false);
  assert.equal(isInternalJagoTransfer("JAGO MPM", "JAGO ONGKIR"), false);
  assert.equal(isInternalJagoTransfer("BCA MPM", "JAGODA SHOP"), false);
});
