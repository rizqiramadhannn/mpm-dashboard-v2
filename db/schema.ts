import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    detailLine1: text("detail_line_1").notNull().default(""),
    detailLine2: text("detail_line_2").notNull().default(""),
    detailLine3: text("detail_line_3").notNull().default(""),
    contactName: text("contact_name").notNull().default(""),
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
    id: integer("id").primaryKey({ autoIncrement: true }),
    sphNo: text("sph_no").notNull(),
    yy: text("yy").notNull(),
    mm: text("mm").notNull(),
    sequence: integer("sequence").notNull(),
    customerCode: text("customer_code").notNull(),
    customerId: integer("customer_id").references(() => customers.id, {
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
      enum: ["draft", "pending_invoice", "invoiced", "cancelled"],
    })
      .notNull()
      .default("draft"),
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
    id: integer("id").primaryKey({ autoIncrement: true }),
    sphId: integer("sph_id")
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

export const shipmentJourneys = sqliteTable(
  "shipment_journeys",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sphItemId: integer("sph_item_id")
      .notNull()
      .references(() => sphItems.id, { onDelete: "cascade" }),
    supplyType: text("supply_type", {
      enum: ["stock", "supplier"],
    })
      .notNull()
      .default("stock"),
    supplierId: integer("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    origin: text("origin").notNull().default(""),
    destination: text("destination").notNull().default(""),
    latestStatus: text("latest_status").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    sphItemIdx: uniqueIndex("shipment_journeys_sph_item_idx").on(table.sphItemId),
    supplierIdx: index("shipment_journeys_supplier_idx").on(table.supplierId),
  })
);

export const ttbDocuments = sqliteTable(
  "ttb_documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ttbNo: text("ttb_no").notNull(),
    sphId: integer("sph_id")
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
    id: integer("id").primaryKey({ autoIncrement: true }),
    ttbId: integer("ttb_id")
      .notNull()
      .references(() => ttbDocuments.id, { onDelete: "cascade" }),
    sphItemId: integer("sph_item_id").references(() => sphItems.id, {
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
    id: integer("id").primaryKey({ autoIncrement: true }),
    invoiceNo: text("invoice_no").notNull(),
    sphId: integer("sph_id")
      .notNull()
      .references(() => sphDocuments.id, { onDelete: "cascade" }),
    ttbId: integer("ttb_id").references(() => ttbDocuments.id, {
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
    amountInWords: text("amount_in_words").notNull().default(""),
    pdfFileId: text("pdf_file_id"),
    pdfUrl: text("pdf_url"),
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
    id: integer("id").primaryKey({ autoIncrement: true }),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoiceDocuments.id, { onDelete: "cascade" }),
    sphItemId: integer("sph_item_id").references(() => sphItems.id, {
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
    id: integer("id").primaryKey({ autoIncrement: true }),
    invoiceId: integer("invoice_id").references(() => invoiceDocuments.id, {
      onDelete: "set null",
    }),
    sphId: integer("sph_id").references(() => sphDocuments.id, {
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
    id: integer("id").primaryKey({ autoIncrement: true }),
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
    id: integer("id").primaryKey({ autoIncrement: true }),
    supplierId: integer("supplier_id")
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
    id: integer("id").primaryKey({ autoIncrement: true }),
    supplierNoteId: integer("supplier_note_id")
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
  shipmentJourney: one(shipmentJourneys),
  ttbItems: many(ttbItems),
  invoiceItems: many(invoiceItems),
}));

export const shipmentJourneysRelations = relations(shipmentJourneys, ({ one }) => ({
  sphItem: one(sphItems, {
    fields: [shipmentJourneys.sphItemId],
    references: [sphItems.id],
  }),
  supplier: one(suppliers, {
    fields: [shipmentJourneys.supplierId],
    references: [suppliers.id],
  }),
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
