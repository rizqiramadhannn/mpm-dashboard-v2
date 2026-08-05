import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { invoiceDocuments } from "../../../db/schema";
import { getCurrentUser, recordActivityLog } from "../../auth";

export const dynamic = "force-dynamic";

type InvoiceStoredFile = {
  base64: string;
  mimeType: string;
  name: string;
  sha256: string;
  size: number;
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function parseAmount(value: unknown) {
  const raw =
    typeof value === "string"
      ? value.replace(/[^\d]/g, "")
      : typeof value === "number"
        ? String(value)
        : "";
  const amount = raw ? Number(raw) : 0;

  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("Nominal terbayar harus berupa angka valid.");
  }

  return amount;
}

function paymentStatus(totalAmount: number, paidAmount: number, currentStatus: string) {
  if (currentStatus === "cancelled") {
    return "cancelled";
  }

  return paidAmount >= totalAmount && totalAmount > 0 ? "done" : "pending";
}

async function filePayload(file: File): Promise<InvoiceStoredFile> {
  const base64 = arrayBufferToBase64(await file.arrayBuffer());

  return {
    base64,
    mimeType: file.type,
    name: file.name,
    sha256: sha256(base64),
    size: file.size,
  };
}

async function payloadFromRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const payload: Record<string, unknown> = Object.fromEntries(formData.entries());
    const ttdMateraiFile = formData.get("ttdMateraiFile");
    const paymentProofFiles = formData
      .getAll("paymentProofFiles")
      .filter((value): value is File => value instanceof File);

    if (ttdMateraiFile instanceof File) {
      payload.ttdMateraiFile = await filePayload(ttdMateraiFile);
    }

    if (paymentProofFiles.length > 0) {
      payload.paymentProofFiles = await Promise.all(paymentProofFiles.map(filePayload));
    }

    return payload;
  }

  return request.json();
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    const payload = await payloadFromRequest(request);
    const id = typeof payload.id === "string" ? payload.id.trim() : "";

    if (!id) {
      return NextResponse.json({ error: "Invoice tidak valid." }, { status: 400 });
    }

    const db = await getDb();
    const [invoice] = await db
      .select({
        paymentProofFilesJson: invoiceDocuments.paymentProofFilesJson,
        status: invoiceDocuments.status,
        totalAmount: invoiceDocuments.totalAmount,
      })
      .from(invoiceDocuments)
      .where(eq(invoiceDocuments.id, id))
      .limit(1);

    if (!invoice) {
      return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    }

    const updates: Partial<typeof invoiceDocuments.$inferInsert> = {};

    if ("paidAmount" in payload) {
      const paidAmount = parseAmount(payload.paidAmount);
      updates.paidAmount = paidAmount;
      updates.status = paymentStatus(invoice.totalAmount, paidAmount, invoice.status);
      updates.processedAt = updates.status === "done" ? new Date().toISOString() : null;
    }

    if (payload.ttdMateraiFile) {
      const file = payload.ttdMateraiFile as InvoiceStoredFile;
      updates.ttdMateraiFileName = file.name;
      updates.ttdMateraiFileMimeType = file.mimeType;
      updates.ttdMateraiFileSize = file.size;
      updates.ttdMateraiFileBase64 = file.base64;
      updates.ttdMateraiFileSha256 = file.sha256;
    }

    if (payload.paymentProofFiles) {
      const existingFiles = Array.isArray(invoice.paymentProofFilesJson)
        ? invoice.paymentProofFilesJson
        : [];
      updates.paymentProofFilesJson = [
        ...existingFiles.filter((file) => file.base64),
        ...(payload.paymentProofFiles as InvoiceStoredFile[]),
      ];
    }

    if (Object.keys(updates).length > 0) {
      await db.update(invoiceDocuments).set(updates).where(eq(invoiceDocuments.id, id));
      if (user) {
        await recordActivityLog({
          action: "invoice_updated",
          actor: user,
          details: {
            invoiceId: id,
            paidAmount: updates.paidAmount,
            paymentProofFilesAdded: payload.paymentProofFiles
              ? (payload.paymentProofFiles as InvoiceStoredFile[]).length
              : 0,
            status: updates.status,
            ttdMateraiUpdated: Boolean(payload.ttdMateraiFile),
          },
        });
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/invoice");

    return NextResponse.json({
      data: {
        id,
        ...updates,
        paymentProofFiles: (updates.paymentProofFilesJson ??
          invoice.paymentProofFilesJson ??
          []) as InvoiceStoredFile[],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengubah invoice.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
