import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { customers, suppliers } from "../../../../db/schema";
import { revalidatePath } from "next/cache";
import { validateSupplierNotesApiToken } from "../../../supplier-notes-api-auth";
import { createApiSupplier } from "../../../supplier/nota-manual/supplier-storage";
import { ManualNoteError } from "../../../supplier/nota-manual/model";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const valid = await validateSupplierNotesApiToken(request.headers.get("authorization"), process.env.SUPPLIER_NOTES_API_TOKEN_SHA256, process.env.SUPPLIER_NOTES_API_TOKEN_EXPIRES_AT);
  if (!valid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "JSON request tidak valid." }, { status: 400 }); }
  try {
    const data = await createApiSupplier(await getDb(), payload, request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown");
    revalidatePath("/supplier/nota-manual");
    revalidatePath("/supplier/supplier-list");
    return NextResponse.json({ data }, { status: data.reused ? 200 : 201 });
  } catch (error) {
    if (error instanceof ManualNoteError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("API supplier creation failed");
    return NextResponse.json({ error: "Gagal membuat supplier; periksa master sebelum retry." }, { status: 500 });
  }
}

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
