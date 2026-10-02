import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(["next/cache", "next/server"].includes(specifier) ? `${specifier}.js` : specifier, context);
} });

let user;
let invoice;
let saved;
let audit;
const db = {
  select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => [invoice] }) }) }) }),
  update: () => ({ set: (values) => ({ where: async () => { saved = values; } }) }),
};
mock.module("../db/index.ts", { namedExports: { getDb: async () => db } });
mock.module("../app/auth.ts", { namedExports: {
  getCurrentUser: async () => user,
  recordActivityLog: async (entry) => { audit = entry; },
} });
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });
mock.module("next/server", { namedExports: { NextResponse: { json: (body, init) => Response.json(body, init) } } });
const { PATCH } = await import("../app/api/invoices/route.ts");

function reset() {
  user = { id: "admin", role: "superadmin", username: "superadmin" };
  invoice = { sphStatus: "selesai", status: "done", totalAmount: 100, processedAt: "2026-10-02T12:00:00.000Z", paymentProofFilesJson: [] };
  saved = undefined;
  audit = undefined;
}
const patch = (payload) => PATCH(new Request("http://localhost/api/invoices", {
  method: "PATCH", headers: { "content-type": "application/json" },
  body: JSON.stringify({ id: "inv-1", ...payload }),
}));

test("only admins may correct a payment date, including via direct API calls", async () => {
  for (const actor of [null, { username: "user", role: "user" }]) {
    reset(); user = actor;
    assert.equal((await patch({ paymentDate: "2026-09-30" })).status, 403);
    assert.equal(saved, undefined);
  }
});

test("admin correction persists and audits the previous and actual payment date", async () => {
  reset();
  const response = await patch({ paymentDate: "2026-09-30" });
  assert.equal(response.status, 200);
  assert.deepEqual(saved, { processedAt: "2026-09-30T00:00:00.000Z" });
  assert.equal((await response.json()).data.processedAt, saved.processedAt);
  assert.equal(audit.details.previousPaymentDate, "2026-10-02T12:00:00.000Z");
  assert.equal(audit.details.paymentDate, saved.processedAt);
});

test("unpaid invoices and impossible dates cannot be changed", async () => {
  reset(); invoice.status = "pending";
  assert.equal((await patch({ paymentDate: "2026-09-30" })).status, 400);
  assert.equal(saved, undefined);
  reset();
  assert.equal((await patch({ paymentDate: "2026-02-30" })).status, 400);
  assert.equal(saved, undefined);
});

test("late proof uploads and paid amount updates preserve the corrected date", async () => {
  reset(); invoice.processedAt = "2026-09-30T00:00:00.000Z";
  assert.equal((await patch({ paidAmount: 100 })).status, 200);
  assert.equal(saved.processedAt, invoice.processedAt);
  saved = undefined;
  assert.equal((await patch({ paymentProofFiles: [{ name: "proof.pdf", base64: "abc" }] })).status, 200);
  assert.equal(saved.processedAt, undefined);
});
