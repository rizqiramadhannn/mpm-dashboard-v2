export const PAYMENT_REQUEST_CATEGORIES = [
  "Beli Barang / Spare Part",
  "Ongkir / Pengiriman",
  "Komisi & Bagi Hasil",
  "Gaji & Karyawan",
  "Biaya Operasional",
  "Dana Masuk/Keluar Lainnya",
  "Lain-lain",
] as const;

export type PaymentRequestCategory = (typeof PAYMENT_REQUEST_CATEGORIES)[number];

export function isPaymentRequestCategory(
  value: string
): value is PaymentRequestCategory {
  return PAYMENT_REQUEST_CATEGORIES.includes(value as PaymentRequestCategory);
}
