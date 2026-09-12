import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "../../../../db";
import { getCurrentUser } from "../../../auth";
import { ManualNoteError } from "../model";
import { createManualNote } from "../storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Silakan login kembali." }, { status: 401 });
  if (user.mustChangePassword) return NextResponse.json({ error: "Ubah password terlebih dahulu." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Origin request tidak valid." }, { status: 403 });
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "JSON request tidak valid." }, { status: 400 }); }
  try {
    const note = await createManualNote(await getDb(), payload, { ...user, ipAddress: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown" });
    revalidatePath("/supplier/nota-manual");
    revalidatePath("/supplier/nota-supplier");
    return NextResponse.json({ data: note }, { status: note.reused ? 200 : 201 });
  } catch (error) {
    if (error instanceof ManualNoteError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Manual note creation failed", error);
    return NextResponse.json({ error: "Gagal menyimpan nota. Silakan coba kembali; request yang sama tidak membuat nota ganda." }, { status: 500 });
  }
}
