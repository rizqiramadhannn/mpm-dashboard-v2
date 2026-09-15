import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { customers, suppliers } from "../../../../db/schema";

export const dynamic = "force-dynamic";

// Only fields needed for nota matching. No seeding or contact/bank details.
export async function GET() {
  const db = await getDb();
  const [supplierRows, customerRows] = await Promise.all([
    db.select({ id: suppliers.id, name: suppliers.name, defaultPaymentTerm: suppliers.defaultPaymentTerm })
      .from(suppliers).orderBy(asc(suppliers.name)),
    db.select({ id: customers.id, code: customers.code, name: customers.name, defaultPaymentTerm: customers.defaultPaymentTerm })
      .from(customers).orderBy(asc(customers.name)),
  ]);
  return NextResponse.json({ suppliers: supplierRows, customers: customerRows }, { headers: { "Cache-Control": "no-store" } });
}
