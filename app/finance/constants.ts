export const FINANCE_CATEGORIES = [
  "Income", "Stock & Penjualan", "Operasional", "Prive/loan", "Komisi",
  "Ongkir", "Refund/reimbursement", "Entertainment", "Biaya bank dan pajak",
] as const;

export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];

export const SGA_CATEGORIES: FinanceCategory[] = [
  "Operasional", "Prive/loan", "Komisi", "Ongkir", "Refund/reimbursement",
  "Entertainment", "Biaya bank dan pajak",
];

export const FINANCE_TABS = [
  { key: "summary", label: "Summary" },
  { key: "sga", label: "SGA" },
  { key: "stock", label: "Stock & Penjualan" },
  { key: "income", label: "Income" },
] as const;

export type FinanceTab = (typeof FINANCE_TABS)[number]["key"];
