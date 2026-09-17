import { eq } from "drizzle-orm";
import type { getDb } from "../../db";
import { sphDocuments, sphItems, invoiceDocuments, invoiceItems } from "../../db/schema";
import { normalizedSphStatus } from "./workflow";

type Db = Awaited<ReturnType<typeof getDb>>;
function invoiceNoFromSph(sphNo: string) {
  return sphNo.startsWith("SPH") ? `INV${sphNo.slice(3)}` : `INV-${sphNo}`;
}

export async function approveSphPrice(db: Db, sphId: string) {
  return db.transaction(async tx => {
    const [document] = await tx.select({ status: sphDocuments.status, sphNo: sphDocuments.sphNo })
      .from(sphDocuments).where(eq(sphDocuments.id, sphId)).limit(1);
    if (!document) throw new Error("SPH tidak ditemukan.");
    const status = normalizedSphStatus(document.status);
    if (status === "menunggu_po_konfirmasi") return null;
    if (status !== "cek_harga") throw new Error("Hanya SPH Cek Harga yang bisa di-approve harga.");
    const items = await tx.select({ id: sphItems.id }).from(sphItems).where(eq(sphItems.sphId, sphId)).limit(1);
    if (!items.length) throw new Error("SPH belum memiliki item.");
    await tx.update(sphDocuments).set({ status: "menunggu_po_konfirmasi" }).where(eq(sphDocuments.id, sphId));
    return document;
  });
}

export async function confirmSphPo(db: Db, sphId: string) {
  return db.transaction(async tx => {
    const [document] = await tx
      .select({
        amountInWords: sphDocuments.amountInWords,
        customerDetailLine1: sphDocuments.customerDetailLine1,
        customerDetailLine2: sphDocuments.customerDetailLine2,
        customerDetailLine3: sphDocuments.customerDetailLine3,
        customerName: sphDocuments.customerName,
        franco: sphDocuments.franco,
        id: sphDocuments.id,
        paymentDueDate: sphDocuments.paymentDueDate,
        paymentTerm: sphDocuments.paymentTerm,
        sphDate: sphDocuments.sphDate,
        sphNo: sphDocuments.sphNo,
        status: sphDocuments.status,
        totalAmount: sphDocuments.totalAmount,
      })
      .from(sphDocuments)
      .where(eq(sphDocuments.id, sphId))
      .limit(1);

    if (!document) {
      throw new Error("SPH tidak ditemukan.");
    }

    const status = normalizedSphStatus(document.status);
    if (status === "menunggu_pengiriman") return null;
    if (status !== "menunggu_po_konfirmasi") {
      throw new Error("SPH harus Menunggu PO / Konfirmasi sebelum konfirmasi PO.");
    }

    const items = await tx
      .select({
        id: sphItems.id,
        lineNo: sphItems.lineNo,
        partName: sphItems.partName,
        partNumber: sphItems.partNumber,
        quantity: sphItems.quantity,
        totalPrice: sphItems.totalPrice,
        unitPrice: sphItems.unitPrice,
      })
      .from(sphItems)
      .where(eq(sphItems.sphId, sphId));

    if (items.length === 0) {
      throw new Error("SPH belum memiliki item.");
    }

    const [existingInvoice] = await tx
      .select({
        id: invoiceDocuments.id,
        paidAmount: invoiceDocuments.paidAmount,
      })
      .from(invoiceDocuments)
      .where(eq(invoiceDocuments.sphId, sphId))
      .limit(1);

    const invoiceValues = {
      amountInWords: document.amountInWords,
      customerDetailLine1: document.customerDetailLine1,
      customerDetailLine2: document.customerDetailLine2,
      customerDetailLine3: document.customerDetailLine3,
      customerName: document.customerName,
      franco: document.franco,
      invoiceDate: document.sphDate,
      invoiceNo: invoiceNoFromSph(document.sphNo),
      paymentDueDate: document.paymentDueDate,
      paymentTerm: document.paymentTerm,
      sphId,
      status: "pending" as const,
      totalAmount: document.totalAmount,
    };
    const invoiceId = existingInvoice
      ? existingInvoice.id
      : (
          await tx
            .insert(invoiceDocuments)
            .values(invoiceValues)
            .returning({ id: invoiceDocuments.id })
        )[0].id;

    if (existingInvoice) {
      await tx
        .update(invoiceDocuments)
        .set({
          ...invoiceValues,
          status:
            document.totalAmount > 0 && existingInvoice.paidAmount >= document.totalAmount
              ? "done"
              : "pending",
        })
        .where(eq(invoiceDocuments.id, existingInvoice.id));
      await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, existingInvoice.id));
    }

    await tx.insert(invoiceItems).values(
      items.map((item) => ({
        invoiceId,
        lineNo: item.lineNo,
        partName: item.partName,
        partNumber: item.partNumber,
        quantity: item.quantity,
        sphItemId: item.id,
        totalPrice: item.totalPrice,
        unitPrice: item.unitPrice,
      }))
    );

    await tx
      .update(sphDocuments)
      .set({ status: "menunggu_pengiriman" })
      .where(eq(sphDocuments.id, sphId));

    return { invoiceId, sphNo: document.sphNo, totalAmount: document.totalAmount, customerName: document.customerName };
  });
}
