import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "../../../../../../db";
import { validateSupplierNotesApiToken } from "../../../../../supplier-notes-api-auth";
import { ManualNoteError } from "../../../../../supplier/nota-manual/model";
import { reopenManualNoteAsUnpaid } from "../../../../../supplier/nota-manual/payment-storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await validateSupplierNotesApiToken(request.headers.get("authorization"), process.env.SUPPLIER_NOTES_API_TOKEN_SHA256, process.env.SUPPLIER_NOTES_API_TOKEN_EXPIRES_AT)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "JSON tidak valid." }, { status: 400 }); }
  try {
    const { id } = await context.params;
    const data = await reopenManualNoteAsUnpaid(await getDb(), id, payload, request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown");
    revalidatePath("/supplier/nota-manual");
    revalidatePath("/supplier/nota-supplier");
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ManualNoteError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Manual note reopen failed");
    return NextResponse.json({ error: "Gagal memulihkan nota; rekonsiliasi sebelum retry." }, { status: 500 });
  }
}
