import { and, eq } from "drizzle-orm";
import type { getDb } from "../../../db";
import { supplierNotes, appAdminAuditLogs } from "../../../db/schema";
import { ManualNoteError } from "./model";

export async function settleManualNote(db: Awaited<ReturnType<typeof getDb>>, id: string, value: unknown, ipAddress: string) {
  if (!value || typeof value !== "object" || !("expectedAmount" in value) || !("expectedPaidAmount" in value)) throw new ManualNoteError("Nominal review wajib diberikan.");
  const { expectedAmount, expectedPaidAmount } = value;
  if (typeof expectedAmount !== "number" || !Number.isSafeInteger(expectedAmount) || expectedAmount <= 0 || typeof expectedPaidAmount !== "number" || !Number.isSafeInteger(expectedPaidAmount) || expectedPaidAmount < 0 || expectedPaidAmount > expectedAmount) throw new ManualNoteError("Nominal review tidak valid.");
  return db.transaction(async tx => {
    const [note] = await tx.select({ id: supplierNotes.id, noteSource: supplierNotes.noteSource, amount: supplierNotes.amount, paidAmount: supplierNotes.paidAmount }).from(supplierNotes).where(eq(supplierNotes.id, id)).limit(1);
    if (!note || note.noteSource !== "manual") throw new ManualNoteError("Nota manual tidak ditemukan.", 404);
    if (note.amount !== expectedAmount) throw new ManualNoteError("Total berubah sejak review.", 409);
    if (note.paidAmount === note.amount) return { id, paidAmount: note.amount, remainingPayment: 0, paymentStatus: "LUNAS", reused: true };
    if (note.paidAmount !== expectedPaidAmount) throw new ManualNoteError("Pembayaran berubah sejak review.", 409);
    const [updated] = await tx.update(supplierNotes).set({ paidAmount: note.amount, remainingPayment: 0, paymentStatus: "LUNAS", updatedAt: new Date().toISOString() }).where(and(eq(supplierNotes.id, id), eq(supplierNotes.amount, expectedAmount), eq(supplierNotes.paidAmount, expectedPaidAmount))).returning({ id: supplierNotes.id });
    if (!updated) throw new ManualNoteError("Nota berubah sejak review.", 409);
    await tx.insert(appAdminAuditLogs).values({ actorUserId: null, actorUsername: "supplier-notes-api", action: "supplier_manual_note_settled", ipAddress, detailsJson: { id, previousPaidAmount: note.paidAmount, paidAmount: note.amount, amount: note.amount } });
    return { id, paidAmount: note.amount, remainingPayment: 0, paymentStatus: "LUNAS", reused: false };
  });
}
