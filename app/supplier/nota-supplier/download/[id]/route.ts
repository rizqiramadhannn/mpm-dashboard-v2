import { NextResponse } from "next/server";
import { getSupplierNoteFile } from "../../../notes/data";

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
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const noteId = Number(id);

  if (!Number.isInteger(noteId) || noteId <= 0) {
    return NextResponse.json({ error: "Nota tidak valid." }, { status: 400 });
  }

  const file = await getSupplierNoteFile(noteId);

  if (!file || !file.sourceFileBase64) {
    return NextResponse.json({ error: "File nota tidak ditemukan." }, { status: 404 });
  }

  const fileName = safeFileName(file.sourceFileName, `${file.noteNo}.pdf`);
  const mimeType = file.sourceFileMimeType || "application/octet-stream";

  return new Response(base64ToBytes(file.sourceFileBase64), {
    headers: {
      "content-disposition": `attachment; filename="${fileName}"`,
      "content-type": mimeType,
    },
  });
}
