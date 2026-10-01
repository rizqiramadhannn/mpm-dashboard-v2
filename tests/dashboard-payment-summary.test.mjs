import assert from "node:assert/strict";
import test from "node:test";
import { completedDeliveryDates, summarizeMonthlyPayments } from "../app/dashboard/payment-summary.ts";

const invoice = (overrides = {}) => ({
  createdAt: "2026-09-20 00:00:00",
  invoiceDate: "2026-09-20",
  paidAmount: 100,
  paymentDueDate: null,
  paymentTerm: "TOP 10 HARI",
  processedAt: "2026-09-30T12:00:00.000Z",
  sphId: "sph-1",
  status: "done",
  totalAmount: 100,
  ...overrides,
});

test("monthly payments use the Jakarta settlement month and classify due date inclusively", () => {
  const result = summarizeMonthlyPayments([
    invoice({ processedAt: "2026-09-30T17:00:00.000Z", paymentDueDate: "2026-10-01" }),
    invoice({ processedAt: "2026-10-01T17:00:00.000Z", paymentDueDate: "2026-10-01" }),
    invoice({ invoiceDate: "2026-09-15", processedAt: "2026-09-30T17:00:00.000Z", paymentDueDate: null }),
  ], "2026-10");

  assert.deepEqual(result["On Due"], { amount: 100, count: 1 });
  assert.deepEqual(result.Overdue, { amount: 200, count: 2 });
});

test("CBD has two Jakarta calendar days after creation; late payment is overdue", () => {
  const result = summarizeMonthlyPayments([
    invoice({ createdAt: "2026-09-30 17:00:00", paymentTerm: "CBD", processedAt: "2026-10-03T16:59:59.000Z" }),
    invoice({ createdAt: "2026-09-30 17:00:00", paymentTerm: "CBD", processedAt: "2026-10-03T17:00:00.000Z" }),
    invoice({ createdAt: "2026-10-01 00:00:00", paymentTerm: "CBD", processedAt: "2026-10-02T02:00:00.000Z", paidAmount: 120 }),
    invoice({ createdAt: "2026-10-01 00:00:00", paymentTerm: "CBD", processedAt: "2026-10-02T02:00:00.000Z", paidAmount: 50 }),
  ], "2026-10");

  assert.deepEqual(result.CBD, { amount: 200, count: 2 });
  assert.deepEqual(result.Overdue, { amount: 100, count: 1 });
});

test("COD deadline starts when every SPH item quantity is received", () => {
  const items = [
    { id: "item-1", sphId: "sph-1", quantity: 3 },
    { id: "item-2", sphId: "sph-1", quantity: 1 },
    { id: "item-3", sphId: "sph-2", quantity: 1 },
  ];
  const journeys = [
    { sphItemId: "item-1", quantity: 1, customerReceived: true, customerReceivedAt: "2026-10-01T02:00:00Z" },
    { sphItemId: "item-1", quantity: 2, customerReceived: true, customerReceivedAt: "2026-10-02T02:00:00Z" },
    { sphItemId: "item-2", quantity: 1, customerReceived: true, customerReceivedAt: "2026-10-03T02:00:00Z" },
    { sphItemId: "item-3", quantity: 1, customerReceived: false, customerReceivedAt: null },
  ];
  const completed = completedDeliveryDates(items, journeys);
  assert.equal(completed.get("sph-1"), "2026-10-03");
  assert.equal(completed.has("sph-2"), false);

  const result = summarizeMonthlyPayments([
    invoice({ paymentTerm: "COD", processedAt: "2026-10-04T02:00:00Z" }),
    invoice({ paymentTerm: "COD", processedAt: "2026-10-05T16:59:59Z" }),
    invoice({ paymentTerm: "COD", processedAt: "2026-10-05T17:00:00Z" }),
    invoice({ sphId: "sph-2", paymentTerm: "COD", processedAt: "2026-10-04T02:00:00Z" }),
  ], "2026-10", completed);

  assert.deepEqual(result.COD, { amount: 300, count: 3 });
  assert.deepEqual(result.Overdue, { amount: 100, count: 1 });
});
