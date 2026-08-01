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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = new URL(request.url).searchParams;
  const fileType =
    searchParams.get("type") === "paymentProof" ? "paymentProof" : "invoice";
  const fileIndex = Number(searchParams.get("index") ?? "0");
  const disposition = searchParams.get("inline") === "1" ? "inline" : "attachment";

  if (!id) {
    return NextResponse.json({ error: "Nota tidak valid." }, { status: 400 });
  }

  const file = await getSupplierNoteFile(
    id,
    fileType,
    Number.isFinite(fileIndex) ? fileIndex : 0
  );

  if (!file || (!file.base64 && !file.url)) {
    return NextResponse.json({ error: "File nota tidak ditemukan." }, { status: 404 });
  }

  if (file.url && !file.base64) {
    return NextResponse.redirect(file.url);
  }

  const fileName = safeFileName(file.fileName, `${file.noteNo}.pdf`);
  const mimeType = file.mimeType || "application/octet-stream";

  return new Response(base64ToBytes(file.base64), {
    headers: {
      "content-disposition": `${disposition}; filename="${fileName}"`,
      "content-type": mimeType,
    },
  });
}
