import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  supplierNoteImports,
  supplierNoteItems,
  supplierNotes,
  suppliers,
} from "../../../db/schema";

type SupplierNoteFileInput = {
  name?: unknown;
  mimeType?: unknown;
  size?: unknown;
  base64?: unknown;
  url?: unknown;
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
  invoiceFile?: SupplierNoteFileInput;
  invoiceFileUrl?: unknown;
  paymentProofFile?: SupplierNoteFileInput;
  paymentProofFiles?: unknown;
  paymentProofFileUrl?: unknown;
  items?: unknown;
};

export type CreatedSupplierNote = {
  id: string;
  supplierId: string;
  supplierName: string;
  noteNo: string;
  itemCount: number;
};

export type SupplierNoteFilePayload = {
  invoiceFile?: SupplierNoteFileInput;
  paymentProofFiles?: unknown;
};

export type SupplierNoteImportFileInput = {
  name: string;
  mimeType: string;
  size: number;
  base64: string;
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

function fileInput(file: SupplierNoteFileInput | undefined, fallbackUrl?: unknown) {
  const base64 = normalizeBase64(file?.base64);
  const url = asString(file?.url) || asString(fallbackUrl);

  return {
    base64,
    hasFile: Boolean(base64 || url),
    mimeType: asString(file?.mimeType),
    name: asString(file?.name),
    size: Math.round(asNumber(file?.size)),
    url,
  };
}

async function storedFileFromInput(file: ReturnType<typeof fileInput>) {
  return {
    base64: file.base64,
    mimeType: file.mimeType,
    name: file.name,
    sha256: await sha256(file.base64),
    size: file.size,
    url: file.url,
  };
}

function paymentStatusFromAmount(amount: number, paidAmount: number) {
  if (paidAmount <= 0) {
    return "BELUM BAYAR";
  }

  if (paidAmount < amount) {
    return "DP";
  }

  return "LUNAS";
}

function clampPaidAmount(value: unknown, amount: number) {
  return Math.min(Math.max(Math.round(asNumber(value)), 0), amount);
}

type SupplierNoteStoredFile = {
  base64: string;
  mimeType: string;
  name: string;
  sha256: string;
  size: number;
  url: string;
};

async function paymentProofInputs(payload: SupplierNotePayload) {
  const rawFiles = Array.isArray(payload.paymentProofFiles)
    ? payload.paymentProofFiles
    : payload.paymentProofFile
      ? [payload.paymentProofFile]
      : [];
  const files = rawFiles
    .map((file) => fileInput(file as SupplierNoteFileInput))
    .filter((file) => file.hasFile);
  const fallbackUrlFile = fileInput(undefined, payload.paymentProofFileUrl);

  if (fallbackUrlFile.hasFile) {
    files.push(fallbackUrlFile);
  }

  return Promise.all(files.map(storedFileFromInput));
}

function storedPaymentProofFiles(note: {
  paymentProofFileBase64?: string;
  paymentProofFileMimeType?: string;
  paymentProofFileName?: string;
  paymentProofFileSha256?: string;
  paymentProofFileSize?: number;
  paymentProofFileUrl?: string;
  paymentProofFilesJson?: SupplierNoteStoredFile[] | null;
}) {
  const jsonFiles = Array.isArray(note.paymentProofFilesJson)
    ? note.paymentProofFilesJson
    : [];

  if (jsonFiles.length > 0) {
    return jsonFiles.filter((file) => file.base64 || file.url);
  }

  if (note.paymentProofFileName || note.paymentProofFileUrl || note.paymentProofFileBase64) {
    return [
      {
        base64: note.paymentProofFileBase64 ?? "",
        mimeType: note.paymentProofFileMimeType ?? "",
        name: note.paymentProofFileName ?? "",
        sha256: note.paymentProofFileSha256 ?? "",
        size: note.paymentProofFileSize ?? 0,
        url: note.paymentProofFileUrl ?? "",
      },
    ];
  }

  return [];
}

function fileMetadata(file: SupplierNoteStoredFile) {
  return {
    mimeType: file.mimeType,
    name: file.name,
    size: file.size,
    url: file.url,
  };
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
  const invoiceFile = fileInput(payload.invoiceFile ?? payload.file, payload.invoiceFileUrl);
  const paymentProofFiles = await paymentProofInputs(payload);
  const paidAmount = clampPaidAmount(payload.paidAmount, amount);
  const paymentStatus = paymentStatusFromAmount(amount, paidAmount);
  const invoiceFileSha256 = await sha256(invoiceFile.base64);
  const paymentProofFile = paymentProofFiles[0] ?? {
    base64: "",
    mimeType: "",
    name: "",
    sha256: "",
    size: 0,
    url: "",
  };
  const db = await getDb();

  let [supplier] = await db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .where(eq(suppliers.normalizedName, normalizedName))
    .limit(1);

  if (!supplier) {
    const [createdSupplier] = await db
      .insert(suppliers)
      .values({
        name: supplierName,
        normalizedName,
      })
      .returning({ id: suppliers.id, name: suppliers.name });
    supplier = createdSupplier;
  }

  const [existing] = await db
    .select({ id: supplierNotes.id })
    .from(supplierNotes)
    .where(
      and(eq(supplierNotes.supplierId, supplier.id), eq(supplierNotes.noteNo, noteNo))
    )
    .limit(1);

  if (existing) {
    throw new Error(`Nota ${noteNo} untuk ${supplier.name} sudah ada.`);
  }

  const [note] = await db
    .insert(supplierNotes)
    .values({
      supplierId: supplier.id,
      noteNo,
      noteDate,
      itemSummary: asString(payload.itemSummary, items[0]?.description ?? ""),
      category: asString(payload.category, "Spareparts") || "Spareparts",
      amount,
      paymentStatus,
      paidAmount,
      remainingPayment: Math.max(amount - paidAmount, 0),
      paymentTerm: asString(payload.paymentTerm),
      paymentDeadline: asString(payload.paymentDeadline) || null,
      paymentDate: asString(payload.paymentDate) || null,
      purchasePurpose: asString(payload.purchasePurpose),
      customerName: asString(payload.customerName),
      flag,
      sourceFileName: invoiceFile.name,
      sourceFileMimeType: invoiceFile.mimeType,
      sourceFileSize: invoiceFile.size,
      sourceFileBase64: invoiceFile.base64,
      sourceFileSha256: invoiceFileSha256,
      invoiceFileName: invoiceFile.name,
      invoiceFileMimeType: invoiceFile.mimeType,
      invoiceFileSize: invoiceFile.size,
      invoiceFileBase64: invoiceFile.base64,
      invoiceFileUrl: invoiceFile.url,
      invoiceFileSha256,
      paymentProofFileName: paymentProofFile.name,
      paymentProofFileMimeType: paymentProofFile.mimeType,
      paymentProofFileSize: paymentProofFile.size,
      paymentProofFileBase64: paymentProofFile.base64,
      paymentProofFileUrl: paymentProofFile.url,
      paymentProofFileSha256: paymentProofFile.sha256,
      paymentProofFilesJson: paymentProofFiles,
      extractionJson: {
        taxStatus: asString(payload.taxStatus),
        input: payload,
      },
    })
    .returning({ id: supplierNotes.id });

  await db.insert(supplierNoteItems).values(
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
}

export async function createSupplierNoteImport({
  customerId,
  customerName,
  file,
  flag,
  paymentTerm,
  purchasePurpose,
}: {
  customerId?: unknown;
  customerName?: unknown;
  file: SupplierNoteImportFileInput;
  flag: unknown;
  paymentTerm?: unknown;
  purchasePurpose?: unknown;
}) {
  const cleanFlag = asString(flag, "MPM") || "MPM";
  const cleanCustomerName = requiredString(customerName, "customerName");
  const cleanPaymentTerm = asString(paymentTerm, "CBD") || "CBD";
  const cleanPurchasePurpose =
    asString(purchasePurpose, "Pembelian Langsung") || "Pembelian Langsung";
  const cleanFile = fileInput(file);

  if (!cleanFile.hasFile) {
    throw new Error("File nota wajib diupload.");
  }

  if (
    cleanFile.mimeType !== "application/pdf" &&
    !cleanFile.mimeType.startsWith("image/")
  ) {
    throw new Error("File harus PDF atau image.");
  }

  const storedFile = await storedFileFromInput(cleanFile);
  const db = await getDb();
  const [row] = await db
    .insert(supplierNoteImports)
    .values({
      fileBase64: storedFile.base64,
      fileMimeType: storedFile.mimeType,
      fileName: storedFile.name || "nota",
      fileSha256: storedFile.sha256,
      fileSize: storedFile.size,
      flag: cleanFlag,
      customerId: asString(customerId) || null,
      customerName: cleanCustomerName,
      paymentTerm: cleanPaymentTerm,
      purchasePurpose: cleanPurchasePurpose,
      status: "pending",
    })
    .returning({
      createdAt: supplierNoteImports.createdAt,
      customerId: supplierNoteImports.customerId,
      customerName: supplierNoteImports.customerName,
      fileMimeType: supplierNoteImports.fileMimeType,
      fileName: supplierNoteImports.fileName,
      fileSize: supplierNoteImports.fileSize,
      flag: supplierNoteImports.flag,
      id: supplierNoteImports.id,
      paymentTerm: supplierNoteImports.paymentTerm,
      purchasePurpose: supplierNoteImports.purchasePurpose,
      status: supplierNoteImports.status,
    });

  return row;
}

export async function listPendingSupplierNoteImports() {
  const db = await getDb();

  return db
    .select({
      createdAt: supplierNoteImports.createdAt,
      customerId: supplierNoteImports.customerId,
      customerName: supplierNoteImports.customerName,
      fileMimeType: supplierNoteImports.fileMimeType,
      fileName: supplierNoteImports.fileName,
      fileSize: supplierNoteImports.fileSize,
      flag: supplierNoteImports.flag,
      id: supplierNoteImports.id,
      paymentTerm: supplierNoteImports.paymentTerm,
      purchasePurpose: supplierNoteImports.purchasePurpose,
      status: supplierNoteImports.status,
    })
    .from(supplierNoteImports)
    .where(eq(supplierNoteImports.status, "pending"))
    .orderBy(desc(supplierNoteImports.createdAt), desc(supplierNoteImports.id));
}

export async function getSupplierNoteImportFile(id: string) {
  const db = await getDb();
  const [file] = await db
    .select({
      base64: supplierNoteImports.fileBase64,
      fileName: supplierNoteImports.fileName,
      flag: supplierNoteImports.flag,
      mimeType: supplierNoteImports.fileMimeType,
      status: supplierNoteImports.status,
    })
    .from(supplierNoteImports)
    .where(eq(supplierNoteImports.id, id))
    .limit(1);

  return file ?? null;
}

export async function importSupplierNoteFromJson(id: string, payload: SupplierNotePayload) {
  const db = await getDb();
  const [pendingImport] = await db
    .select({
      fileBase64: supplierNoteImports.fileBase64,
      fileMimeType: supplierNoteImports.fileMimeType,
      fileName: supplierNoteImports.fileName,
      fileSize: supplierNoteImports.fileSize,
      flag: supplierNoteImports.flag,
      customerName: supplierNoteImports.customerName,
      paymentTerm: supplierNoteImports.paymentTerm,
      purchasePurpose: supplierNoteImports.purchasePurpose,
      status: supplierNoteImports.status,
    })
    .from(supplierNoteImports)
    .where(eq(supplierNoteImports.id, id))
    .limit(1);

  if (!pendingImport) {
    throw new Error("Pending nota tidak ditemukan.");
  }

  if (pendingImport.status !== "pending") {
    throw new Error("Pending nota sudah diproses.");
  }

  const note = await createSupplierNote({
    ...payload,
    customerName:
      asString(payload.customerName, pendingImport.customerName) ||
      pendingImport.customerName,
    file: {
      base64: pendingImport.fileBase64,
      mimeType: pendingImport.fileMimeType,
      name: pendingImport.fileName,
      size: pendingImport.fileSize,
    },
    flag: asString(payload.flag, pendingImport.flag) || pendingImport.flag,
    invoiceFile: {
      base64: pendingImport.fileBase64,
      mimeType: pendingImport.fileMimeType,
      name: pendingImport.fileName,
      size: pendingImport.fileSize,
    },
    paymentTerm:
      asString(payload.paymentTerm, pendingImport.paymentTerm) ||
      pendingImport.paymentTerm,
    purchasePurpose:
      asString(payload.purchasePurpose, pendingImport.purchasePurpose) ||
      pendingImport.purchasePurpose,
  });

  await db
    .update(supplierNoteImports)
    .set({
      importedJson: payload as Record<string, unknown>,
      importedSupplierNoteId: note.id,
      status: "imported",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(supplierNoteImports.id, id));

  return note;
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
      sourceFileBase64: supplierNotes.sourceFileBase64,
      invoiceFileName: supplierNotes.invoiceFileName,
      invoiceFileMimeType: supplierNotes.invoiceFileMimeType,
      invoiceFileSize: supplierNotes.invoiceFileSize,
      invoiceFileBase64: supplierNotes.invoiceFileBase64,
      invoiceFileUrl: supplierNotes.invoiceFileUrl,
      paymentProofFileName: supplierNotes.paymentProofFileName,
      paymentProofFileMimeType: supplierNotes.paymentProofFileMimeType,
      paymentProofFileSize: supplierNotes.paymentProofFileSize,
      paymentProofFileBase64: supplierNotes.paymentProofFileBase64,
      paymentProofFileUrl: supplierNotes.paymentProofFileUrl,
      paymentProofFilesJson: supplierNotes.paymentProofFilesJson,
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

  const itemsByNote = new Map<string, typeof items>();

  for (const item of items) {
    const noteItems = itemsByNote.get(item.supplierNoteId) ?? [];
    noteItems.push(item);
    itemsByNote.set(item.supplierNoteId, noteItems);
  }

  for (const noteItems of itemsByNote.values()) {
    noteItems.sort((a, b) => a.lineNo - b.lineNo);
  }

  return notes.map((note) => {
    const paidAmount = clampPaidAmount(note.paidAmount, note.amount);
    const paymentStatus = paymentStatusFromAmount(note.amount, paidAmount);
    const hasInvoiceFile = Boolean(note.invoiceFileBase64 || note.sourceFileBase64);
    const paymentProofFiles = storedPaymentProofFiles(note).filter(
      (file) => file.base64
    );

    return {
      amount: note.amount,
      category: note.category,
      createdAt: note.createdAt,
      customerName: note.customerName,
      flag: note.flag,
      id: note.id,
      invoiceFileMimeType: hasInvoiceFile
        ? note.invoiceFileMimeType || note.sourceFileMimeType
        : "",
      invoiceFileName: hasInvoiceFile ? note.invoiceFileName || note.sourceFileName : "",
      invoiceFileSize: hasInvoiceFile
        ? note.invoiceFileSize || note.sourceFileSize
        : 0,
      invoiceFileUrl: "",
      items: itemsByNote.get(note.id) ?? [],
      itemSummary: note.itemSummary,
      noteDate: note.noteDate,
      noteNo: note.noteNo,
      paidAmount,
      paymentDeadline: note.paymentDeadline,
      paymentProofFileMimeType: paymentProofFiles[0]?.mimeType ?? "",
      paymentProofFileName: paymentProofFiles[0]?.name ?? "",
      paymentProofFileSize: paymentProofFiles[0]?.size ?? 0,
      paymentProofFileUrl: "",
      paymentStatus,
      paymentProofFiles: paymentProofFiles.map(fileMetadata),
      paymentTerm: note.paymentTerm,
      purchasePurpose: note.purchasePurpose,
      remainingPayment: Math.max(note.amount - paidAmount, 0),
      sourceFileMimeType: hasInvoiceFile ? note.sourceFileMimeType : "",
      sourceFileName: hasInvoiceFile ? note.sourceFileName : "",
      sourceFileSize: hasInvoiceFile ? note.sourceFileSize : 0,
      supplierId: note.supplierId,
      supplierName: note.supplierName,
    };
  });
}

export async function getSupplierNoteFile(
  id: string,
  type: "invoice" | "paymentProof",
  index = 0
) {
  const db = await getDb();
  const [file] = await db
    .select({
      noteNo: supplierNotes.noteNo,
      sourceFileName: supplierNotes.sourceFileName,
      sourceFileMimeType: supplierNotes.sourceFileMimeType,
      sourceFileBase64: supplierNotes.sourceFileBase64,
      invoiceFileName: supplierNotes.invoiceFileName,
      invoiceFileMimeType: supplierNotes.invoiceFileMimeType,
      invoiceFileBase64: supplierNotes.invoiceFileBase64,
      invoiceFileUrl: supplierNotes.invoiceFileUrl,
      paymentProofFileName: supplierNotes.paymentProofFileName,
      paymentProofFileMimeType: supplierNotes.paymentProofFileMimeType,
      paymentProofFileBase64: supplierNotes.paymentProofFileBase64,
      paymentProofFileUrl: supplierNotes.paymentProofFileUrl,
      paymentProofFileSha256: supplierNotes.paymentProofFileSha256,
      paymentProofFileSize: supplierNotes.paymentProofFileSize,
      paymentProofFilesJson: supplierNotes.paymentProofFilesJson,
    })
    .from(supplierNotes)
    .where(eq(supplierNotes.id, id))
    .limit(1);

  if (!file) {
    return null;
  }

  if (type === "paymentProof") {
    const proofFiles = storedPaymentProofFiles(file);
    const selectedFile = proofFiles[Math.max(index, 0)] ?? proofFiles[0];

    if (selectedFile) {
      return {
        base64: selectedFile.base64,
        fileName: selectedFile.name,
        mimeType: selectedFile.mimeType,
        noteNo: file.noteNo,
        url: "",
      };
    }

    return {
      base64: file.paymentProofFileBase64,
      fileName: file.paymentProofFileName,
      mimeType: file.paymentProofFileMimeType,
      noteNo: file.noteNo,
      url: "",
    };
  }

  return {
    base64: file.invoiceFileBase64 || file.sourceFileBase64,
    fileName: file.invoiceFileName || file.sourceFileName,
    mimeType: file.invoiceFileMimeType || file.sourceFileMimeType,
    noteNo: file.noteNo,
    url: "",
  };
}

export async function updateSupplierNotePaidAmount(id: string, paidAmountInput: unknown) {
  const db = await getDb();
  const [note] = await db
    .select({
      amount: supplierNotes.amount,
    })
    .from(supplierNotes)
    .where(eq(supplierNotes.id, id))
    .limit(1);

  if (!note) {
    throw new Error("Nota supplier tidak ditemukan.");
  }

  const paidAmount = clampPaidAmount(paidAmountInput, note.amount);
  const paymentStatus = paymentStatusFromAmount(note.amount, paidAmount);
  const remainingPayment = Math.max(note.amount - paidAmount, 0);

  await db
    .update(supplierNotes)
    .set({
      paidAmount,
      paymentStatus,
      remainingPayment,
    })
    .where(eq(supplierNotes.id, id));

  return {
    id,
    paidAmount,
    paymentStatus,
    remainingPayment,
  };
}

export async function updateSupplierNoteFiles(
  id: string,
  payload: SupplierNoteFilePayload
) {
  const db = await getDb();
  const [note] = await db
    .select({
      id: supplierNotes.id,
      invoiceFileBase64: supplierNotes.invoiceFileBase64,
      invoiceFileName: supplierNotes.invoiceFileName,
      invoiceFileMimeType: supplierNotes.invoiceFileMimeType,
      invoiceFileSize: supplierNotes.invoiceFileSize,
      invoiceFileUrl: supplierNotes.invoiceFileUrl,
      sourceFileBase64: supplierNotes.sourceFileBase64,
      paymentProofFileBase64: supplierNotes.paymentProofFileBase64,
      paymentProofFileMimeType: supplierNotes.paymentProofFileMimeType,
      paymentProofFileName: supplierNotes.paymentProofFileName,
      paymentProofFileSha256: supplierNotes.paymentProofFileSha256,
      paymentProofFileSize: supplierNotes.paymentProofFileSize,
      paymentProofFileUrl: supplierNotes.paymentProofFileUrl,
      paymentProofFilesJson: supplierNotes.paymentProofFilesJson,
      sourceFileName: supplierNotes.sourceFileName,
      sourceFileMimeType: supplierNotes.sourceFileMimeType,
      sourceFileSize: supplierNotes.sourceFileSize,
    })
    .from(supplierNotes)
    .where(eq(supplierNotes.id, id))
    .limit(1);

  if (!note) {
    throw new Error("Nota supplier tidak ditemukan.");
  }

  const updates: Partial<typeof supplierNotes.$inferInsert> = {};
  const invoiceFile = fileInput(payload.invoiceFile);

  if (invoiceFile.hasFile) {
    const storedInvoiceFile = await storedFileFromInput(invoiceFile);
    updates.sourceFileName = storedInvoiceFile.name;
    updates.sourceFileMimeType = storedInvoiceFile.mimeType;
    updates.sourceFileSize = storedInvoiceFile.size;
    updates.sourceFileBase64 = storedInvoiceFile.base64;
    updates.sourceFileSha256 = storedInvoiceFile.sha256;
    updates.invoiceFileName = storedInvoiceFile.name;
    updates.invoiceFileMimeType = storedInvoiceFile.mimeType;
    updates.invoiceFileSize = storedInvoiceFile.size;
    updates.invoiceFileBase64 = storedInvoiceFile.base64;
    updates.invoiceFileUrl = "";
    updates.invoiceFileSha256 = storedInvoiceFile.sha256;
  }

  const newPaymentProofFiles = await paymentProofInputs({
    paymentProofFiles: payload.paymentProofFiles,
  });

  if (newPaymentProofFiles.length > 0) {
    const paymentProofFiles = [
      ...storedPaymentProofFiles(note).filter((file) => file.base64),
      ...newPaymentProofFiles,
    ];
    const firstPaymentProofFile = paymentProofFiles[0];

    updates.paymentProofFileName = firstPaymentProofFile.name;
    updates.paymentProofFileMimeType = firstPaymentProofFile.mimeType;
    updates.paymentProofFileSize = firstPaymentProofFile.size;
    updates.paymentProofFileBase64 = firstPaymentProofFile.base64;
    updates.paymentProofFileUrl = "";
    updates.paymentProofFileSha256 = firstPaymentProofFile.sha256;
    updates.paymentProofFilesJson = paymentProofFiles;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("File upload tidak ditemukan.");
  }

  await db.update(supplierNotes).set(updates).where(eq(supplierNotes.id, id));

  const hasInvoiceFile = Boolean(
    updates.invoiceFileBase64 ?? note.invoiceFileBase64 ?? note.sourceFileBase64
  );
  const paymentProofFiles =
    "paymentProofFilesJson" in updates
      ? (updates.paymentProofFilesJson as SupplierNoteStoredFile[])
      : storedPaymentProofFiles(note).filter((file) => file.base64);
  const firstPaymentProofFile = paymentProofFiles[0];

  return {
    id,
    invoiceFileMimeType: hasInvoiceFile
      ? updates.invoiceFileMimeType ?? note.invoiceFileMimeType
      : "",
    invoiceFileName: hasInvoiceFile ? updates.invoiceFileName ?? note.invoiceFileName : "",
    invoiceFileSize: hasInvoiceFile ? updates.invoiceFileSize ?? note.invoiceFileSize : 0,
    invoiceFileUrl: "",
    paymentProofFileMimeType:
      firstPaymentProofFile?.mimeType ?? "",
    paymentProofFileName: firstPaymentProofFile?.name ?? "",
    paymentProofFileSize: firstPaymentProofFile?.size ?? 0,
    paymentProofFileUrl: "",
    paymentProofFiles: paymentProofFiles.map(fileMetadata),
    sourceFileMimeType: updates.sourceFileMimeType ?? note.sourceFileMimeType,
    sourceFileName: updates.sourceFileName ?? note.sourceFileName,
    sourceFileSize: updates.sourceFileSize ?? note.sourceFileSize,
  };
}
