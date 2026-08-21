import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { randomId } from "./id";

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    code: text("code").notNull(),
    name: text("name").notNull(),
    detailLine1: text("detail_line_1").notNull().default(""),
    detailLine2: text("detail_line_2").notNull().default(""),
    detailLine3: text("detail_line_3").notNull().default(""),
    contactName: text("contact_name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    defaultPaymentTerm: text("default_payment_term").notNull().default("CBD"),
    monthlyCreditLimit: integer("credit_limit").notNull().default(15_000_000),
    sphCreditLimit: integer("sph_credit_limit").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    codeIdx: uniqueIndex("customers_code_idx").on(table.code),
    nameIdx: index("customers_name_idx").on(table.name),
  })
);

export const sphDocuments = sqliteTable(
  "sph_documents",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    sphNo: text("sph_no").notNull(),
    yy: text("yy").notNull(),
    mm: text("mm").notNull(),
    sequence: integer("sequence").notNull(),
    customerCode: text("customer_code").notNull(),
    customerId: text("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    customerName: text("customer_name").notNull(),
    customerDetailLine1: text("customer_detail_line_1").notNull().default(""),
    customerDetailLine2: text("customer_detail_line_2").notNull().default(""),
    customerDetailLine3: text("customer_detail_line_3").notNull().default(""),
    paymentTerm: text("payment_term").notNull().default("CBD"),
    franco: text("franco").notNull().default(""),
    sourceFund: text("source_fund").notNull().default("MPM"),
    sphDate: text("sph_date").notNull(),
    deliveryDate: text("delivery_date"),
    etaDate: text("eta_date"),
    paymentDueDate: text("payment_due_date"),
    additionalInfo: text("additional_info").notNull().default(""),
    notes: text("notes").notNull().default(""),
    totalAmount: integer("total_amount").notNull().default(0),
    amountInWords: text("amount_in_words").notNull().default(""),
    staticSnapshotJson: text("static_snapshot_json", {
      mode: "json",
    }).$type<Record<string, unknown>>(),
    status: text("status", {
      enum: [
        "cek_harga",
        "menunggu_pengiriman",
        "proses_pengiriman",
        "selesai",
        "cancel",
      ],
    })
      .notNull()
      .default("cek_harga"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    sphNoIdx: uniqueIndex("sph_documents_sph_no_idx").on(table.sphNo),
    periodIdx: index("sph_documents_period_idx").on(table.yy, table.mm),
    customerIdx: index("sph_documents_customer_idx").on(table.customerCode),
    statusIdx: index("sph_documents_status_idx").on(table.status),
  })
);

export const sphItems = sqliteTable(
  "sph_items",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    sphId: text("sph_id")
      .notNull()
      .references(() => sphDocuments.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    partNumber: text("part_number").notNull().default(""),
    partName: text("part_name").notNull(),
    quantity: integer("quantity").notNull(),
    uom: text("uom").notNull().default("pcs"),
    unitPrice: integer("unit_price").notNull(),
    totalPrice: integer("total_price").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    sphLineIdx: uniqueIndex("sph_items_sph_line_idx").on(table.sphId, table.lineNo),
    partNumberIdx: index("sph_items_part_number_idx").on(table.partNumber),
  })
);

export const shipments = sqliteTable(
  "shipments",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    shipmentNo: text("shipment_no").notNull(),
    shipmentDate: text("shipment_date").notNull(),
    customerCode: text("customer_code").notNull().default(""),
    customerName: text("customer_name").notNull().default(""),
    destination: text("destination").notNull().default(""),
    shippingVendor: text("shipping_vendor").notNull().default(""),
    shippingCost: integer("shipping_cost").notNull().default(0),
    isShippingPaid: integer("is_shipping_paid", { mode: "boolean" })
      .notNull()
      .default(false),
    paidAmount: integer("paid_amount").notNull().default(0),
    paymentProofFilesJson: text("payment_proof_files_json", {
      mode: "json",
    })
      .$type<
        {
          base64: string;
          mimeType: string;
          name: string;
          sha256: string;
          size: number;
        }[]
      >()
      .notNull()
      .default(sql`'[]'`),
    latestStatus: text("latest_status").notNull().default("TERJADWAL"),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    shipmentNoIdx: uniqueIndex("shipments_shipment_no_idx").on(table.shipmentNo),
    customerIdx: index("shipments_customer_idx").on(table.customerCode),
    dateIdx: index("shipments_date_idx").on(table.shipmentDate),
  })
);

export const shipmentJourneys = sqliteTable(
  "shipment_journeys",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    shipmentId: text("shipment_id").references(() => shipments.id, {
      onDelete: "set null",
    }),
    sphItemId: text("sph_item_id")
      .notNull()
      .references(() => sphItems.id, { onDelete: "cascade" }),
    splitNo: integer("split_no").notNull().default(1),
    batchNo: integer("batch_no").notNull().default(1),
    quantity: integer("quantity").notNull().default(0),
    supplyType: text("supply_type", {
      enum: ["stock", "supplier"],
    })
      .notNull()
      .default("stock"),
    supplierId: text("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    origin: text("origin").notNull().default(""),
    destination: text("destination").notNull().default(""),
    latestStatus: text("latest_status").notNull().default(""),
    shippingVendor: text("shipping_vendor").notNull().default(""),
    shippingCost: integer("shipping_cost").notNull().default(0),
    isShippingPaid: integer("is_shipping_paid", { mode: "boolean" })
      .notNull()
      .default(false),
    customerReceived: integer("customer_received", { mode: "boolean" })
      .notNull()
      .default(false),
    customerReceivedAt: text("customer_received_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    shipmentIdx: index("shipment_journeys_shipment_idx").on(table.shipmentId),
    sphItemIdx: index("shipment_journeys_sph_item_idx").on(table.sphItemId),
    sphItemSplitIdx: uniqueIndex("shipment_journeys_sph_item_split_idx").on(
      table.sphItemId,
      table.splitNo
    ),
    supplierIdx: index("shipment_journeys_supplier_idx").on(table.supplierId),
  })
);

export const ttbDocuments = sqliteTable(
  "ttb_documents",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    ttbNo: text("ttb_no").notNull(),
    sphId: text("sph_id")
      .notNull()
      .references(() => sphDocuments.id, { onDelete: "cascade" }),
    poNo: text("po_no").notNull().default("-"),
    ttbDate: text("ttb_date").notNull(),
    handoverText: text("handover_text").notNull().default(""),
    senderName: text("sender_name").notNull().default("PT Morowali Putra Mandiri"),
    senderRole: text("sender_role").notNull().default("Admin Logistik MPM"),
    receiverName: text("receiver_name").notNull().default(""),
    receiverCompany: text("receiver_company").notNull().default(""),
    status: text("status", {
      enum: ["draft", "sent", "received", "cancelled"],
    })
      .notNull()
      .default("draft"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    ttbNoIdx: uniqueIndex("ttb_documents_ttb_no_idx").on(table.ttbNo),
    sphIdx: index("ttb_documents_sph_idx").on(table.sphId),
    statusIdx: index("ttb_documents_status_idx").on(table.status),
  })
);

export const ttbItems = sqliteTable(
  "ttb_items",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    ttbId: text("ttb_id")
      .notNull()
      .references(() => ttbDocuments.id, { onDelete: "cascade" }),
    sphItemId: text("sph_item_id").references(() => sphItems.id, {
      onDelete: "set null",
    }),
    lineNo: integer("line_no").notNull(),
    partNumber: text("part_number").notNull().default(""),
    partName: text("part_name").notNull(),
    quantity: integer("quantity").notNull(),
    uom: text("uom").notNull().default("pcs"),
    isChecked: integer("is_checked", { mode: "boolean" }).notNull().default(false),
    checkedAt: text("checked_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    ttbLineIdx: uniqueIndex("ttb_items_ttb_line_idx").on(table.ttbId, table.lineNo),
    sphItemIdx: index("ttb_items_sph_item_idx").on(table.sphItemId),
  })
);

export const invoiceDocuments = sqliteTable(
  "invoice_documents",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    invoiceNo: text("invoice_no").notNull(),
    sphId: text("sph_id")
      .notNull()
      .references(() => sphDocuments.id, { onDelete: "cascade" }),
    ttbId: text("ttb_id").references(() => ttbDocuments.id, {
      onDelete: "set null",
    }),
    poNo: text("po_no").notNull().default("-"),
    invoiceDate: text("invoice_date").notNull(),
    paymentDueDate: text("payment_due_date"),
    paymentTerm: text("payment_term").notNull().default("CBD"),
    franco: text("franco").notNull().default(""),
    customerName: text("customer_name").notNull(),
    customerDetailLine1: text("customer_detail_line_1").notNull().default(""),
    customerDetailLine2: text("customer_detail_line_2").notNull().default(""),
    customerDetailLine3: text("customer_detail_line_3").notNull().default(""),
    totalAmount: integer("total_amount").notNull().default(0),
    modalAmount: integer("modal_amount").notNull().default(0),
    feeAmount: integer("fee_amount").notNull().default(0),
    kodAmount: integer("kod_amount").notNull().default(0),
    paidAmount: integer("paid_amount").notNull().default(0),
    amountInWords: text("amount_in_words").notNull().default(""),
    pdfFileId: text("pdf_file_id"),
    pdfUrl: text("pdf_url"),
    ttdMateraiFileName: text("ttd_materai_file_name").notNull().default(""),
    ttdMateraiFileMimeType: text("ttd_materai_file_mime_type")
      .notNull()
      .default(""),
    ttdMateraiFileSize: integer("ttd_materai_file_size").notNull().default(0),
    ttdMateraiFileBase64: text("ttd_materai_file_base64").notNull().default(""),
    ttdMateraiFileSha256: text("ttd_materai_file_sha256").notNull().default(""),
    paymentProofFilesJson: text("invoice_payment_proof_files_json", {
      mode: "json",
    })
      .$type<
        {
          name: string;
          mimeType: string;
          size: number;
          base64: string;
          sha256: string;
        }[]
      >()
      .notNull()
      .default(sql`'[]'`),
    ledgerRow: integer("ledger_row"),
    status: text("status", {
      enum: ["draft", "pending", "pending_replace", "done", "cancelled"],
    })
      .notNull()
      .default("draft"),
    processedAt: text("processed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    invoiceNoIdx: uniqueIndex("invoice_documents_invoice_no_idx").on(table.invoiceNo),
    sphIdx: index("invoice_documents_sph_idx").on(table.sphId),
    ttbIdx: index("invoice_documents_ttb_idx").on(table.ttbId),
    statusIdx: index("invoice_documents_status_idx").on(table.status),
  })
);

export const invoiceItems = sqliteTable(
  "invoice_items",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoiceDocuments.id, { onDelete: "cascade" }),
    sphItemId: text("sph_item_id").references(() => sphItems.id, {
      onDelete: "set null",
    }),
    lineNo: integer("line_no").notNull(),
    partNumber: text("part_number").notNull().default(""),
    partName: text("part_name").notNull(),
    quantity: integer("quantity").notNull(),
    uom: text("uom").notNull().default("pcs"),
    unitPrice: integer("unit_price").notNull(),
    totalPrice: integer("total_price").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    invoiceLineIdx: uniqueIndex("invoice_items_invoice_line_idx").on(
      table.invoiceId,
      table.lineNo
    ),
    sphItemIdx: index("invoice_items_sph_item_idx").on(table.sphItemId),
  })
);

export const invoiceLogs = sqliteTable(
  "invoice_logs",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    invoiceId: text("invoice_id").references(() => invoiceDocuments.id, {
      onDelete: "set null",
    }),
    sphId: text("sph_id").references(() => sphDocuments.id, {
      onDelete: "set null",
    }),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    sphNo: text("sph_no").notNull(),
    invoiceNo: text("invoice_no").notNull().default(""),
    pdfFileId: text("pdf_file_id"),
    pdfUrl: text("pdf_url"),
    ledgerRow: integer("ledger_row"),
    status: text("status", {
      enum: ["pending", "pending_replace", "done", "failed", "cancelled"],
    })
      .notNull()
      .default("pending"),
    snapshotJson: text("snapshot_json", { mode: "json" }).$type<Record<string, unknown>>(),
    processedAt: text("processed_at"),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    sphNoIdx: index("invoice_logs_sph_no_idx").on(table.sphNo),
    invoiceNoIdx: index("invoice_logs_invoice_no_idx").on(table.invoiceNo),
    statusIdx: index("invoice_logs_status_idx").on(table.status),
  })
);

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    supplierType: text("supplier_type").notNull().default("Supplier Sparepart"),
    suppliedItems: text("supplied_items").notNull().default(""),
    phone: text("phone").notNull().default(""),
    contactPerson: text("contact_person").notNull().default(""),
    accountType: text("account_type").notNull().default(""),
    accountNumber: text("account_number").notNull().default(""),
    accountName: text("account_name").notNull().default(""),
    address: text("address").notNull().default(""),
    defaultPaymentTerm: text("default_payment_term").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    normalizedNameIdx: uniqueIndex("suppliers_normalized_name_idx").on(
      table.normalizedName
    ),
    nameIdx: index("suppliers_name_idx").on(table.name),
  })
);

export const supplierNotes = sqliteTable(
  "supplier_notes",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    noteNo: text("note_no").notNull(),
    noteDate: text("note_date").notNull(),
    itemSummary: text("item_summary").notNull().default(""),
    category: text("category").notNull().default("Spareparts"),
    amount: integer("amount").notNull().default(0),
    paymentStatus: text("payment_status", {
      enum: ["BELUM BAYAR", "DP", "LUNAS", "CANCELLED"],
    })
      .notNull()
      .default("BELUM BAYAR"),
    paidAmount: integer("paid_amount").notNull().default(0),
    remainingPayment: integer("remaining_payment").notNull().default(0),
    paymentTerm: text("payment_term").notNull().default(""),
    paymentDeadline: text("payment_deadline"),
    paymentDate: text("payment_date"),
    purchasePurpose: text("purchase_purpose").notNull().default(""),
    customerName: text("customer_name").notNull().default(""),
    flag: text("flag").notNull().default("MPM"),
    sourceSheetRow: integer("source_sheet_row"),
    sourceFileName: text("source_file_name").notNull().default(""),
    sourceFileMimeType: text("source_file_mime_type").notNull().default(""),
    sourceFileSize: integer("source_file_size").notNull().default(0),
    sourceFileBase64: text("source_file_base64").notNull().default(""),
    sourceFileSha256: text("source_file_sha256").notNull().default(""),
    invoiceFileName: text("invoice_file_name").notNull().default(""),
    invoiceFileMimeType: text("invoice_file_mime_type").notNull().default(""),
    invoiceFileSize: integer("invoice_file_size").notNull().default(0),
    invoiceFileBase64: text("invoice_file_base64").notNull().default(""),
    invoiceFileUrl: text("invoice_file_url").notNull().default(""),
    invoiceFileSha256: text("invoice_file_sha256").notNull().default(""),
    paymentProofFileName: text("payment_proof_file_name").notNull().default(""),
    paymentProofFileMimeType: text("payment_proof_file_mime_type")
      .notNull()
      .default(""),
    paymentProofFileSize: integer("payment_proof_file_size").notNull().default(0),
    paymentProofFileBase64: text("payment_proof_file_base64").notNull().default(""),
    paymentProofFileUrl: text("payment_proof_file_url").notNull().default(""),
    paymentProofFileSha256: text("payment_proof_file_sha256").notNull().default(""),
    paymentProofFilesJson: text("payment_proof_files_json", {
      mode: "json",
    })
      .$type<
        {
          name: string;
          mimeType: string;
          size: number;
          base64: string;
          url: string;
          sha256: string;
        }[]
      >()
      .notNull()
      .default(sql`'[]'`),
    extractionJson: text("extraction_json", {
      mode: "json",
    }).$type<Record<string, unknown>>(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    supplierNoteNoIdx: uniqueIndex("supplier_notes_supplier_note_no_idx").on(
      table.supplierId,
      table.noteNo
    ),
    noteDateIdx: index("supplier_notes_note_date_idx").on(table.noteDate),
    paymentStatusIdx: index("supplier_notes_payment_status_idx").on(
      table.paymentStatus
    ),
    paymentDeadlineIdx: index("supplier_notes_payment_deadline_idx").on(
      table.paymentDeadline
    ),
    flagIdx: index("supplier_notes_flag_idx").on(table.flag),
  })
);

export const supplierNoteItems = sqliteTable(
  "supplier_note_items",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    supplierNoteId: text("supplier_note_id")
      .notNull()
      .references(() => supplierNotes.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    partNumber: text("part_number").notNull().default(""),
    description: text("description").notNull(),
    quantity: real("quantity").notNull().default(0),
    uom: text("uom").notNull().default("Pcs"),
    unitPrice: integer("unit_price").notNull().default(0),
    totalPrice: integer("total_price").notNull().default(0),
    dueDate: text("due_date"),
    status: text("status").notNull().default(""),
    shortCode: text("short_code").notNull().default(""),
    flag: text("flag").notNull().default("MPM"),
    sourceSheetRow: integer("source_sheet_row"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    supplierLineIdx: uniqueIndex("supplier_note_items_note_line_idx").on(
      table.supplierNoteId,
      table.lineNo
    ),
    partNumberIdx: index("supplier_note_items_part_number_idx").on(
      table.partNumber
    ),
    flagIdx: index("supplier_note_items_flag_idx").on(table.flag),
  })
);

export const supplierNoteImports = sqliteTable(
  "supplier_note_imports",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    flag: text("flag").notNull().default("MPM"),
    customerId: text("customer_id"),
    customerName: text("customer_name").notNull().default(""),
    paymentTerm: text("payment_term").notNull().default("CBD"),
    purchasePurpose: text("purchase_purpose").notNull().default("Pembelian Langsung"),
    status: text("status", {
      enum: ["pending", "imported", "cancelled"],
    })
      .notNull()
      .default("pending"),
    fileName: text("file_name").notNull(),
    fileMimeType: text("file_mime_type").notNull(),
    fileSize: integer("file_size").notNull().default(0),
    fileBase64: text("file_base64").notNull().default(""),
    fileSha256: text("file_sha256").notNull().default(""),
    importedSupplierNoteId: text("imported_supplier_note_id").references(
      () => supplierNotes.id,
      { onDelete: "set null" }
    ),
    importedJson: text("imported_json", {
      mode: "json",
    }).$type<Record<string, unknown>>(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    statusIdx: index("supplier_note_imports_status_idx").on(table.status),
    flagIdx: index("supplier_note_imports_flag_idx").on(table.flag),
    importedSupplierNoteIdx: index("supplier_note_imports_note_idx").on(
      table.importedSupplierNoteId
    ),
  })
);

export const paymentRequests = sqliteTable(
  "payment_requests",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    requestDate: text("request_date").notNull(),
    requestedByUserId: text("requested_by_user_id").references(() => appUsers.id, {
      onDelete: "set null",
    }),
    requestedByUsername: text("requested_by_username").notNull().default(""),
    sourceFund: text("source_fund").notNull().default(""),
    amount: integer("amount").notNull().default(0),
    destinationAccount: text("destination_account").notNull().default(""),
    description: text("description").notNull().default(""),
    transactionPurpose: text("transaction_purpose").notNull().default(""),
    status: text("status").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    requestDateIdx: index("payment_requests_request_date_idx").on(
      table.requestDate
    ),
    sourceFundIdx: index("payment_requests_source_fund_idx").on(table.sourceFund),
    statusIdx: index("payment_requests_status_idx").on(table.status),
    requestedByIdx: index("payment_requests_requested_by_idx").on(
      table.requestedByUsername
    ),
  })
);

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    assetCode: text("asset_code").notNull(),
    itemName: text("item_name").notNull(),
    category: text("category").notNull().default(""),
    assetValue: integer("asset_value").notNull().default(0),
    currentOrLastPic: text("current_or_last_pic").notNull().default(""),
    location: text("location").notNull().default(""),
    condition: text("condition").notNull().default("Baik"),
    status: text("status").notNull().default("Aktif"),
    acquisitionDate: text("acquisition_date"),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    assetCodeIdx: uniqueIndex("assets_asset_code_idx").on(table.assetCode),
    itemNameIdx: index("assets_item_name_idx").on(table.itemName),
    categoryIdx: index("assets_category_idx").on(table.category),
    locationIdx: index("assets_location_idx").on(table.location),
    statusIdx: index("assets_status_idx").on(table.status),
  })
);

export const employees = sqliteTable(
  "employees",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    name: text("name").notNull(),
    title: text("title").notNull().default(""),
    jobdesk: text("jobdesk").notNull().default(""),
    salary: integer("salary").notNull().default(0),
    accountNumber: text("account_number").notNull().default(""),
    status: text("status").notNull().default("Aktif"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    nameIdx: index("employees_name_idx").on(table.name),
    statusIdx: index("employees_status_idx").on(table.status),
  })
);

export const employeeSalaryPayments = sqliteTable(
  "employee_salary_payments",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    salaryMonth: text("salary_month").notNull(),
    paymentDate: text("payment_date").notNull(),
    baseSalary: integer("base_salary").notNull().default(0),
    salesAmount: integer("sales_amount").notNull().default(0),
    commissionAmount: integer("commission_amount").notNull().default(0),
    additionalBonus: integer("additional_bonus").notNull().default(0),
    deduction: integer("deduction").notNull().default(0),
    totalPaid: integer("total_paid").notNull().default(0),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    employeeMonthIdx: uniqueIndex("employee_salary_payments_employee_month_idx").on(
      table.employeeId,
      table.salaryMonth
    ),
    paymentDateIdx: index("employee_salary_payments_payment_date_idx").on(
      table.paymentDate
    ),
  })
);

export const appUsers = sqliteTable(
  "app_users",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", {
      enum: ["superadmin", "user"],
    })
      .notNull()
      .default("user"),
    mustChangePassword: integer("must_change_password", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    usernameIdx: uniqueIndex("app_users_username_idx").on(table.username),
  })
);

export const appLoginAttempts = sqliteTable(
  "app_login_attempts",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    username: text("username").notNull(),
    ipAddress: text("ip_address").notNull(),
    success: integer("success", { mode: "boolean" }).notNull().default(false),
    attemptedAt: text("attempted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    attemptedAtIdx: index("app_login_attempts_attempted_at_idx").on(
      table.attemptedAt
    ),
    identityIdx: index("app_login_attempts_identity_idx").on(
      table.username,
      table.ipAddress
    ),
  })
);

export const appAdminAuditLogs = sqliteTable(
  "app_admin_audit_logs",
  {
    id: text("id").primaryKey().$defaultFn(randomId),
    actorUserId: text("actor_user_id").references(() => appUsers.id, {
      onDelete: "set null",
    }),
    actorUsername: text("actor_username").notNull(),
    action: text("action").notNull(),
    targetUserId: text("target_user_id").references(() => appUsers.id, {
      onDelete: "set null",
    }),
    targetUsername: text("target_username").notNull().default(""),
    ipAddress: text("ip_address").notNull().default("unknown"),
    detailsJson: text("details_json", {
      mode: "json",
    })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    actionIdx: index("app_admin_audit_logs_action_idx").on(table.action),
    actorIdx: index("app_admin_audit_logs_actor_idx").on(table.actorUsername),
    createdAtIdx: index("app_admin_audit_logs_created_at_idx").on(
      table.createdAt
    ),
    targetIdx: index("app_admin_audit_logs_target_idx").on(table.targetUsername),
  })
);

export const customersRelations = relations(customers, ({ many }) => ({
  sphDocuments: many(sphDocuments),
}));

export const sphDocumentsRelations = relations(sphDocuments, ({ one, many }) => ({
  customer: one(customers, {
    fields: [sphDocuments.customerId],
    references: [customers.id],
  }),
  items: many(sphItems),
  ttbDocuments: many(ttbDocuments),
  invoiceDocuments: many(invoiceDocuments),
  invoiceLogs: many(invoiceLogs),
}));

export const sphItemsRelations = relations(sphItems, ({ one, many }) => ({
  sph: one(sphDocuments, {
    fields: [sphItems.sphId],
    references: [sphDocuments.id],
  }),
  shipmentJourneys: many(shipmentJourneys),
  ttbItems: many(ttbItems),
  invoiceItems: many(invoiceItems),
}));

export const shipmentJourneysRelations = relations(shipmentJourneys, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentJourneys.shipmentId],
    references: [shipments.id],
  }),
  sphItem: one(sphItems, {
    fields: [shipmentJourneys.sphItemId],
    references: [sphItems.id],
  }),
  supplier: one(suppliers, {
    fields: [shipmentJourneys.supplierId],
    references: [suppliers.id],
  }),
}));

export const shipmentsRelations = relations(shipments, ({ many }) => ({
  journeys: many(shipmentJourneys),
}));

export const ttbDocumentsRelations = relations(ttbDocuments, ({ one, many }) => ({
  sph: one(sphDocuments, {
    fields: [ttbDocuments.sphId],
    references: [sphDocuments.id],
  }),
  items: many(ttbItems),
  invoiceDocuments: many(invoiceDocuments),
}));

export const ttbItemsRelations = relations(ttbItems, ({ one }) => ({
  ttb: one(ttbDocuments, {
    fields: [ttbItems.ttbId],
    references: [ttbDocuments.id],
  }),
  sphItem: one(sphItems, {
    fields: [ttbItems.sphItemId],
    references: [sphItems.id],
  }),
}));

export const invoiceDocumentsRelations = relations(
  invoiceDocuments,
  ({ one, many }) => ({
    sph: one(sphDocuments, {
      fields: [invoiceDocuments.sphId],
      references: [sphDocuments.id],
    }),
    ttb: one(ttbDocuments, {
      fields: [invoiceDocuments.ttbId],
      references: [ttbDocuments.id],
    }),
    items: many(invoiceItems),
    logs: many(invoiceLogs),
  })
);

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoiceDocuments, {
    fields: [invoiceItems.invoiceId],
    references: [invoiceDocuments.id],
  }),
  sphItem: one(sphItems, {
    fields: [invoiceItems.sphItemId],
    references: [sphItems.id],
  }),
}));

export const invoiceLogsRelations = relations(invoiceLogs, ({ one }) => ({
  invoice: one(invoiceDocuments, {
    fields: [invoiceLogs.invoiceId],
    references: [invoiceDocuments.id],
  }),
  sph: one(sphDocuments, {
    fields: [invoiceLogs.sphId],
    references: [sphDocuments.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  notes: many(supplierNotes),
}));

export const supplierNotesRelations = relations(supplierNotes, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [supplierNotes.supplierId],
    references: [suppliers.id],
  }),
  items: many(supplierNoteItems),
}));

export const supplierNoteItemsRelations = relations(supplierNoteItems, ({ one }) => ({
  note: one(supplierNotes, {
    fields: [supplierNoteItems.supplierNoteId],
    references: [supplierNotes.id],
  }),
}));

export const supplierNoteImportsRelations = relations(supplierNoteImports, ({ one }) => ({
  importedNote: one(supplierNotes, {
    fields: [supplierNoteImports.importedSupplierNoteId],
    references: [supplierNotes.id],
  }),
}));

export const employeesRelations = relations(employees, ({ many }) => ({
  salaryPayments: many(employeeSalaryPayments),
}));

export const employeeSalaryPaymentsRelations = relations(
  employeeSalaryPayments,
  ({ one }) => ({
    employee: one(employees, {
      fields: [employeeSalaryPayments.employeeId],
      references: [employees.id],
    }),
  })
);
