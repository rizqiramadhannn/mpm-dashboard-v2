import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { invoiceDocuments } from "../../../../db/schema";

export const dynamic = "force-dynamic";

type InvoiceStoredFile = {
  base64: string;
  mimeType: string;
  name: string;
  size: number;
};

function safeFileName(fileName: string, fallback: string) {
  const cleaned = fileName.replace(/[\\/:*?"<>|]+/g, "-").trim();
  return cleaned || fallback;
}

function base64ToBytes(base64: string) {
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const fileType = searchParams.get("type") === "paymentProof" ? "paymentProof" : "ttd";
  const fileIndex = Number(searchParams.get("index") ?? "0");
  const inline = searchParams.get("inline") === "1";

  if (!id) {
    return NextResponse.json({ error: "Invoice tidak valid." }, { status: 400 });
  }

  const db = await getDb();
  const [invoice] = await db
    .select({
      invoiceNo: invoiceDocuments.invoiceNo,
      paymentProofFilesJson: invoiceDocuments.paymentProofFilesJson,
      ttdMateraiFileBase64: invoiceDocuments.ttdMateraiFileBase64,
      ttdMateraiFileMimeType: invoiceDocuments.ttdMateraiFileMimeType,
      ttdMateraiFileName: invoiceDocuments.ttdMateraiFileName,
      ttdMateraiFileSize: invoiceDocuments.ttdMateraiFileSize,
    })
    .from(invoiceDocuments)
    .where(eq(invoiceDocuments.id, id))
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }

  const proofFiles = Array.isArray(invoice.paymentProofFilesJson)
    ? invoice.paymentProofFilesJson
    : [];
  const selectedProof = proofFiles[Number.isFinite(fileIndex) ? fileIndex : 0];
  const file: InvoiceStoredFile | null =
    fileType === "paymentProof"
      ? selectedProof ?? null
      : invoice.ttdMateraiFileBase64
        ? {
            base64: invoice.ttdMateraiFileBase64,
            mimeType: invoice.ttdMateraiFileMimeType,
            name: invoice.ttdMateraiFileName,
            size: invoice.ttdMateraiFileSize,
          }
        : null;

  if (!file?.base64) {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  }

  const fallback =
    fileType === "paymentProof"
      ? `${invoice.invoiceNo}-bukti-bayar.pdf`
      : `${invoice.invoiceNo}-ttd-materai.pdf`;
  const fileName = safeFileName(file.name, fallback);
  const disposition = inline ? "inline" : "attachment";

  return new Response(base64ToBytes(file.base64), {
    headers: {
      "content-disposition": `${disposition}; filename="${fileName}"`,
      "content-type": file.mimeType || "application/octet-stream",
    },
  });
}
