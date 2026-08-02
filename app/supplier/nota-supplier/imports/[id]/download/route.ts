import { NextResponse } from "next/server";
import { getSupplierNoteImportFile } from "../../../../notes/data";

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function safeFileName(fileName: string, fallback: string) {
  const cleaned = fileName.replace(/[\\/:*?"<>|]+/g, "-").trim();

  return cleaned || fallback;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const inline = searchParams.get("inline") === "1";
  const file = await getSupplierNoteImportFile(id);

  if (!file?.base64) {
    return NextResponse.json({ error: "File pending nota tidak ditemukan." }, { status: 404 });
  }

  const fileName = safeFileName(file.fileName, `${file.flag}-pending-nota.pdf`);
  const disposition = inline ? "inline" : "attachment";

  return new Response(base64ToBytes(file.base64), {
    headers: {
      "content-disposition": `${disposition}; filename="${fileName}"`,
      "content-type": file.mimeType || "application/octet-stream",
    },
  });
}
