import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { getDb } from "../../../db";
import { appAdminAuditLogs, supplierNotes } from "../../../db/schema";

export class SupplierNotePaymentError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function paymentDateFrom(value: unknown) {
  if (typeof value !== "string") {
    throw new SupplierNotePaymentError("Tanggal pembayaran wajib diberikan.");
  }
  const paymentDate = value.trim();
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) ||
    !Number.isFinite(Date.parse(`${paymentDate}T00:00:00Z`)) ||
    new Date(`${paymentDate}T00:00:00Z`).toISOString().slice(0, 10) !== paymentDate
  ) {
    throw new SupplierNotePaymentError("Tanggal pembayaran tidak valid.");
  }
  return paymentDate;
}

type PaymentProofInput = {
  base64?: unknown;
  mimeType?: unknown;
  name?: unknown;
  size?: unknown;
};

type StoredPaymentProof = {
  base64: string;
  mimeType: string;
  name: string;
  sha256: string;
  size: number;
  url: string;
};

function paymentProofsFrom(value: unknown) {
  if (value === undefined) return [] as StoredPaymentProof[];
  if (!Array.isArray(value) || value.length === 0) {
    throw new SupplierNotePaymentError("Bukti pembayaran wajib berupa file.");
  }

  return value.map((raw, index) => {
    const file = raw as PaymentProofInput;
    const base64 = typeof file.base64 === "string" ? file.base64.trim() : "";
    const mimeType = typeof file.mimeType === "string" ? file.mimeType.trim() : "";
    const name = typeof file.name === "string" ? file.name.trim() : "";
    const size = typeof file.size === "number" ? file.size : Number.NaN;
    if (
      !base64 ||
      !name ||
      !["application/pdf", "image/jpeg", "image/png"].includes(mimeType) ||
      !Number.isSafeInteger(size) ||
      size <= 0
    ) {
      throw new SupplierNotePaymentError(`Bukti pembayaran ${index + 1} tidak valid.`);
    }
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length !== size) {
      throw new SupplierNotePaymentError(`Ukuran bukti pembayaran ${index + 1} tidak cocok.`);
    }
    return {
      base64,
      mimeType,
      name,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      size,
      url: "",
    };
  });
}

function storedPaymentProofs(note: {
  paymentProofFileBase64?: string;
  paymentProofFileMimeType?: string;
  paymentProofFileName?: string;
  paymentProofFileSha256?: string;
  paymentProofFileSize?: number;
  paymentProofFileUrl?: string;
  paymentProofFilesJson?: StoredPaymentProof[] | null;
}) {
  if (Array.isArray(note.paymentProofFilesJson) && note.paymentProofFilesJson.length > 0) {
    return note.paymentProofFilesJson.filter((file) => file.base64 || file.url);
  }
  if (note.paymentProofFileName || note.paymentProofFileBase64 || note.paymentProofFileUrl) {
    return [{
      base64: note.paymentProofFileBase64 ?? "",
      mimeType: note.paymentProofFileMimeType ?? "",
      name: note.paymentProofFileName ?? "",
      sha256: note.paymentProofFileSha256 ?? "",
      size: note.paymentProofFileSize ?? 0,
      url: note.paymentProofFileUrl ?? "",
    }];
  }
  return [] as StoredPaymentProof[];
}

export async function settleSupplierNote(
  db: Awaited<ReturnType<typeof getDb>>,
  id: string,
  value: unknown,
  ipAddress: string,
) {
  if (!value || typeof value !== "object") {
    throw new SupplierNotePaymentError("Data pelunasan tidak valid.");
  }

  const payload = value as Record<string, unknown>;
  const expectedAmount = payload.expectedAmount;
  const expectedPaidAmount = payload.expectedPaidAmount;
  const expectedNoteNo =
    typeof payload.expectedNoteNo === "string" ? payload.expectedNoteNo.trim() : "";
  const paymentDate = paymentDateFrom(payload.paymentDate);
  const newPaymentProofs = paymentProofsFrom(payload.paymentProofFiles);

  if (
    !expectedNoteNo ||
    typeof expectedAmount !== "number" ||
    !Number.isSafeInteger(expectedAmount) ||
    expectedAmount <= 0 ||
    typeof expectedPaidAmount !== "number" ||
    !Number.isSafeInteger(expectedPaidAmount) ||
    expectedPaidAmount < 0 ||
    expectedPaidAmount > expectedAmount
  ) {
    throw new SupplierNotePaymentError("Nominal review tidak valid.");
  }

  const evidence =
    payload.evidence && typeof payload.evidence === "object"
      ? payload.evidence as Record<string, unknown>
      : undefined;

  return db.transaction(async (tx) => {
    const [note] = await tx
      .select({
        id: supplierNotes.id,
        noteNo: supplierNotes.noteNo,
        amount: supplierNotes.amount,
        paidAmount: supplierNotes.paidAmount,
        paymentDate: supplierNotes.paymentDate,
        paymentProofFileBase64: supplierNotes.paymentProofFileBase64,
        paymentProofFileMimeType: supplierNotes.paymentProofFileMimeType,
        paymentProofFileName: supplierNotes.paymentProofFileName,
        paymentProofFileSha256: supplierNotes.paymentProofFileSha256,
        paymentProofFileSize: supplierNotes.paymentProofFileSize,
        paymentProofFileUrl: supplierNotes.paymentProofFileUrl,
        paymentProofFilesJson: supplierNotes.paymentProofFilesJson,
      })
      .from(supplierNotes)
      .where(eq(supplierNotes.id, id))
      .limit(1);

    if (!note) {
      throw new SupplierNotePaymentError("Nota supplier tidak ditemukan.", 404);
    }
    if (note.noteNo !== expectedNoteNo) {
      throw new SupplierNotePaymentError("Nomor nota berubah sejak review.", 409);
    }
    if (note.amount !== expectedAmount) {
      throw new SupplierNotePaymentError("Total berubah sejak review.", 409);
    }
    const existingPaymentProofs = storedPaymentProofs(note);
    const existingHashes = new Set(existingPaymentProofs.map((file) => file.sha256));
    const appendedPaymentProofs = newPaymentProofs.filter(
      (file) => !existingHashes.has(file.sha256),
    );
    const paymentProofs = [...existingPaymentProofs, ...appendedPaymentProofs];
    const firstPaymentProof = paymentProofs[0];
    const proofUpdates = firstPaymentProof
      ? {
          paymentProofFileName: firstPaymentProof.name,
          paymentProofFileMimeType: firstPaymentProof.mimeType,
          paymentProofFileSize: firstPaymentProof.size,
          paymentProofFileBase64: firstPaymentProof.base64,
          paymentProofFileUrl: firstPaymentProof.url,
          paymentProofFileSha256: firstPaymentProof.sha256,
          paymentProofFilesJson: paymentProofs,
        }
      : {};

    if (note.paidAmount === note.amount && appendedPaymentProofs.length === 0) {
      return {
        id,
        paidAmount: note.amount,
        remainingPayment: 0,
        paymentStatus: "LUNAS",
        paymentDate: note.paymentDate,
        paymentProofCount: paymentProofs.length,
        reused: true,
      };
    }
    if (note.paidAmount !== note.amount && note.paidAmount !== expectedPaidAmount) {
      throw new SupplierNotePaymentError("Pembayaran berubah sejak review.", 409);
    }

    const [updated] = await tx
      .update(supplierNotes)
      .set({
        paidAmount: note.amount,
        remainingPayment: 0,
        paymentStatus: "LUNAS",
        paymentDate: note.paymentDate ?? paymentDate,
        ...proofUpdates,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(supplierNotes.id, id),
          eq(supplierNotes.amount, expectedAmount),
          eq(supplierNotes.paidAmount, note.paidAmount),
        ),
      )
      .returning({ id: supplierNotes.id });

    if (!updated) {
      throw new SupplierNotePaymentError("Nota berubah sejak review.", 409);
    }

    await tx.insert(appAdminAuditLogs).values({
      actorUserId: null,
      actorUsername: "supplier-notes-api",
      action: "supplier_note_settled",
      ipAddress,
      detailsJson: {
        id,
        previousPaidAmount: note.paidAmount,
        paidAmount: note.amount,
        amount: note.amount,
        paymentDate,
        paymentProofCount: paymentProofs.length,
        appendedPaymentProofCount: appendedPaymentProofs.length,
        paymentProofSha256: appendedPaymentProofs.map((file) => file.sha256),
        ...(evidence ? { evidence } : {}),
      },
    });

    return {
      id,
      paidAmount: note.amount,
      remainingPayment: 0,
      paymentStatus: "LUNAS",
      paymentDate: note.paymentDate ?? paymentDate,
      paymentProofCount: paymentProofs.length,
      reused: false,
    };
  });
}
