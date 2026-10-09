import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { randomId } from "../../db/id";
import { appAdminAuditLogs, invoiceDocuments } from "../../db/schema";
import { isCalendarDate, paymentHistoryState, wibDate, type PaymentAudit, type PaymentEvent, type PaymentSnapshot } from "./payment-history";

type Db = Awaited<ReturnType<typeof getDb>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export class InvoiceChangeConflict extends Error {}
export class InvalidPaymentChange extends Error {}

export async function readInvoicePaymentAudits(db: Db | Tx, ids: string[]): Promise<PaymentAudit[]> {
  if (!ids.length) return [];
  return db.select({ id: appAdminAuditLogs.id, createdAt: appAdminAuditLogs.createdAt, detailsJson: appAdminAuditLogs.detailsJson })
    .from(appAdminAuditLogs).where(and(eq(appAdminAuditLogs.action, "invoice_updated"), inArray(sql<string>`json_extract(${appAdminAuditLogs.detailsJson}, '$.invoiceId')`, ids)));
}

type Snapshot = PaymentSnapshot & { paymentProofFilesJson: typeof invoiceDocuments.$inferSelect.paymentProofFilesJson };
type ChangeInput = { paymentKind?: unknown; receivedDate?: unknown; expectedPaidAmount?: unknown; correctionReason?: unknown; paymentEventId?: unknown; paymentEventAmount?: unknown; paymentEventDate?: unknown; paymentDate?: unknown };

export async function persistInvoiceChange(
  db: Db, before: Snapshot, updates: Partial<typeof invoiceDocuments.$inferInsert>, payload: ChangeInput,
  details: Record<string, unknown>, actor: { id: string | null; username: string; ipAddress: string }, now = new Date(),
) {
  return db.transaction(async tx => {
    const [current] = await tx.select({ id: invoiceDocuments.id, invoiceDate: invoiceDocuments.invoiceDate,
      totalAmount: invoiceDocuments.totalAmount, paidAmount: invoiceDocuments.paidAmount, status: invoiceDocuments.status,
      processedAt: invoiceDocuments.processedAt, paymentProofFilesJson: invoiceDocuments.paymentProofFilesJson,
    }).from(invoiceDocuments).where(eq(invoiceDocuments.id, before.id)).limit(1);
    if (!current || current.paidAmount !== before.paidAmount || current.status !== before.status || current.totalAmount !== before.totalAmount ||
        current.processedAt !== before.processedAt || JSON.stringify(current.paymentProofFilesJson) !== JSON.stringify(before.paymentProofFilesJson)) {
      throw new InvoiceChangeConflict("Invoice berubah. Muat ulang sebelum menyimpan.");
    }
    const history = paymentHistoryState(current, await readInvoicePaymentAudits(tx, [before.id]), now);
    let event: PaymentEvent | undefined;
    const hasReceiptCorrection = payload.paymentEventId !== undefined;
    if (updates.paidAmount !== undefined && updates.paidAmount !== before.paidAmount || hasReceiptCorrection) {
      if (payload.expectedPaidAmount !== before.paidAmount) throw new InvoiceChangeConflict("Saldo terbayar berubah atau expectedPaidAmount tidak diberikan. Muat ulang invoice.");
    }
    const validReceivedDate = (value: unknown) => {
      if (!isCalendarDate(value) || value > wibDate(now)) throw new InvalidPaymentChange("Tanggal penerimaan harus YYYY-MM-DD yang valid dan tidak boleh di masa depan.");
      return value;
    };
    if (hasReceiptCorrection) {
      if (updates.paidAmount !== undefined || payload.paymentDate !== undefined || payload.paymentKind !== undefined) throw new InvalidPaymentChange("Koreksi event tidak boleh digabung dengan perubahan saldo/tanggal pelunasan.");
      const receipt = history.payments.find(payment => payment.paymentId === payload.paymentEventId);
      if (!history.valid || !receipt) throw new InvalidPaymentChange("Event pembayaran tidak ditemukan atau histori tidak konsisten.");
      if (!Number.isSafeInteger(payload.paymentEventAmount) || Number(payload.paymentEventAmount) < 0) throw new InvalidPaymentChange("Nominal event harus integer nonnegatif.");
      const reason = typeof payload.correctionReason === "string" ? payload.correctionReason.trim() : "";
      if (reason.length < 3 || reason.length > 500) throw new InvalidPaymentChange("Alasan koreksi wajib diisi (3–500 karakter).");
      const date = validReceivedDate(payload.paymentEventDate);
      const amount = Number(payload.paymentEventAmount);
      updates.paidAmount = before.paidAmount + amount - receipt.amount;
      if (!Number.isSafeInteger(updates.paidAmount) || updates.paidAmount < 0) throw new InvalidPaymentChange("Koreksi membuat saldo terbayar tidak valid.");
      event = { version: 1, kind: "receipt_correction", previousEventId: history.lastEventId, previousPaidAmount: before.paidAmount, paidAmount: updates.paidAmount, paymentId: receipt.paymentId, amount, paymentDate: date, reason };
      if (before.status === "done" && receipt.paymentId === history.settlementPaymentId) updates.processedAt = `${date}T00:00:00.000Z`;
    } else if (updates.paidAmount !== undefined && updates.paidAmount !== before.paidAmount) {
      const delta = updates.paidAmount - before.paidAmount;
      if (payload.paymentKind === "receipt") {
        if (delta <= 0) throw new InvalidPaymentChange("Penerimaan baru harus menambah saldo. Gunakan koreksi untuk perubahan lainnya.");
        const date = validReceivedDate(payload.receivedDate);
        event = { version: 1, kind: "receipt", previousEventId: history.lastEventId, previousPaidAmount: before.paidAmount, paidAmount: updates.paidAmount, paymentId: randomId(), amount: delta, paymentDate: date, settlesInvoice: before.paidAmount < before.totalAmount && updates.paidAmount >= before.totalAmount && before.totalAmount > 0 };
        if (updates.paidAmount >= before.totalAmount && before.totalAmount > 0 && before.status !== "cancelled") updates.processedAt = `${date}T00:00:00.000Z`;
        if (payload.paymentDate !== undefined && payload.paymentDate !== date) throw new InvalidPaymentChange("Tanggal pelunasan dan penerimaan baru harus sama.");
      } else if (payload.paymentKind === "correction") {
        const reason = typeof payload.correctionReason === "string" ? payload.correctionReason.trim() : "";
        if (reason.length < 3 || reason.length > 500) throw new InvalidPaymentChange("Alasan koreksi wajib diisi (3–500 karakter).");
        event = { version: 1, kind: "unallocated_adjustment", previousEventId: history.lastEventId, previousPaidAmount: before.paidAmount, paidAmount: updates.paidAmount, reason };
      } else throw new InvalidPaymentChange("Pilih paymentKind receipt atau correction untuk perubahan saldo terbayar.");
    } else if (payload.paymentDate !== undefined && updates.processedAt !== before.processedAt) {
      // Date-only settlement correction moves ONLY the final factual receipt.
      // A legacy paidAmount without a receipt stays explicitly unallocated.
      const receipt = history.valid ? history.payments.find(payment => payment.paymentId === history.settlementPaymentId) : undefined;
      event = receipt ? { version: 1, kind: "receipt_correction", previousEventId: history.lastEventId, previousPaidAmount: before.paidAmount, paidAmount: before.paidAmount, paymentId: receipt.paymentId, amount: receipt.amount, paymentDate: validReceivedDate(updates.processedAt!.slice(0, 10)), reason: "Koreksi tanggal pelunasan" }
        : { version: 1, kind: "settlement_date", previousEventId: history.lastEventId, previousPaidAmount: before.paidAmount, paidAmount: before.paidAmount };
    }
    if (event && !history.valid) throw new InvoiceChangeConflict("Histori pembayaran tidak konsisten. Perlu rekonsiliasi sebelum perubahan baru.");
    if (updates.paidAmount !== undefined) {
      updates.status = before.status === "cancelled" ? "cancelled" : updates.paidAmount >= before.totalAmount && before.totalAmount > 0 ? "done" : "pending";
      if (updates.status !== "done") updates.processedAt = null;
    }
    await tx.update(invoiceDocuments).set({ ...updates, updatedAt: now.toISOString() }).where(eq(invoiceDocuments.id, before.id));
    await tx.insert(appAdminAuditLogs).values({
      id: randomId(), action: "invoice_updated", actorUserId: actor.id, actorUsername: actor.username,
      ipAddress: actor.ipAddress, createdAt: now.toISOString(),
      detailsJson: { ...details, invoiceId: before.id, paidAmount: updates.paidAmount,
        previousPaidAmount: updates.paidAmount !== undefined ? before.paidAmount : undefined,
        previousPaymentDate: updates.processedAt !== undefined ? before.processedAt : undefined,
        paymentDate: updates.processedAt, status: updates.status, paymentHistory: event },
    });
    return { ...updates, paymentEvent: event?.paymentId ? { paymentId: event.paymentId, amount: event.amount, paymentDate: event.paymentDate } : undefined };
  });
}
