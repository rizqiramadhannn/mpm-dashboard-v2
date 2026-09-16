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
  const paymentDate = paymentDateFrom(payload.paymentDate);

  if (
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
        amount: supplierNotes.amount,
        paidAmount: supplierNotes.paidAmount,
        paymentDate: supplierNotes.paymentDate,
      })
      .from(supplierNotes)
      .where(eq(supplierNotes.id, id))
      .limit(1);

    if (!note) {
      throw new SupplierNotePaymentError("Nota supplier tidak ditemukan.", 404);
    }
    if (note.amount !== expectedAmount) {
      throw new SupplierNotePaymentError("Total berubah sejak review.", 409);
    }
    if (note.paidAmount === note.amount) {
      return {
        id,
        paidAmount: note.amount,
        remainingPayment: 0,
        paymentStatus: "LUNAS",
        paymentDate: note.paymentDate,
        reused: true,
      };
    }
    if (note.paidAmount !== expectedPaidAmount) {
      throw new SupplierNotePaymentError("Pembayaran berubah sejak review.", 409);
    }

    const [updated] = await tx
      .update(supplierNotes)
      .set({
        paidAmount: note.amount,
        remainingPayment: 0,
        paymentStatus: "LUNAS",
        paymentDate,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(supplierNotes.id, id),
          eq(supplierNotes.amount, expectedAmount),
          eq(supplierNotes.paidAmount, expectedPaidAmount),
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
        ...(evidence ? { evidence } : {}),
      },
    });

    return {
      id,
      paidAmount: note.amount,
      remainingPayment: 0,
      paymentStatus: "LUNAS",
      paymentDate,
      reused: false,
    };
  });
}
