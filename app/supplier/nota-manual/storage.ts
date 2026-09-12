import { count, desc, eq, sql } from "drizzle-orm";
import type { getDb } from "../../../db";
import { appAdminAuditLogs, manualNoteCounters, supplierNoteItems, supplierNotes, suppliers } from "../../../db/schema";
import { ManualNoteError, manualNoteNumber, validateManualNote } from "./model";
import { generateManualNotePdf } from "./pdf";

type Db = Awaited<ReturnType<typeof getDb>>;
type Actor = { id: string; username: string; ipAddress: string };
function base64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
async function hash(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
function result(note: { id: string; noteNo: string }, reused: boolean) {
  return { ...note, reused, previewUrl: `/supplier/nota-supplier/download/${note.id}?type=invoice&inline=1` };
}

export async function createManualNote(db: Db, value: unknown, actor: Actor, render = generateManualNotePdf) {
  const input = validateManualNote(value);
  const key = `${actor.id}:${input.idempotencyKey}`;
  const payloadHash = await hash(new TextEncoder().encode(JSON.stringify({ noteDate: input.noteDate, supplierId: input.supplierId, items: input.items })));
  const save = () => db.transaction(async tx => {
    // Acquire the write lock before looking up idempotency. All concurrent
    // writers serialize here, including retries with the same request key.
    const [counter] = await tx.insert(manualNoteCounters).values({ noteDate: input.noteDate, lastSequence: 1 })
      .onConflictDoUpdate({ target: manualNoteCounters.noteDate, set: { lastSequence: sql`${manualNoteCounters.lastSequence} + 1` } })
      .returning({ sequence: manualNoteCounters.lastSequence });
    const [existing] = await tx.select({ id: supplierNotes.id, noteNo: supplierNotes.noteNo, hash: supplierNotes.manualPayloadHash })
      .from(supplierNotes).where(eq(supplierNotes.manualIdempotencyKey, key)).limit(1);
    if (existing) {
      if (existing.hash !== payloadHash) throw new ManualNoteError("Kunci request telah dipakai untuk data berbeda. Muat ulang halaman untuk membuat nota baru.", 409);
      // Undo the allocation on replay without consuming a daily number.
      await tx.update(manualNoteCounters).set({ lastSequence: sql`${manualNoteCounters.lastSequence} - 1` }).where(eq(manualNoteCounters.noteDate, input.noteDate));
      return result({ id: existing.id, noteNo: existing.noteNo }, true);
    }
    const [supplier] = await tx.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
    if (!supplier) throw new ManualNoteError("Supplier tidak ditemukan. Pilih supplier dari master.");
    const noteNo = manualNoteNumber(input.noteDate, counter.sequence);
    const pdf = render({ noteNo, noteDate: input.noteDate, supplierName: supplier.name, items: input.items, amount: input.amount });
    const fileBase64 = base64(pdf);
    const sha256 = await hash(pdf);
    const fileName = `${noteNo}.pdf`;
    const [note] = await tx.insert(supplierNotes).values({
      supplierId: supplier.id, noteNo, noteDate: input.noteDate, noteSource: "manual",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      manualIdempotencyKey: key, manualPayloadHash: payloadHash,
      itemSummary: input.items.map(item => item.description).join("; "), amount: input.amount,
      paymentStatus: "BELUM BAYAR", paidAmount: 0, remainingPayment: input.amount,
      category: "Spareparts", flag: "MPM", purchasePurpose: "Pembelian Langsung",
      sourceFileName: fileName, sourceFileMimeType: "application/pdf", sourceFileSize: pdf.length, sourceFileBase64: fileBase64, sourceFileSha256: sha256,
      invoiceFileName: fileName, invoiceFileMimeType: "application/pdf", invoiceFileSize: pdf.length, invoiceFileBase64: fileBase64, invoiceFileSha256: sha256,
    }).returning({ id: supplierNotes.id, noteNo: supplierNotes.noteNo });
    await tx.insert(supplierNoteItems).values(input.items.map((item, i) => ({ ...item, supplierNoteId: note.id, lineNo: i + 1, uom: "Pcs", flag: "MPM" })));
    // Same audit table and action convention as recordActivityLog, but inside
    // the transaction: audit failures cannot cause a committed-but-failed reply.
    await tx.insert(appAdminAuditLogs).values({ actorUserId: actor.id, actorUsername: actor.username, ipAddress: actor.ipAddress, action: "supplier_manual_note_create", detailsJson: { id: note.id, noteNo, supplierId: supplier.id, itemCount: input.items.length, amount: input.amount } });
    return result(note, false);
  });
  for (let attempt = 0; ; attempt++) {
    try { return await save(); }
    catch (error) {
      const cause = error instanceof Error && error.cause ? error.cause : error;
      const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
      if (attempt >= 6 || !/SQLITE_BUSY|SQLITE_LOCKED/.test(code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 40 * 2 ** attempt));
    }
  }
}

export async function listManualNotes(db: Db) {
  return db.select({ id: supplierNotes.id, noteDate: supplierNotes.noteDate, noteNo: supplierNotes.noteNo, supplierName: suppliers.name, amount: supplierNotes.amount, itemCount: count(supplierNoteItems.id) })
    .from(supplierNotes).innerJoin(suppliers, eq(suppliers.id, supplierNotes.supplierId))
    .leftJoin(supplierNoteItems, eq(supplierNoteItems.supplierNoteId, supplierNotes.id))
    .where(eq(supplierNotes.noteSource, "manual"))
    .groupBy(supplierNotes.id).orderBy(desc(supplierNotes.createdAt), desc(supplierNotes.noteNo));
}
