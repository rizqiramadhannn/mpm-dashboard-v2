import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "../../../../db";
import { validateSupplierNotesApiToken } from "../../../supplier-notes-api-auth";
import { ManualNoteError } from "../../../supplier/nota-manual/model";
import { createManualNote } from "../../../supplier/nota-manual/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const valid = await validateSupplierNotesApiToken(request.headers.get("authorization"), process.env.SUPPLIER_NOTES_API_TOKEN_SHA256, process.env.SUPPLIER_NOTES_API_TOKEN_EXPIRES_AT);
  if (!valid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "JSON request tidak valid." }, { status: 400 }); }
  try {
    const note = await createManualNote(await getDb(), payload, {
      id: null, username: "supplier-notes-api",
      ipAddress: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown",
    });
    revalidatePath("/supplier/nota-manual");
    revalidatePath("/supplier/nota-supplier");
    return NextResponse.json({ data: note }, { status: note.reused ? 200 : 201 });
  } catch (error) {
    if (error instanceof ManualNoteError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Manual API note creation failed");
    return NextResponse.json({ error: "Gagal menyimpan nota; rekonsiliasi dengan key yang sama." }, { status: 500 });
  }
}
