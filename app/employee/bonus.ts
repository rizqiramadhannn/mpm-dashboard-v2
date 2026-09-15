import { and, gte, lt, ne, eq } from "drizzle-orm";
import type { getDb } from "../../db";
import { invoiceDocuments, sphDocuments } from "../../db/schema";
import { isInvoiceEligibleSph } from "../sph/workflow";

const MAX_OMSET_BONUS = 1_000_000;

function previousMonthRange(salaryMonth: string) {
  const [year, month] = salaryMonth.split("-").map(Number);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const nextMonth = previousMonth === 12 ? 1 : previousMonth + 1;
  const nextYear = previousMonth === 12 ? previousYear + 1 : previousYear;

  return {
    from: `${previousYear}-${String(previousMonth).padStart(2, "0")}-01`,
    to: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}


/** Payroll uses the previous month's active invoice turnover, including unpaid invoices. */
export async function getInvoiceOmset(db: Awaited<ReturnType<typeof getDb>>, salaryMonth: string) {
  const range = previousMonthRange(salaryMonth);
  const rows = await db.select({ totalAmount: invoiceDocuments.totalAmount, sphStatus: sphDocuments.status })
    .from(invoiceDocuments)
    .innerJoin(sphDocuments, eq(invoiceDocuments.sphId, sphDocuments.id))
    .where(and(gte(invoiceDocuments.invoiceDate, range.from), lt(invoiceDocuments.invoiceDate, range.to), ne(invoiceDocuments.status, "cancelled")));
  return rows.reduce((sum, row) => isInvoiceEligibleSph(row.sphStatus) ? sum + row.totalAmount : sum, 0);
}

export function calculateOmsetBonus(omset: number) {
  return Math.min(MAX_OMSET_BONUS, Math.round((omset * 0.01) / 4));
}

