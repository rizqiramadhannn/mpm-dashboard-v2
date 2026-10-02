export function invoicePaymentTimestamp(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01") {
    throw new Error("Tanggal bayar tidak valid.");
  }

  const timestamp = `${value}T00:00:00.000Z`;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Tanggal bayar tidak valid.");
  }
  return timestamp;
}
