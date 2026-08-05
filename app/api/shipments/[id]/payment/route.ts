import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getDb } from "../../../../../db";
import { shipments } from "../../../../../db/schema";
import { getCurrentUser, recordActivityLog } from "../../../../auth";

type StoredFile = {
  base64: string;
  mimeType: string;
  name: string;
  sha256: string;
  size: number;
};

function parsePaidAmount(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.replace(/[^\d]/g, "") : "";
  const amount = raw ? Number(raw) : 0;

  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("Nominal terbayar tidak valid.");
  }

  return amount;
}

function parseOptionalAmount(value: FormDataEntryValue | null) {
  if (value === null) {
    return null;
  }

  return parsePaidAmount(value);
}

async function storedFile(file: File): Promise<StoredFile> {
  const buffer = Buffer.from(await file.arrayBuffer());

  return {
    base64: buffer.toString("base64"),
    mimeType: file.type,
    name: file.name,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    size: file.size,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;
    const formData = await request.formData();
    const paidAmount = parseOptionalAmount(formData.get("paidAmount"));
    const shippingCost = parseOptionalAmount(formData.get("shippingCost"));
    const uploadedFiles = formData
      .getAll("paymentProofFiles")
      .filter((value): value is File => value instanceof File && value.size > 0);
    const db = await getDb();
    const [shipment] = await db
      .select({
        paidAmount: shipments.paidAmount,
        paymentProofFilesJson: shipments.paymentProofFilesJson,
        shippingCost: shipments.shippingCost,
      })
      .from(shipments)
      .where(eq(shipments.id, id))
      .limit(1);

    if (!shipment) {
      return NextResponse.json(
        { error: "Pengiriman tidak ditemukan." },
        { status: 404 }
      );
    }

    const existingFiles = Array.isArray(shipment.paymentProofFilesJson)
      ? shipment.paymentProofFilesJson
      : [];
    const newFiles = await Promise.all(uploadedFiles.map(storedFile));
    const nextShippingCost = shippingCost ?? shipment.shippingCost;
    const requestedPaidAmount = paidAmount ?? shipment.paidAmount;
    const nextPaidAmount = Math.min(
      requestedPaidAmount,
      nextShippingCost || requestedPaidAmount
    );

    await db
      .update(shipments)
      .set({
        isShippingPaid:
          nextShippingCost > 0 ? nextPaidAmount >= nextShippingCost : false,
        paidAmount: nextPaidAmount,
        paymentProofFilesJson: [...existingFiles, ...newFiles],
        shippingCost: nextShippingCost,
      })
      .where(eq(shipments.id, id));
    if (user) {
      await recordActivityLog({
        action: "shipment_payment_updated",
        actor: user,
        details: {
          paymentProofFilesAdded: newFiles.length,
          shipmentId: id,
          shippingCost: nextShippingCost,
          paidAmount: nextPaidAmount,
        },
      });
    }

    revalidatePath("/pengiriman");

    return NextResponse.json({
      data: {
        paidAmount: nextPaidAmount,
        shippingCost: nextShippingCost,
        paymentProofFiles: [...existingFiles, ...newFiles].map((file) => ({
          mimeType: file.mimeType,
          name: file.name,
          size: file.size,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal update pembayaran." },
      { status: 400 }
    );
  }
}
