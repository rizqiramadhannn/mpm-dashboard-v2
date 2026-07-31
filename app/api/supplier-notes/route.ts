import { NextResponse } from "next/server";
import { createSupplierNote, listSupplierNotes } from "../../supplier/notes/data";

export const dynamic = "force-dynamic";

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

async function payloadFromRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const payloadValue = formData.get("payload");
    const payload =
      typeof payloadValue === "string" && payloadValue.trim()
        ? JSON.parse(payloadValue)
        : Object.fromEntries(formData.entries());
    const file = formData.get("file");

    if (file instanceof File) {
      payload.file = {
        name: file.name,
        mimeType: file.type,
        size: file.size,
        base64: arrayBufferToBase64(await file.arrayBuffer()),
      };
    }

    return payload;
  }

  return request.json();
}

export async function GET() {
  const notes = await listSupplierNotes();

  return NextResponse.json({
    data: notes.map((note) => ({
      ...note,
      hasFile: Boolean(note.sourceFileName),
      downloadUrl: note.sourceFileName
        ? `/supplier/nota-supplier/download/${note.id}`
        : null,
    })),
  });
}

export async function POST(request: Request) {
  try {
    const payload = await payloadFromRequest(request);
    const note = await createSupplierNote(payload);

    return NextResponse.json(
      {
        data: {
          ...note,
          downloadUrl: `/supplier/nota-supplier/download/${note.id}`,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan nota.";
    const status = message.includes("sudah ada") ? 409 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
