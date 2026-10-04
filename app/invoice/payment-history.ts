/** Payment amounts are never inferred from a legacy settlement timestamp. */
export type PaymentAudit = { id: string; createdAt: string; detailsJson: Record<string, unknown> };
export type PaymentSnapshot = { id: string; invoiceDate: string; totalAmount: number; paidAmount: number; status: string; processedAt: string | null };
export type PaymentEvent = {
  version: 1;
  kind: "receipt" | "receipt_correction" | "unallocated_adjustment" | "settlement_date";
  previousEventId: string | null;
  previousPaidAmount: number;
  paidAmount: number;
  paymentId?: string;
  amount?: number;
  paymentDate?: string;
  reason?: string;
  settlesInvoice?: boolean;
};
export type RecordedPayment = { paymentId: string; amount: number; paymentDate: string; corrected: boolean };

export function isCalendarDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function wibDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}
function auditInstant(value: string) {
  return new Date(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : value.replace(" ", "T") + "Z");
}
function auditDate(value: string) {
  const date = auditInstant(value);
  return Number.isFinite(date.getTime()) ? wibDate(date) : null;
}
const amountValid = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function paymentHistoryState(invoice: PaymentSnapshot, logs: PaymentAudit[], observedAt = new Date()) {
  const reasons = new Set<string>();
  if (invoice.status === "done" && invoice.paidAmount < invoice.totalAmount) reasons.add("status_balance_mismatch");
  const nodes = logs.filter(log => "paymentHistory" in log.detailsJson);
  const ordered: Array<{ audit: PaymentAudit; event: PaymentEvent }> = [];
  let previousId: string | null = null;
  while (ordered.length < nodes.length) {
    const candidates = nodes.filter(log => (log.detailsJson.paymentHistory as PaymentEvent)?.previousEventId === previousId && !ordered.some(item => item.audit.id === log.id));
    if (candidates.length !== 1) { reasons.add("broken_event_chain"); break; }
    const audit = candidates[0];
    const event = audit.detailsJson.paymentHistory as PaymentEvent;
    if (event.version !== 1 || !amountValid(event.previousPaidAmount) || !amountValid(event.paidAmount) ||
        !["receipt", "receipt_correction", "unallocated_adjustment", "settlement_date"].includes(event.kind) ||
        (ordered.length > 0 && event.previousPaidAmount !== ordered[ordered.length - 1].event.paidAmount)) {
      reasons.add("invalid_event"); break;
    }
    ordered.push({ audit, event });
    previousId = audit.id;
  }
  const known = new Map<string, RecordedPayment>();
  let settlementPaymentId: string | null = null;
  const baseline = ordered[0]?.event.previousPaidAmount ?? invoice.paidAmount;
  const firstDate = ordered.length ? auditDate(ordered[0].audit.createdAt) : wibDate(observedAt);
  const unresolved: Array<{ amount: number; knownBy: string | null }> = [];
  const legacy = logs.filter(log => !("paymentHistory" in log.detailsJson) && amountValid(log.detailsJson.paidAmount) && log.detailsJson.previousPaidAmount !== log.detailsJson.paidAmount);
  const legacyDates = legacy.map(log => auditDate(log.createdAt)).filter((value): value is string => Boolean(value));
  const latestLegacyDate = legacyDates.sort().at(-1) ?? null;
  // A corrected settlement date may bound an old fully paid balance, but never
  // establishes the amount/date of individual receipts. Later legacy edits win.
  const settlement = invoice.status === "done" && invoice.paidAmount === invoice.totalAmount &&
    isCalendarDate(invoice.processedAt?.slice(0, 10)) ? invoice.processedAt!.slice(0, 10) : null;
  let baselineKnownBy = firstDate;
  const latestLegacy = [...legacy].sort((a, b) => auditInstant(b.createdAt).getTime() - auditInstant(a.createdAt).getTime())[0];
  // A cumulative checkpoint proves a balance by its observation date, not a
  // cash receipt on that date. Use it only if it matches the tracked baseline.
  if (latestLegacy?.detailsJson.paidAmount === baseline) {
    const checkpoint = auditDate(latestLegacy.createdAt);
    if (checkpoint && (!baselineKnownBy || checkpoint < baselineKnownBy)) baselineKnownBy = checkpoint;
  }
  if (settlement) {
    const bound = latestLegacyDate && latestLegacyDate > settlement ? latestLegacyDate : settlement;
    if (!baselineKnownBy || bound < baselineKnownBy) baselineKnownBy = bound;
  }
  if (baseline !== 0) { unresolved.push({ amount: baseline, knownBy: baselineKnownBy }); reasons.add("legacy_unallocated_balance"); }
  if (legacy.some(log => Number(log.detailsJson.paidAmount) > 0)) reasons.add("legacy_payment_changes");
  if (ordered.length && legacy.some(log => auditInstant(log.createdAt).getTime() >= auditInstant(ordered[0].audit.createdAt).getTime())) reasons.add("legacy_change_after_tracking");
  for (const { audit, event } of ordered) {
    const delta = event.paidAmount - event.previousPaidAmount;
    if (event.kind === "receipt") {
      if (!event.paymentId || known.has(event.paymentId) || !amountValid(event.amount) || event.amount <= 0 || event.amount !== delta || !isCalendarDate(event.paymentDate)) { reasons.add("invalid_receipt"); continue; }
      known.set(event.paymentId, { paymentId: event.paymentId, amount: event.amount, paymentDate: event.paymentDate, corrected: false });
      settlementPaymentId = event.settlesInvoice ? event.paymentId : null;
    } else if (event.kind === "receipt_correction") {
      const original = event.paymentId ? known.get(event.paymentId) : null;
      if (!original || !amountValid(event.amount) || !isCalendarDate(event.paymentDate) || delta !== event.amount - original.amount) { reasons.add("invalid_receipt_correction"); continue; }
      known.set(original.paymentId, { ...original, amount: event.amount, paymentDate: event.paymentDate, corrected: true });
    } else if (event.kind === "unallocated_adjustment" && delta !== 0) {
      unresolved.push({ amount: delta, knownBy: auditDate(audit.createdAt) });
      reasons.add("unallocated_balance_correction");
      settlementPaymentId = null;
    } else if (delta !== 0) reasons.add("invalid_event_delta");
  }
  const payments = [...known.values()].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate) || a.paymentId.localeCompare(b.paymentId));
  const knownPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (baseline + ordered.reduce((sum, { event }) => sum + (event.kind === "unallocated_adjustment" ? event.paidAmount - event.previousPaidAmount : 0), 0) + knownPaid !== invoice.paidAmount ||
      (ordered.length && ordered.at(-1)!.event.paidAmount !== invoice.paidAmount)) reasons.add("balance_not_reconciled");
  const invalid = [...reasons].some(reason => !["legacy_unallocated_balance", "legacy_payment_changes", "unallocated_balance_correction"].includes(reason));
  return {
    payments, unresolved, baseline, baselineKnownBy, latestLegacyDate, reasons: [...reasons], valid: !invalid,
    lastEventId: ordered.at(-1)?.audit.id ?? null, settlementPaymentId,
    lastEvent: ordered.at(-1)?.event ?? null,
    status: reasons.size === 0 ? "complete" : payments.length ? "partial" : "unavailable",
    knownPaidAmount: knownPaid,
    unallocatedNetPaidAmount: invoice.paidAmount - knownPaid,
  };
}

export function invoiceMonthlyReport(invoice: PaymentSnapshot, logs: PaymentAudit[], month: string, observedAt = new Date()) {
  const periodStart = `${month}-01`;
  const [year, number] = month.split("-").map(Number);
  const next = new Date(0);
  next.setUTCFullYear(year, number, 1);
  const periodEndExclusive = next.toISOString().slice(0, 10);
  const state = paymentHistoryState(invoice, logs, observedAt);
  const inPeriod = state.payments.filter(payment => payment.paymentDate >= periodStart && payment.paymentDate < periodEndExclusive);
  const knownReceivedInPeriod = inPeriod.reduce((sum, payment) => sum + payment.amount, 0);
  const paidBefore = (cutoff: string): number | null => {
    if (!state.valid || state.unresolved.some(component => component.amount !== 0 && (!component.knownBy || cutoff <= component.knownBy))) return null;
    if (state.reasons.includes("legacy_payment_changes") && (!state.latestLegacyDate || cutoff <= state.latestLegacyDate)) return null;
    return state.unresolved.reduce((sum, component) => sum + component.amount, 0) + state.payments.filter(payment => payment.paymentDate < cutoff).reduce((sum, payment) => sum + payment.amount, 0);
  };
  const remainingBefore = (cutoff: string) => {
    if (invoice.invoiceDate >= cutoff) return 0;
    const paid = paidBefore(cutoff);
    return paid === null ? null : Math.max(invoice.totalAmount - paid, 0);
  };
  const openingRemaining = remainingBefore(periodStart);
  const closingRemaining = remainingBefore(periodEndExclusive);
  const paidAtStart = paidBefore(periodStart);
  const targetAmount = invoice.invoiceDate >= periodEndExclusive ? 0 : paidAtStart === null ? null : Math.max(invoice.totalAmount - paidAtStart, 0);
  const legacyCashUnknown = state.reasons.includes("legacy_payment_changes") && (!state.latestLegacyDate || periodStart <= state.latestLegacyDate);
  const cashflowComplete = state.valid && !legacyCashUnknown && state.unresolved.every(component => component.amount === 0 || (component.knownBy !== null && periodStart > component.knownBy));
  const balanceComplete = targetAmount !== null && openingRemaining !== null && closingRemaining !== null;
  const receivedInPeriod = cashflowComplete ? knownReceivedInPeriod : null;
  const inclusionStatus = invoice.status === "cancelled" ? "exclude" :
    (openingRemaining !== null && openingRemaining > 0) || (closingRemaining !== null && closingRemaining > 0) || knownReceivedInPeriod > 0 ? "include" :
      balanceComplete && cashflowComplete ? "exclude" : "review_required";
  return {
    reportMonth: month, periodStart, periodEndExclusive, timeZone: "Asia/Jakarta", evaluatedAt: observedAt.toISOString(),
    periodEnded: wibDate(observedAt) >= periodEndExclusive, balanceBasis: "current_invoice_total",
    targetAmount, openingRemaining, closingRemaining, receivedInPeriod, knownReceivedInPeriod, paymentsInPeriod: inPeriod,
    cashflowComplete, balanceComplete, historyComplete: cashflowComplete && balanceComplete,
    historyStatus: state.status, historyReasons: state.reasons,
    knownPaidAmount: state.knownPaidAmount, unallocatedNetPaidAmount: state.unallocatedNetPaidAmount,
    inclusionStatus,
  };
}
