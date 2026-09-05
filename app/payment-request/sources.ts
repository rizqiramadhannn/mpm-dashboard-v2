export const PAYMENT_REQUEST_SOURCES = [
  "BCA MPM",
  "JAGO OPERASIONAL MPM",
  "JAGO DANA MPM",
] as const;

export type PaymentRequestSource = (typeof PAYMENT_REQUEST_SOURCES)[number];

export function isPaymentRequestSource(value: string): value is PaymentRequestSource {
  return PAYMENT_REQUEST_SOURCES.includes(value as PaymentRequestSource);
}
