import { NextResponse } from "next/server";
import {
  createSupplierNote,
  listSupplierNotes,
  updateSupplierNoteFiles,
  updateSupplierNotePaidAmount,
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
    const invoiceFile = formData.get("invoiceFile");
    const paymentProofFile = formData.get("paymentProofFile");
    const paymentProofFiles = formData
      .getAll("paymentProofFiles")
      .filter((value): value is File => value instanceof File);

    if (file instanceof File) {
      payload.file = {
        name: file.name,
        mimeType: file.type,
        size: file.size,
        base64: arrayBufferToBase64(await file.arrayBuffer()),
      };
    }

    if (invoiceFile instanceof File) {
      payload.invoiceFile = {
        name: invoiceFile.name,
        mimeType: invoiceFile.type,
        size: invoiceFile.size,
        base64: arrayBufferToBase64(await invoiceFile.arrayBuffer()),
      };
    }

    if (paymentProofFile instanceof File) {
      payload.paymentProofFile = {
        name: paymentProofFile.name,
        mimeType: paymentProofFile.type,
        size: paymentProofFile.size,
        base64: arrayBufferToBase64(await paymentProofFile.arrayBuffer()),
      };
    }

    if (paymentProofFiles.length > 0) {
      payload.paymentProofFiles = await Promise.all(
        paymentProofFiles.map(async (proofFile) => ({
          name: proofFile.name,
          mimeType: proofFile.type,
          size: proofFile.size,
          base64: arrayBufferToBase64(await proofFile.arrayBuffer()),
        }))
      );
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
      hasInvoice: Boolean(note.invoiceFileName || note.invoiceFileUrl),
      hasPaymentProof: note.paymentProofFiles.length > 0,
      invoicePreviewUrl:
        note.invoiceFileName || note.invoiceFileUrl
          ? `/supplier/nota-supplier/download/${note.id}?type=invoice&inline=1`
          : null,
      paymentProofPreviewUrl:
        note.paymentProofFiles.length > 0
          ? `/supplier/nota-supplier/download/${note.id}?type=paymentProof&inline=1`
          : null,
      hasFile: Boolean(note.invoiceFileName || note.invoiceFileUrl),
      downloadUrl:
        note.invoiceFileName || note.invoiceFileUrl
          ? `/supplier/nota-supplier/download/${note.id}?type=invoice`
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
          invoicePreviewUrl: `/supplier/nota-supplier/download/${note.id}?type=invoice&inline=1`,
          paymentProofPreviewUrl: `/supplier/nota-supplier/download/${note.id}?type=paymentProof&inline=1`,
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

export async function PATCH(request: Request) {
  try {
    const payload = await payloadFromRequest(request);
    const id = typeof payload.id === "string" ? payload.id.trim() : "";

    if (!id) {
      return NextResponse.json({ error: "Nota tidak valid." }, { status: 400 });
    }

    const paymentProofFiles =
      payload.paymentProofFiles ??
      (payload.paymentProofFile ? [payload.paymentProofFile] : undefined);
    const hasFileUpload = Boolean(payload.invoiceFile || paymentProofFiles);
    const fileUpdate = hasFileUpload
      ? await updateSupplierNoteFiles(id, {
          invoiceFile: payload.invoiceFile,
          paymentProofFiles,
        })
      : null;
    const paymentUpdate =
      "paidAmount" in payload
        ? await updateSupplierNotePaidAmount(id, payload.paidAmount)
        : null;

    return NextResponse.json({ data: { ...fileUpdate, ...paymentUpdate, id } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mengubah nota supplier.";
    const status = message.includes("tidak ditemukan") ? 404 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
