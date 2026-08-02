import { NextResponse } from "next/server";
import { importSupplierNoteFromJson } from "../../../../supplier/notes/data";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const note = await importSupplierNoteFromJson(id, payload);

    return NextResponse.json({ data: note }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal import JSON nota.";
    const status =
      message.includes("tidak ditemukan") ? 404 : message.includes("sudah ada") ? 409 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
