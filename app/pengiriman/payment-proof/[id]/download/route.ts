import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { shipments } from "../../../../../db/schema";

type StoredFile = {
  base64: string;
  mimeType: string;
  name: string;
  sha256: string;
  size: number;
};

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
  const fileIndex = Number(searchParams.get("index") ?? "0");
  const disposition = searchParams.get("inline") === "1" ? "inline" : "attachment";

  if (!id) {
    return NextResponse.json({ error: "Pengiriman tidak valid." }, { status: 400 });
  }

  const db = await getDb();
  const [shipment] = await db
    .select({
      paymentProofFilesJson: shipments.paymentProofFilesJson,
      shipmentNo: shipments.shipmentNo,
    })
    .from(shipments)
    .where(eq(shipments.id, id))
    .limit(1);

  if (!shipment) {
    return NextResponse.json({ error: "Pengiriman tidak ditemukan." }, { status: 404 });
  }

  const files = Array.isArray(shipment.paymentProofFilesJson)
    ? (shipment.paymentProofFilesJson as StoredFile[])
    : [];
  const selectedFile = files[Number.isFinite(fileIndex) ? fileIndex : 0] ?? files[0];

  if (!selectedFile?.base64) {
    return NextResponse.json({ error: "Bukti bayar tidak ditemukan." }, { status: 404 });
  }

  const fileName = safeFileName(
    selectedFile.name,
    `${shipment.shipmentNo || "bukti-bayar"}.pdf`
  );

  return new Response(Buffer.from(selectedFile.base64, "base64"), {
    headers: {
      "content-disposition": `${disposition}; filename="${fileName}"`,
      "content-type": selectedFile.mimeType || "application/octet-stream",
    },
  });
}
