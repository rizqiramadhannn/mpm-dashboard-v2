import { isInvoiceEligibleSph } from "../../sph/workflow";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { invoiceDocuments, sphDocuments } from "../../../db/schema";
import { getCurrentUser } from "../../auth";
import { persistInvoiceChange, InvoiceChangeConflict, InvalidPaymentChange } from "../../invoice/payment-history-storage";
import { validateSignedTtb } from "../../invoice/signed-ttb-pdf";
import { invoicePaymentTimestamp } from "../../invoice/payment-date";

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
  if (typeof value === "string" && value.includes("-")) throw new Error("Nominal terbayar harus nonnegatif.");
  const raw =
    typeof value === "string"
      ? value.replace(/[^\d]/g, "")
      : typeof value === "number"
        ? String(value)
        : "";
  const amount = raw ? Number(raw) : 0;

  if (!Number.isSafeInteger(amount) || amount < 0) {
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
    const signedTtbFile = formData.get("signedTtbFile");
    const paymentProofFiles = formData
      .getAll("paymentProofFiles")
      .filter((value): value is File => value instanceof File);

    if (ttdMateraiFile instanceof File) {
      payload.ttdMateraiFile = await filePayload(ttdMateraiFile);
    }

    if (signedTtbFile instanceof File) {
      if (signedTtbFile.size === 0 || signedTtbFile.size > 15 * 1024 * 1024) {
        throw new Error("Ukuran file TTB harus antara 1 byte dan 15 MB.");
      }
      payload.signedTtbFile = await filePayload(signedTtbFile);
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
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.mustChangePassword) return NextResponse.json({ error: "Password change required" }, { status: 403 });
    const payload = await payloadFromRequest(request);
    if ("paymentDate" in payload && user?.role !== "superadmin") {
      return NextResponse.json(
        { error: "Hanya admin yang dapat mengubah tanggal bayar invoice." },
        { status: 403 }
      );
    }
    const id = typeof payload.id === "string" ? payload.id.trim() : "";

    if (!id) {
      return NextResponse.json({ error: "Invoice tidak valid." }, { status: 400 });
    }

    const db = await getDb();
    const [invoice] = await db
      .select({
        id: invoiceDocuments.id,
        invoiceDate: invoiceDocuments.invoiceDate,
        paidAmount: invoiceDocuments.paidAmount,
        sphStatus: sphDocuments.status,
        paymentProofFilesJson: invoiceDocuments.paymentProofFilesJson,
        processedAt: invoiceDocuments.processedAt,
        status: invoiceDocuments.status,
        totalAmount: invoiceDocuments.totalAmount,
      })
      .from(invoiceDocuments)
      .innerJoin(sphDocuments, eq(invoiceDocuments.sphId, sphDocuments.id))
      .where(eq(invoiceDocuments.id, id))
      .limit(1);

    if (!invoice || !isInvoiceEligibleSph(invoice.sphStatus)) {
      return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    }

    const updates: Partial<typeof invoiceDocuments.$inferInsert> = {};

    if ("paidAmount" in payload || "paymentEventId" in payload) {
      if (user?.username.toLowerCase() !== "superadmin") {
        return NextResponse.json(
          { error: "Hanya user superadmin yang dapat mengubah terbayar invoice." },
          { status: 403 }
        );
      }

      if ("paidAmount" in payload) {
        const paidAmount = parseAmount(payload.paidAmount);
        updates.paidAmount = paidAmount;
        updates.status = paymentStatus(invoice.totalAmount, paidAmount, invoice.status);
        updates.processedAt = updates.status === "done" ? invoice.processedAt ?? new Date().toISOString() : null;
      }
    }

    if ("paymentDate" in payload) {
      if ((updates.status ?? invoice.status) !== "done") {
        return NextResponse.json(
          { error: "Tanggal bayar hanya dapat diubah untuk invoice lunas." },
          { status: 400 }
        );
      }
      updates.processedAt = invoicePaymentTimestamp(payload.paymentDate);
    }

    if (payload.ttdMateraiFile) {
      const file = payload.ttdMateraiFile as InvoiceStoredFile;
      updates.ttdMateraiFileName = file.name;
      updates.ttdMateraiFileMimeType = file.mimeType;
      updates.ttdMateraiFileSize = file.size;
      updates.ttdMateraiFileBase64 = file.base64;
      updates.ttdMateraiFileSha256 = file.sha256;
    }

    if (payload.signedTtbFile) {
      const file = payload.signedTtbFile as InvoiceStoredFile;
      if (typeof file.base64 !== "string" || typeof file.name !== "string" ||
          file.base64.length > Math.ceil(15 * 1024 * 1024 * 4 / 3) + 4) {
        throw new Error("File TTB tidak valid atau melebihi 15 MB.");
      }
      const bytes = Uint8Array.from(Buffer.from(file.base64, "base64"));
      if (bytes.length === 0 || bytes.length > 15 * 1024 * 1024) {
        throw new Error("Ukuran file TTB harus antara 1 byte dan 15 MB.");
      }
      updates.ttbSignedFileName =
        file.name.replace(/[\\/:*?"<>|\x00-\x1f]+/g, "-").trim() || "TTB";
      updates.ttbSignedFileMimeType = await validateSignedTtb(bytes);
      updates.ttbSignedFileSize = bytes.length;
      updates.ttbSignedFileBase64 = file.base64;
      updates.ttbSignedFileSha256 = sha256(file.base64);
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

    let saved: Partial<typeof invoiceDocuments.$inferInsert> & { paymentEvent?: { paymentId: string; amount?: number; paymentDate?: string } } = updates;
    if (Object.keys(updates).length > 0 || "paymentEventId" in payload) {
      saved = await persistInvoiceChange(db, invoice, updates, payload, {
        invoiceId: id,
        previousPaymentDate: "paymentDate" in payload ? invoice.processedAt : undefined,
        paymentProofFilesAdded: payload.paymentProofFiles ? (payload.paymentProofFiles as InvoiceStoredFile[]).length : 0,
        ttdMateraiUpdated: Boolean(payload.ttdMateraiFile),
        signedTtbUpdated: Boolean(payload.signedTtbFile),
      }, { id: user.id, username: user.username, ipAddress: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown" });
    }

    revalidatePath("/dashboard");
    revalidatePath("/invoice");

    return NextResponse.json({
      data: {
        id,
        ...saved,
        ttbSignedFileBase64: undefined,
        ttdMateraiFileBase64: undefined,
        paymentProofFilesJson: undefined,
        paymentProofFiles: (updates.paymentProofFilesJson ??
          invoice.paymentProofFilesJson ??
          []).map((file) => ({ name: file.name, mimeType: file.mimeType, size: file.size })),
      },
    });
  } catch (error) {
    if (error instanceof InvoiceChangeConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof InvalidPaymentChange) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && ("query" in error || error.name === "LibsqlError")) return NextResponse.json({ error: "Gagal menyimpan invoice. Muat ulang dan periksa hasil sebelum mencoba kembali." }, { status: 500 });
    const message = error instanceof Error ? error.message : "Gagal mengubah invoice.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
