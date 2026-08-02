import { NextResponse } from "next/server";
import {
  createSupplierNoteImport,
  listPendingSupplierNoteImports,
} from "../../supplier/notes/data";

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

export async function GET() {
  const imports = await listPendingSupplierNoteImports();

  return NextResponse.json({ data: imports });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const customerId = formData.get("customerId");
    const customerName = formData.get("customerName");
    const file = formData.get("file");
    const flag = formData.get("flag");
    const paymentTerm = formData.get("paymentTerm");
    const purchasePurpose = formData.get("purchasePurpose");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File nota wajib diupload." }, { status: 400 });
    }

    const pendingImport = await createSupplierNoteImport({
      customerId,
      customerName,
      file: {
        base64: arrayBufferToBase64(await file.arrayBuffer()),
        mimeType: file.type,
        name: file.name,
        size: file.size,
      },
      flag,
      paymentTerm,
      purchasePurpose,
    });

    return NextResponse.json({ data: pendingImport }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal upload nota.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
