import { and, eq } from "drizzle-orm";
import type { getDb } from "../../../db";
import { supplierNotes, appAdminAuditLogs } from "../../../db/schema";
import { ManualNoteError } from "./model";

export async function settleManualNote(db: Awaited<ReturnType<typeof getDb>>, id: string, value: unknown, ipAddress: string) {
  if (!value || typeof value !== "object" || !("expectedAmount" in value) || !("expectedPaidAmount" in value)) throw new ManualNoteError("Nominal review wajib diberikan.");
  const { expectedAmount, expectedPaidAmount } = value;
  const moveToStock = "purchasePurpose" in value && value.purchasePurpose === "Stock";
  if ("purchasePurpose" in value && !moveToStock) throw new ManualNoteError("Perubahan tujuan hanya mendukung Stock.");
  if (typeof expectedAmount !== "number" || !Number.isSafeInteger(expectedAmount) || expectedAmount <= 0 || typeof expectedPaidAmount !== "number" || !Number.isSafeInteger(expectedPaidAmount) || expectedPaidAmount < 0 || expectedPaidAmount > expectedAmount) throw new ManualNoteError("Nominal review tidak valid.");
  return db.transaction(async tx => {
    const [note] = await tx.select({ id: supplierNotes.id, noteSource: supplierNotes.noteSource, amount: supplierNotes.amount, paidAmount: supplierNotes.paidAmount, purchasePurpose: supplierNotes.purchasePurpose, customerName: supplierNotes.customerName }).from(supplierNotes).where(eq(supplierNotes.id, id)).limit(1);
    if (!note || note.noteSource !== "manual") throw new ManualNoteError("Nota manual tidak ditemukan.", 404);
    if (note.amount !== expectedAmount) throw new ManualNoteError("Total berubah sejak review.", 409);
    if (note.paidAmount === note.amount && (!moveToStock || (note.purchasePurpose === "Stock" && note.customerName === ""))) return { id, paidAmount: note.amount, remainingPayment: 0, paymentStatus: "LUNAS", reused: true };
    if (note.paidAmount !== expectedPaidAmount && note.paidAmount !== note.amount) throw new ManualNoteError("Pembayaran berubah sejak review.", 409);
    const [updated] = await tx.update(supplierNotes).set({ paidAmount: note.amount, remainingPayment: 0, paymentStatus: "LUNAS", ...(moveToStock ? { purchasePurpose: "Stock", customerName: "" } : {}), updatedAt: new Date().toISOString() }).where(and(eq(supplierNotes.id, id), eq(supplierNotes.amount, expectedAmount), eq(supplierNotes.paidAmount, note.paidAmount))).returning({ id: supplierNotes.id });
    if (!updated) throw new ManualNoteError("Nota berubah sejak review.", 409);
    await tx.insert(appAdminAuditLogs).values({ actorUserId: null, actorUsername: "supplier-notes-api", action: "supplier_manual_note_settled", ipAddress, detailsJson: { id, previousPaidAmount: note.paidAmount, paidAmount: note.amount, amount: note.amount, ...(moveToStock ? { previousPurchasePurpose: note.purchasePurpose, previousCustomerName: note.customerName, purchasePurpose: "Stock" } : {}) } });
    return { id, paidAmount: note.amount, remainingPayment: 0, paymentStatus: "LUNAS", reused: false };
  });
}

export async function reopenManualNoteAsUnpaid(db: Awaited<ReturnType<typeof getDb>>, id: string, value: unknown, ipAddress: string) {
  if (!value || typeof value !== "object" || !("expectedAmount" in value) || !("expectedPaidAmount" in value) || !("expectedPaymentStatus" in value)) throw new ManualNoteError("Kondisi review wajib diberikan.");
  const { expectedAmount, expectedPaidAmount, expectedPaymentStatus } = value;
  if (typeof expectedAmount !== "number" || !Number.isSafeInteger(expectedAmount) || expectedAmount <= 0 || typeof expectedPaidAmount !== "number" || !Number.isSafeInteger(expectedPaidAmount) || expectedPaidAmount < 0 || expectedPaidAmount > expectedAmount || expectedPaymentStatus !== "CANCELLED") throw new ManualNoteError("Kondisi review tidak valid.");
  return db.transaction(async tx => {
    const [note] = await tx.select({ id: supplierNotes.id, noteSource: supplierNotes.noteSource, amount: supplierNotes.amount, paidAmount: supplierNotes.paidAmount, paymentStatus: supplierNotes.paymentStatus, paymentDate: supplierNotes.paymentDate }).from(supplierNotes).where(eq(supplierNotes.id, id)).limit(1);
    if (!note || note.noteSource !== "manual") throw new ManualNoteError("Nota manual tidak ditemukan.", 404);
    if (note.amount !== expectedAmount) throw new ManualNoteError("Total berubah sejak review.", 409);
    if (note.paymentStatus === "BELUM BAYAR" && note.paidAmount === 0 && note.paymentDate === null) return { id, paidAmount: 0, remainingPayment: note.amount, paymentStatus: "BELUM BAYAR", paymentDate: null, reused: true };
    if (note.paidAmount !== expectedPaidAmount || note.paymentStatus !== expectedPaymentStatus) throw new ManualNoteError("Status pembayaran berubah sejak review.", 409);
    const [updated] = await tx.update(supplierNotes).set({ paidAmount: 0, remainingPayment: note.amount, paymentStatus: "BELUM BAYAR", paymentDate: null, updatedAt: new Date().toISOString() }).where(and(eq(supplierNotes.id, id), eq(supplierNotes.amount, expectedAmount), eq(supplierNotes.paidAmount, expectedPaidAmount), eq(supplierNotes.paymentStatus, expectedPaymentStatus))).returning({ id: supplierNotes.id });
    if (!updated) throw new ManualNoteError("Nota berubah sejak review.", 409);
    await tx.insert(appAdminAuditLogs).values({ actorUserId: null, actorUsername: "supplier-notes-api", action: "supplier_manual_note_reopened_unpaid", ipAddress, detailsJson: { id, amount: note.amount, previousPaidAmount: note.paidAmount, previousPaymentStatus: note.paymentStatus, previousPaymentDate: note.paymentDate, paidAmount: 0, paymentStatus: "BELUM BAYAR" } });
    return { id, paidAmount: 0, remainingPayment: note.amount, paymentStatus: "BELUM BAYAR", paymentDate: null, reused: false };
  });
}
