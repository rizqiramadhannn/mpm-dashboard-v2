import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { invoiceDocuments, sphDocuments } from "../../../../../db/schema";
import { invoiceDocumentsApiAuthorization } from "../../../../invoice-documents-api-auth";
import { validateSignedTtb } from "../../../../invoice/signed-ttb-pdf";
import { isCalendarDate, wibDate } from "../../../../invoice/payment-history";
import { persistInvoiceChange, InvoiceChangeConflict, InvalidPaymentChange } from "../../../../invoice/payment-history-storage";

export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await invoiceDocumentsApiAuthorization(request);
  if (auth !== 200) return reply({ error: "Unauthorized or forbidden" }, auth);
  try {
    if (Number(request.headers.get("content-length")) > 16 * 1024 * 1024) return reply({ error: "File terlalu besar" }, 413);
    const form = await request.formData();
    if ([...form.keys()].some(key => !["payload", "paymentProofFile"].includes(key)) || form.getAll("payload").length !== 1 || form.getAll("paymentProofFile").length !== 1)
      return reply({ error: "Payload dan satu bukti bayar wajib" }, 400);
    const raw = form.get("payload");
    if (typeof raw !== "string") return reply({ error: "Payload tidak valid" }, 400);
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).some(key => !["expectedInvoiceNo", "expectedTotalAmount", "expectedPaidAmount", "receiptAmount", "paymentDate"].includes(key)))
      return reply({ error: "Payload settlement tidak valid" }, 400);
    if (typeof payload.expectedInvoiceNo !== "string" || !Number.isSafeInteger(payload.expectedTotalAmount) || payload.expectedTotalAmount <= 0 ||
        !Number.isSafeInteger(payload.expectedPaidAmount) || payload.expectedPaidAmount < 0 || !Number.isSafeInteger(payload.receiptAmount) || payload.receiptAmount <= 0 ||
        !isCalendarDate(payload.paymentDate) || payload.paymentDate > wibDate(new Date()))
      return reply({ error: "Identitas, saldo, nominal receipt dan tanggal wajib valid" }, 400);
    const file = form.get("paymentProofFile");
    if (!(file instanceof File) || !file.size || file.size > 15 * 1024 * 1024) return reply({ error: "Bukti bayar wajib, maksimum 15 MB" }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = await validateSignedTtb(bytes);
    const base64 = Buffer.from(bytes).toString("base64");
    const sha256 = createHash("sha256").update(base64).digest("hex");
    const db = await getDb();
    const [before] = await db.select({ id: invoiceDocuments.id, invoiceNo: invoiceDocuments.invoiceNo, invoiceDate: invoiceDocuments.invoiceDate,
      totalAmount: invoiceDocuments.totalAmount, paidAmount: invoiceDocuments.paidAmount, status: invoiceDocuments.status,
      processedAt: invoiceDocuments.processedAt, paymentProofFilesJson: invoiceDocuments.paymentProofFilesJson, sphStatus: sphDocuments.status })
      .from(invoiceDocuments).innerJoin(sphDocuments, eq(invoiceDocuments.sphId, sphDocuments.id))
      .where(eq(invoiceDocuments.id, (await context.params).id)).limit(1);
    if (!before || before.status === "cancelled") return reply({ error: "Invoice tidak tersedia" }, 404);
    if (payload.expectedInvoiceNo !== before.invoiceNo || payload.expectedTotalAmount !== before.totalAmount)
      return reply({ error: "Nomor/total invoice berubah" }, 409);
    const existing = before.paymentProofFilesJson ?? [];
    const sameProof = existing.some(proof => proof.base64 === base64);
    const isPaid = before.paidAmount === before.totalAmount && before.status === "done";
    if (isPaid && sameProof && before.processedAt?.slice(0, 10) === payload.paymentDate && payload.receiptAmount <= before.totalAmount)
      return reply({ data: { id: before.id, invoiceNo: before.invoiceNo, paidAmount: before.paidAmount, status: before.status, paymentDate: payload.paymentDate, paymentProofCount: existing.length, reused: true } });
    if (payload.expectedPaidAmount !== before.paidAmount || before.paidAmount > before.totalAmount ||
        (!isPaid && payload.receiptAmount !== before.totalAmount - before.paidAmount) || (isPaid && before.processedAt?.slice(0, 10) !== payload.paymentDate))
      return reply({ error: "Saldo/nominal/tanggal tidak cocok; rekonsiliasi sebelum retry" }, 409);
    if (sameProof && !isPaid) return reply({ error: "Bukti sudah ada tetapi saldo belum sesuai; perlu rekonsiliasi" }, 409);
    const proof = { name: file.name.replace(/[\\/:*?"<>|\x00-\x1f]+/g, "-").trim() || "payment-proof", mimeType, size: bytes.length, base64, sha256 };
    const updates = { paidAmount: before.totalAmount, paymentProofFilesJson: [...existing.filter(proof => proof.base64), proof] };
    const saved = await persistInvoiceChange(db, before, updates,
      { expectedPaidAmount: before.paidAmount, paymentKind: "receipt", receivedDate: payload.paymentDate },
      { invoiceId: before.id, invoiceNo: before.invoiceNo, paymentProofFilesAdded: 1, proofSha256: sha256 },
      { id: null, username: "invoice-documents-api", ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown" });
    return reply({ data: { id: before.id, invoiceNo: before.invoiceNo, paidAmount: saved.paidAmount, status: saved.status,
      paymentDate: (saved.processedAt ?? before.processedAt)?.slice(0, 10), paymentProofCount: updates.paymentProofFilesJson.length, reused: false } });
  } catch (error) {
    if (error instanceof InvoiceChangeConflict) return reply({ error: error.message }, 409);
    if (error instanceof InvalidPaymentChange) return reply({ error: error.message }, 400);
    return reply({ error: "Settlement gagal; rekonsiliasi sebelum retry" }, 400);
  }
}
