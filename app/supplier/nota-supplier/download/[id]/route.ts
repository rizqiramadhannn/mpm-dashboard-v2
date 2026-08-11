import { NextResponse } from "next/server";
import { getSupplierNoteFile } from "../../../notes/data";

export const dynamic = "force-dynamic";

function base64ToBytes(base64: string) {
  const cleanBase64 = base64
    .replace(/^data:[^;]+;base64,/, "")
    .replace(/\s/g, "");
  const chunkSize = 0x8000;
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  for (let index = 0; index < cleanBase64.length; index += chunkSize) {
    const binary = atob(cleanBase64.slice(index, index + chunkSize));
    const chunk = new Uint8Array(binary.length);

    for (let byteIndex = 0; byteIndex < binary.length; byteIndex += 1) {
      chunk[byteIndex] = binary.charCodeAt(byteIndex);
    }

    chunks.push(chunk);
    byteLength += chunk.length;
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  return bytes;
}

function safeFileName(fileName: string, fallback: string) {
  const cleaned = fileName.replace(/[\\/:*?"<>|]+/g, "-").trim();
  return cleaned || fallback;
}

function contentDisposition(disposition: "attachment" | "inline", fileName: string) {
  const asciiFileName = fileName.replace(/[^\x20-\x7E]+/g, "-").replace(/"+/g, "-");
  const encodedFileName = encodeURIComponent(fileName);

  return `${disposition}; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`;
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
      "cache-control": "no-store",
      "content-disposition": contentDisposition(disposition, fileName),
      "content-type": mimeType,
    },
  });
}
