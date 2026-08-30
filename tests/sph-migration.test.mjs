import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

async function loadMigrationModule() {
  const source = await readFile(
    new URL("../app/sph/list/migration.ts", import.meta.url),
    "utf8"
  );
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const context = {
    exports: {},
    module: { exports: {} },
    require,
  };

  context.exports = context.module.exports;
  vm.runInNewContext(transpiled, context);
  return context.module.exports;
}

function baseDocument(overrides = {}) {
  return {
    customerCode: "ABC",
    id: "sph-1",
    mm: "08",
    paymentTerm: "TOP 14",
    sphDate: "2026-08-31",
    sphNo: "SPH2608001ABC",
    status: "cek_harga",
    yy: "26",
    ...overrides,
  };
}

test("rejects an empty migration selection", async () => {
  const { buildSphMigrationUpdates } = await loadMigrationModule();

  assert.throws(
    () =>
      buildSphMigrationUpdates({
        documents: [],
        latestSequence: 0,
        targetMonth: "2026-09",
      }),
    /Pilih minimal satu SPH/
  );
});

test("rejects invalid target months", async () => {
  const { assertValidTargetMonth, buildSphMigrationUpdates } =
    await loadMigrationModule();

  assert.throws(() => assertValidTargetMonth("2026-13"), /Bulan tujuan migrasi/);
  assert.throws(
    () =>
      buildSphMigrationUpdates({
        documents: [baseDocument()],
        latestSequence: 0,
        targetMonth: "September 2026",
      }),
    /Bulan tujuan migrasi/
  );
});

test("rejects non-migratable SPH statuses", async () => {
  const { buildSphMigrationUpdates } = await loadMigrationModule();

  assert.throws(
    () =>
      buildSphMigrationUpdates({
        documents: [baseDocument({ status: "selesai" })],
        latestSequence: 0,
        targetMonth: "2026-09",
      }),
    /tidak bisa dimigrasi/
  );
});

test("rejects SPH already in the target month", async () => {
  const { buildSphMigrationUpdates } = await loadMigrationModule();

  assert.throws(
    () =>
      buildSphMigrationUpdates({
        documents: [baseDocument({ mm: "09", sphDate: "2026-09-10" })],
        latestSequence: 3,
        targetMonth: "2026-09",
      }),
    /sudah berada di bulan tujuan/
  );
});

test("builds migrated numbers and keeps end-of-month dates valid", async () => {
  const { buildSphMigrationUpdates } = await loadMigrationModule();
  const [update] = buildSphMigrationUpdates({
    documents: [baseDocument()],
    latestSequence: 7,
    targetMonth: "2026-09",
  });

  assert.deepEqual(JSON.parse(JSON.stringify(update)), {
    id: "sph-1",
    invoiceNo: "INV2609008ABC",
    paymentDueDate: "2026-10-14",
    sequence: 8,
    sphDate: "2026-09-30",
    sphNo: "SPH2609008ABC",
  });
});
