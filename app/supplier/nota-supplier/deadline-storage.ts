import { and, eq, isNull } from "drizzle-orm";
import type { getDb } from "../../../db";
import { appAdminAuditLogs, supplierNotes } from "../../../db/schema";

export class SupplierNoteDeadlineError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function calendarDate(value: unknown, label: string) {
  if (typeof value !== "string") throw new SupplierNoteDeadlineError(`${label} wajib diberikan.`);
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new SupplierNoteDeadlineError(`${label} tidak valid.`);
  }
  return date;
}

export async function updateSupplierNotePaymentDeadline(
  db: Awaited<ReturnType<typeof getDb>>,
  id: string,
  value: unknown,
  ipAddress: string,
) {
  if (!value || typeof value !== "object") throw new SupplierNoteDeadlineError("Data deadline tidak valid.");
  const payload = value as Record<string, unknown>;
  const expectedNoteNo = typeof payload.expectedNoteNo === "string" ? payload.expectedNoteNo.trim() : "";
  const paymentDeadline = calendarDate(payload.paymentDeadline, "Deadline pembayaran");
  const expectedPaymentDeadline = payload.expectedPaymentDeadline === null
    ? null
    : calendarDate(payload.expectedPaymentDeadline, "Deadline review");
  if (!expectedNoteNo) throw new SupplierNoteDeadlineError("Nomor nota review wajib diberikan.");

  return db.transaction(async (tx) => {
    const [note] = await tx.select({
      id: supplierNotes.id,
      noteNo: supplierNotes.noteNo,
      paymentDeadline: supplierNotes.paymentDeadline,
    }).from(supplierNotes).where(eq(supplierNotes.id, id)).limit(1);
    if (!note) throw new SupplierNoteDeadlineError("Nota supplier tidak ditemukan.", 404);
    if (note.noteNo !== expectedNoteNo) throw new SupplierNoteDeadlineError("Nomor nota berubah sejak review.", 409);
    if (note.paymentDeadline === paymentDeadline) return { id, noteNo: note.noteNo, paymentDeadline, reused: true };
    if (note.paymentDeadline !== expectedPaymentDeadline) throw new SupplierNoteDeadlineError("Deadline berubah sejak review.", 409);

    const deadlineGuard = expectedPaymentDeadline === null
      ? isNull(supplierNotes.paymentDeadline)
      : eq(supplierNotes.paymentDeadline, expectedPaymentDeadline);
    const [updated] = await tx.update(supplierNotes).set({ paymentDeadline, updatedAt: new Date().toISOString() }).where(and(
      eq(supplierNotes.id, id),
      eq(supplierNotes.noteNo, expectedNoteNo),
      deadlineGuard,
    )).returning({ id: supplierNotes.id });
    if (!updated) throw new SupplierNoteDeadlineError("Nota berubah sejak review.", 409);

    await tx.insert(appAdminAuditLogs).values({
      actorUserId: null,
      actorUsername: "supplier-notes-api",
      action: "supplier_note_payment_deadline_updated",
      ipAddress,
      detailsJson: { id, noteNo: note.noteNo, previousPaymentDeadline: note.paymentDeadline, paymentDeadline },
    });
    return { id, noteNo: note.noteNo, paymentDeadline, reused: false };
  });
}
