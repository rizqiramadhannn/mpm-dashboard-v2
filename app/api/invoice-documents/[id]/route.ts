import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { randomId } from "../../../../db/id";
import { appAdminAuditLogs, invoiceDocuments, sphDocuments } from "../../../../db/schema";
import { invoiceDocumentsApiAuthorization } from "../../../invoice-documents-api-auth";
import { validateSignedTtb } from "../../../invoice/signed-ttb-pdf";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const response = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function findInvoice(id: string) {
  const db = await getDb();
  const [row] = await db.select({ id: invoiceDocuments.id, invoiceNo: invoiceDocuments.invoiceNo,
    sphNo: sphDocuments.sphNo, customerName: invoiceDocuments.customerName, totalAmount: invoiceDocuments.totalAmount,
    paidAmount: invoiceDocuments.paidAmount, status: invoiceDocuments.status, sphStatus: sphDocuments.status,
    paymentDate: invoiceDocuments.processedAt,
    paymentProofCount: sql<number>`json_array_length(${invoiceDocuments.paymentProofFilesJson})`,
    ttbSignedFileName: invoiceDocuments.ttbSignedFileName, ttbSignedFileSize: invoiceDocuments.ttbSignedFileSize,
    ttbSignedFileSha256: invoiceDocuments.ttbSignedFileSha256 })
    .from(invoiceDocuments).innerJoin(sphDocuments, eq(invoiceDocuments.sphId, sphDocuments.id))
    .where(eq(invoiceDocuments.id, id)).limit(1);
  return row?.status !== "cancelled" ? row : null;
}
export async function GET(request: Request, context: Context) {
  const auth = await invoiceDocumentsApiAuthorization(request);
  if (auth !== 200) return response({ error: "Unauthorized or forbidden" }, auth);
  const row = await findInvoice((await context.params).id);
  return row ? response({ data: row }) : response({ error: "Invoice tidak ditemukan" }, 404);
}
export async function PATCH(request: Request, context: Context) {
  const auth = await invoiceDocumentsApiAuthorization(request);
  if (auth !== 200) return response({ error: "Unauthorized or forbidden" }, auth);
  try {
    if (Number(request.headers.get("content-length")) > 16 * 1024 * 1024) return response({ error: "File terlalu besar" }, 413);
    const form = await request.formData();
    if ([...form.keys()].some(key => !["invoiceNo", "expectedTtbSha256", "signedTtbFile"].includes(key)))
      return response({ error: "API ini hanya menerima lampiran TTB" }, 400);
    if (form.getAll("signedTtbFile").length !== 1 || form.getAll("invoiceNo").length !== 1 || form.getAll("expectedTtbSha256").length !== 1)
      return response({ error: "Nomor invoice, guard lampiran, dan satu file TTB wajib" }, 400);
    const row = await findInvoice((await context.params).id);
    if (!row) return response({ error: "Invoice tidak ditemukan" }, 404);
    if (form.get("invoiceNo") !== row.invoiceNo) return response({ error: "Nomor invoice tidak cocok" }, 409);
    const file = form.get("signedTtbFile");
    if (!(file instanceof File) || !file.size || file.size > 15 * 1024 * 1024) return response({ error: "TTB wajib, maksimum 15 MB" }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = await validateSignedTtb(bytes);
    const base64 = Buffer.from(bytes).toString("base64");
    const sha256 = createHash("sha256").update(base64).digest("hex");
    if (row.ttbSignedFileSha256 === sha256) return response({ data: row, duplicate: true });
    if (form.get("expectedTtbSha256") !== row.ttbSignedFileSha256) return response({ error: "Lampiran berubah; cek kembali" }, 409);
    const name = file.name.replace(/[\\/:*?"<>|\x00-\x1f]+/g, "-").trim() || "TTB.pdf";
    const db = await getDb();
    const saved = await db.transaction(async tx => {
      const changed = await tx.update(invoiceDocuments).set({ ttbSignedFileName: name, ttbSignedFileMimeType: mimeType,
        ttbSignedFileSize: bytes.length, ttbSignedFileBase64: base64, ttbSignedFileSha256: sha256, updatedAt: new Date().toISOString() })
        .where(and(eq(invoiceDocuments.id, row.id), eq(invoiceDocuments.invoiceNo, row.invoiceNo),
          eq(invoiceDocuments.ttbSignedFileSha256, row.ttbSignedFileSha256))).returning({ id: invoiceDocuments.id });
      if (!changed.length) return false;
      await tx.insert(appAdminAuditLogs).values({ id: randomId(), action: "invoice_updated", actorUserId: null,
        actorUsername: "invoice-documents-api", ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown",
        detailsJson: { invoiceId: row.id, invoiceNo: row.invoiceNo, signedTtbUpdated: true, ttbSignedFileName: name, ttbSignedFileSha256: sha256 } });
      return true;
    });
    return saved ? response({ data: { ...row, ttbSignedFileName: name, ttbSignedFileSize: bytes.length, ttbSignedFileSha256: sha256 } })
      : response({ error: "Lampiran berubah; cek kembali" }, 409);
  } catch {
    return response({ error: "TTB gagal disimpan; periksa format file dan rekonsiliasi sebelum retry" }, 400);
  }
}
