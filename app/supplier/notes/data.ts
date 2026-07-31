import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { supplierNoteItems, supplierNotes, suppliers } from "../../../db/schema";

type SupplierNoteFileInput = {
  name?: unknown;
  mimeType?: unknown;
  size?: unknown;
  base64?: unknown;
};

type SupplierNoteItemInput = {
  partNumber?: unknown;
  description?: unknown;
  quantity?: unknown;
  uom?: unknown;
  unitPrice?: unknown;
  totalPrice?: unknown;
  dueDate?: unknown;
  status?: unknown;
  shortCode?: unknown;
  flag?: unknown;
};

export type SupplierNotePayload = {
  supplierName?: unknown;
  noteNo?: unknown;
  noteDate?: unknown;
  taxStatus?: unknown;
  itemSummary?: unknown;
  category?: unknown;
  amount?: unknown;
  paymentStatus?: unknown;
  paidAmount?: unknown;
  paymentTerm?: unknown;
  paymentDeadline?: unknown;
  paymentDate?: unknown;
  purchasePurpose?: unknown;
  customerName?: unknown;
  flag?: unknown;
  file?: SupplierNoteFileInput;
  items?: unknown;
};

export type CreatedSupplierNote = {
  id: number;
  supplierId: number;
  supplierName: string;
  noteNo: string;
  itemCount: number;
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function requiredString(value: unknown, label: string) {
  const text = asString(value);

  if (!text) {
    throw new Error(`${label} wajib diisi.`);
  }

  return text;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function normalizeDate(value: unknown) {
  const text = asString(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(new Date());
}

export function normalizeSupplierName(name: string) {
  return name
    .toUpperCase()
    .replace(/\b(PT|CV|UD|TBK|PERSERO)\b/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBase64(value: unknown) {
  const text = asString(value);
  const [, dataUrlBase64] = text.match(/^data:[^;]+;base64,(.*)$/) ?? [];
  return dataUrlBase64 ?? text;
}

async function sha256(text: string) {
  if (!text) {
    return "";
  }

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseItems(value: unknown, fallbackFlag: string) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("items wajib diisi minimal 1 baris.");
  }

  return value.map((raw, index) => {
    const item = raw as SupplierNoteItemInput;
    const quantity = asNumber(item.quantity);
    const unitPrice = Math.round(asNumber(item.unitPrice));
    const totalPrice = Math.round(asNumber(item.totalPrice, quantity * unitPrice));

    return {
      lineNo: index + 1,
      partNumber: asString(item.partNumber),
      description: requiredString(item.description, `items[${index}].description`),
      quantity,
      uom: asString(item.uom, "Pcs") || "Pcs",
      unitPrice,
      totalPrice,
      dueDate: asString(item.dueDate) || null,
      status: asString(item.status),
      shortCode: asString(item.shortCode),
      flag: asString(item.flag, fallbackFlag) || fallbackFlag,
    };
  });
}

export async function createSupplierNote(payload: SupplierNotePayload) {
  const supplierName = requiredString(payload.supplierName, "supplierName");
  const normalizedName = normalizeSupplierName(supplierName);
  const noteNo = requiredString(payload.noteNo, "noteNo");
  const noteDate = normalizeDate(payload.noteDate);
  const flag = asString(payload.flag, "MPM") || "MPM";
  const items = parseItems(payload.items, flag);
  const amount = Math.round(
    asNumber(
      payload.amount,
      items.reduce((sum, item) => sum + item.totalPrice, 0)
    )
  );
  const paidAmount = Math.round(asNumber(payload.paidAmount));
  const fileBase64 = normalizeBase64(payload.file?.base64);
  const fileName = asString(payload.file?.name);
  const fileMimeType = asString(payload.file?.mimeType);
  const fileSize = Math.round(asNumber(payload.file?.size));
  const fileSha256 = await sha256(fileBase64);
  const db = await getDb();

  return db.transaction(async (tx) => {
    let [supplier] = await tx
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.normalizedName, normalizedName))
      .limit(1);

    if (!supplier) {
      const [createdSupplier] = await tx
        .insert(suppliers)
        .values({
          name: supplierName,
          normalizedName,
        })
        .returning({ id: suppliers.id, name: suppliers.name });
      supplier = createdSupplier;
    }

    const [existing] = await tx
      .select({ id: supplierNotes.id })
      .from(supplierNotes)
      .where(
        and(eq(supplierNotes.supplierId, supplier.id), eq(supplierNotes.noteNo, noteNo))
      )
      .limit(1);

    if (existing) {
      throw new Error(`Nota ${noteNo} untuk ${supplier.name} sudah ada.`);
    }

    const [note] = await tx
      .insert(supplierNotes)
      .values({
        supplierId: supplier.id,
        noteNo,
        noteDate,
        itemSummary: asString(payload.itemSummary, items[0]?.description ?? ""),
        category: asString(payload.category, "Spareparts") || "Spareparts",
        amount,
        paymentStatus:
          asString(payload.paymentStatus, "BELUM BAYAR") || "BELUM BAYAR",
        paidAmount,
        remainingPayment: Math.max(amount - paidAmount, 0),
        paymentTerm: asString(payload.paymentTerm),
        paymentDeadline: asString(payload.paymentDeadline) || null,
        paymentDate: asString(payload.paymentDate) || null,
        purchasePurpose: asString(payload.purchasePurpose),
        customerName: asString(payload.customerName),
        flag,
        sourceFileName: fileName,
        sourceFileMimeType: fileMimeType,
        sourceFileSize: fileSize,
        sourceFileBase64: fileBase64,
        sourceFileSha256: fileSha256,
        extractionJson: {
          taxStatus: asString(payload.taxStatus),
          input: payload,
        },
      })
      .returning({ id: supplierNotes.id });

    await tx.insert(supplierNoteItems).values(
      items.map((item) => ({
        ...item,
        supplierNoteId: note.id,
      }))
    );

    return {
      id: note.id,
      supplierId: supplier.id,
      supplierName: supplier.name,
      noteNo,
      itemCount: items.length,
    } satisfies CreatedSupplierNote;
  });
}

export async function listSupplierNotes() {
  const db = await getDb();
  const notes = await db
    .select({
      id: supplierNotes.id,
      supplierId: supplierNotes.supplierId,
      supplierName: suppliers.name,
      noteNo: supplierNotes.noteNo,
      noteDate: supplierNotes.noteDate,
      itemSummary: supplierNotes.itemSummary,
      category: supplierNotes.category,
      amount: supplierNotes.amount,
      paymentStatus: supplierNotes.paymentStatus,
      paidAmount: supplierNotes.paidAmount,
      remainingPayment: supplierNotes.remainingPayment,
      paymentTerm: supplierNotes.paymentTerm,
      paymentDeadline: supplierNotes.paymentDeadline,
      purchasePurpose: supplierNotes.purchasePurpose,
      customerName: supplierNotes.customerName,
      flag: supplierNotes.flag,
      sourceFileName: supplierNotes.sourceFileName,
      sourceFileMimeType: supplierNotes.sourceFileMimeType,
      sourceFileSize: supplierNotes.sourceFileSize,
      createdAt: supplierNotes.createdAt,
    })
    .from(supplierNotes)
    .innerJoin(suppliers, eq(supplierNotes.supplierId, suppliers.id))
    .orderBy(desc(supplierNotes.noteDate), desc(supplierNotes.id));

  const noteIds = notes.map((note) => note.id);
  const items =
    noteIds.length > 0
      ? await db
          .select({
            id: supplierNoteItems.id,
            supplierNoteId: supplierNoteItems.supplierNoteId,
            lineNo: supplierNoteItems.lineNo,
            partNumber: supplierNoteItems.partNumber,
            description: supplierNoteItems.description,
            quantity: supplierNoteItems.quantity,
            uom: supplierNoteItems.uom,
            unitPrice: supplierNoteItems.unitPrice,
            totalPrice: supplierNoteItems.totalPrice,
          })
          .from(supplierNoteItems)
          .where(inArray(supplierNoteItems.supplierNoteId, noteIds))
      : [];

  const itemsByNote = new Map<number, typeof items>();

  for (const item of items) {
    const noteItems = itemsByNote.get(item.supplierNoteId) ?? [];
    noteItems.push(item);
    itemsByNote.set(item.supplierNoteId, noteItems);
  }

  for (const noteItems of itemsByNote.values()) {
    noteItems.sort((a, b) => a.lineNo - b.lineNo);
  }

  return notes.map((note) => ({
    ...note,
    items: itemsByNote.get(note.id) ?? [],
  }));
}

export async function getSupplierNoteFile(id: number) {
  const db = await getDb();
  const [file] = await db
    .select({
      noteNo: supplierNotes.noteNo,
      sourceFileName: supplierNotes.sourceFileName,
      sourceFileMimeType: supplierNotes.sourceFileMimeType,
      sourceFileBase64: supplierNotes.sourceFileBase64,
    })
    .from(supplierNotes)
    .where(eq(supplierNotes.id, id))
    .limit(1);

  return file;
}
