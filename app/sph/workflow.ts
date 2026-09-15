/** Shared eligibility for invoice views, credit usage and shipment creation. */
export function normalizedSphStatus(status: string) {
  const aliases: Record<string, string> = {
    cancelled: "cancel", draft: "cek_harga",
    invoiced: "menunggu_pengiriman", pending_invoice: "menunggu_pengiriman",
  };
  return aliases[status] ?? status;
}

export function isInvoiceEligibleSph(status: string) {
  return ["menunggu_pengiriman", "proses_pengiriman", "selesai"].includes(normalizedSphStatus(status));
}

export function monthlyOutstandingAmount(
  sphs: { id: string; status: string; sphDate: string | null; totalAmount: number }[],
  invoices: { sphId: string; status: string; invoiceDate: string | null; totalAmount: number; paidAmount: number }[],
  month: string,
) {
  const bySph = new Map(invoices.map(invoice => [invoice.sphId, invoice]));
  return sphs.reduce((sum, sph) => {
    if (!isInvoiceEligibleSph(sph.status)) return sum;
    const invoice = bySph.get(sph.id);
    if (invoice) {
      return !["done", "cancelled"].includes(invoice.status) && invoice.invoiceDate?.startsWith(month)
        ? sum + Math.max(invoice.totalAmount - invoice.paidAmount, 0) : sum;
    }
    return sph.sphDate?.startsWith(month) ? sum + sph.totalAmount : sum;
  }, 0);
}
