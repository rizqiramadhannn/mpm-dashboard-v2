import assert from "node:assert/strict";
import test from "node:test";
import { invoicePaymentTimestamp } from "../app/invoice/payment-date.ts";
import { summarizeMonthlyPayments } from "../app/dashboard/payment-summary.ts";

test("payment date rejects impossible dates and malformed payloads", () => {
  for (const value of [null, undefined, 20260930, "", "30/09/2026", "2026-02-29", "2026-04-31", "2026-13-01", "2026-09-30T00:00:00Z", "1899-12-31"]) {
    assert.throws(() => invoicePaymentTimestamp(value), /Tanggal bayar tidak valid/);
  }
  assert.equal(invoicePaymentTimestamp("2024-02-29"), "2024-02-29T00:00:00.000Z");
});

test("backdated payment moves the dashboard amount to the actual month and due category", () => {
  const invoice = {
    createdAt: "2026-09-01T00:00:00.000Z", invoiceDate: "2026-09-01",
    paidAmount: 100, paymentDueDate: "2026-09-30", paymentTerm: "TOP 30",
    processedAt: "2026-10-02T00:00:00.000Z", sphId: "sph-1", status: "done", totalAmount: 100,
  };
  assert.equal(summarizeMonthlyPayments([invoice], "2026-10").Overdue.amount, 100);
  const corrected = { ...invoice, processedAt: invoicePaymentTimestamp("2026-09-30") };
  assert.equal(summarizeMonthlyPayments([corrected], "2026-09")["On Due"].amount, 100);
  assert.equal(summarizeMonthlyPayments([corrected], "2026-10").Overdue.amount, 0);
});
