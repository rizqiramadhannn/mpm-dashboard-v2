import { and, asc, eq } from "drizzle-orm";
import type { getDb } from "../../../db";
import { appAdminAuditLogs, supplierNoteItems, supplierNotes, suppliers } from "../../../db/schema";
import { ManualNoteError, validateManualNote } from "./model";
import { generateManualNotePdf } from "./pdf";

type Db = Awaited<ReturnType<typeof getDb>>;
type Item = { description: string; quantity: number; unitPrice: number; totalPrice: number; uom: string };

function base64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function hash(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeItems(value: unknown, label: string): Item[] {
  try {
    return validateManualNote({
      noteDate: "2000-01-01",
      supplierId: "correction-review",
      purchasePurpose: "Stock",
      idempotencyKey: "correction-validation",
      items: value,
    }).items.map(item => ({ ...item, uom: item.uom ?? "Pcs" }));
  } catch (error) {
    if (error instanceof ManualNoteError) throw new ManualNoteError(`${label}: ${error.message}`, error.status);
    throw error;
  }
}

function sameItems(left: Item[], right: Item[]) {
  return left.length === right.length && left.every((item, index) => {
    const other = right[index];
    return other && item.description === other.description && item.quantity === other.quantity && item.uom === other.uom && item.unitPrice === other.unitPrice && item.totalPrice === other.totalPrice;
  });
}

export async function correctManualNote(db: Db, id: string, value: unknown, ipAddress: string, render = generateManualNotePdf) {
  if (!value || typeof value !== "object") throw new ManualNoteError("Data koreksi wajib diberikan.");
  const input = value as Record<string, unknown>;
  const expectedAmount = input.expectedAmount;
  const expectedPaidAmount = input.expectedPaidAmount;
  if (typeof expectedAmount !== "number" || !Number.isSafeInteger(expectedAmount) || expectedAmount <= 0 || typeof expectedPaidAmount !== "number" || !Number.isSafeInteger(expectedPaidAmount) || expectedPaidAmount < 0 || expectedPaidAmount > expectedAmount) throw new ManualNoteError("Nominal review tidak valid.");
  const expectedItems = normalizeItems(input.expectedItems, "Item review tidak valid");
  const items = normalizeItems(input.items, "Item koreksi tidak valid");
  if (expectedItems.reduce((sum, item) => sum + item.totalPrice, 0) !== expectedAmount) throw new ManualNoteError("Total item review tidak cocok.");
  const amount = items.reduce((sum, item) => sum + item.totalPrice, 0);
  if (expectedPaidAmount > amount) throw new ManualNoteError("Total baru lebih kecil dari pembayaran yang sudah tercatat.");

  return db.transaction(async tx => {
    const [note] = await tx.select({
      id: supplierNotes.id,
      noteNo: supplierNotes.noteNo,
      noteDate: supplierNotes.noteDate,
      noteSource: supplierNotes.noteSource,
      supplierName: suppliers.name,
      amount: supplierNotes.amount,
      paidAmount: supplierNotes.paidAmount,
    }).from(supplierNotes).innerJoin(suppliers, eq(suppliers.id, supplierNotes.supplierId)).where(eq(supplierNotes.id, id)).limit(1);
    if (!note || note.noteSource !== "manual") throw new ManualNoteError("Nota manual tidak ditemukan.", 404);
    if (note.amount !== expectedAmount) throw new ManualNoteError("Total berubah sejak review.", 409);
    if (note.paidAmount !== expectedPaidAmount) throw new ManualNoteError("Pembayaran berubah sejak review.", 409);
    const currentItems = await tx.select({
      description: supplierNoteItems.description,
      quantity: supplierNoteItems.quantity,
      uom: supplierNoteItems.uom,
      unitPrice: supplierNoteItems.unitPrice,
      totalPrice: supplierNoteItems.totalPrice,
    }).from(supplierNoteItems).where(eq(supplierNoteItems.supplierNoteId, id)).orderBy(asc(supplierNoteItems.lineNo));
    if (!sameItems(currentItems, expectedItems)) throw new ManualNoteError("Item berubah sejak review.", 409);
    if (sameItems(currentItems, items)) return { id, noteNo: note.noteNo, amount: note.amount, paidAmount: note.paidAmount, remainingPayment: note.amount - note.paidAmount, paymentStatus: note.paidAmount === 0 ? "BELUM BAYAR" : note.paidAmount === note.amount ? "LUNAS" : "DP", reused: true };

    const pdf = render({ noteNo: note.noteNo, noteDate: note.noteDate, supplierName: note.supplierName, items, amount });
    const fileBase64 = base64(pdf);
    const sha256 = await hash(pdf);
    const paymentStatus = note.paidAmount === 0 ? "BELUM BAYAR" : note.paidAmount === amount ? "LUNAS" : "DP";
    const [updated] = await tx.update(supplierNotes).set({
      itemSummary: items.map(item => item.description).join("; "),
      amount,
      paymentStatus,
      remainingPayment: amount - note.paidAmount,
      sourceFileSize: pdf.length,
      sourceFileBase64: fileBase64,
      sourceFileSha256: sha256,
      invoiceFileSize: pdf.length,
      invoiceFileBase64: fileBase64,
      invoiceFileSha256: sha256,
      updatedAt: new Date().toISOString(),
    }).where(and(eq(supplierNotes.id, id), eq(supplierNotes.amount, expectedAmount), eq(supplierNotes.paidAmount, expectedPaidAmount))).returning({ id: supplierNotes.id });
    if (!updated) throw new ManualNoteError("Nota berubah sejak review.", 409);
    await tx.delete(supplierNoteItems).where(eq(supplierNoteItems.supplierNoteId, id));
    await tx.insert(supplierNoteItems).values(items.map((item, index) => ({ ...item, supplierNoteId: id, lineNo: index + 1, flag: "MPM" })));
    await tx.insert(appAdminAuditLogs).values({
      actorUserId: null,
      actorUsername: "supplier-notes-api",
      action: "supplier_manual_note_corrected",
      ipAddress,
      detailsJson: { id, noteNo: note.noteNo, previousAmount: note.amount, amount, previousItems: currentItems, items },
    });
    return { id, noteNo: note.noteNo, amount, paidAmount: note.paidAmount, remainingPayment: amount - note.paidAmount, paymentStatus, reused: false, previewUrl: `/supplier/nota-supplier/download/${id}?type=invoice&inline=1` };
  });
}
