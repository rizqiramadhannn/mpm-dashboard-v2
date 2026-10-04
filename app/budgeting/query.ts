import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { getDb } from "../../db";
import { invoiceDocuments as inv, invoiceItems, sphDocuments as sph, supplierNotes as note, supplierNoteItems, suppliers } from "../../db/schema";

export type DocumentType = "invoices" | "supplier-notes";
const paymentStatuses = ["BELUM BAYAR", "DP", "LUNAS", "CANCELLED"];
const dueStatuses = ["overdue", "on_due", "upcoming", "no_due_date", "settled", "cancelled"];

export class InvalidBudgetingQuery extends Error {}

export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function parseBudgetingQuery(params: URLSearchParams, now = new Date()) {
  const allowed = ["page", "pageSize", "dateFrom", "dateTo", "dueFrom", "dueTo", "asOf", "paymentStatus", "dueStatus", "customerId", "supplierId"];
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1) throw new InvalidBudgetingQuery(`Parameter tidak valid: ${key}`);
  }
  const integer = (key: string, fallback: number, max: number) => {
    const value = params.get(key);
    if (value === null) return fallback;
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) {
      throw new InvalidBudgetingQuery(`${key} harus antara 1 dan ${max}.`);
    }
    return Number(value);
  };
  for (const key of ["dateFrom", "dateTo", "dueFrom", "dueTo", "asOf"]) {
    if (params.has(key) && !validDate(params.get(key)!)) throw new InvalidBudgetingQuery(`${key} harus tanggal YYYY-MM-DD yang valid.`);
  }
  for (const [from, to] of [["dateFrom", "dateTo"], ["dueFrom", "dueTo"]]) {
    if (params.has(from) && params.has(to) && params.get(from)! > params.get(to)!) throw new InvalidBudgetingQuery(`${from} melebihi ${to}.`);
  }
  for (const [key, values] of [["paymentStatus", paymentStatuses], ["dueStatus", dueStatuses]] as const) {
    if (params.has(key) && !values.includes(params.get(key)!)) throw new InvalidBudgetingQuery(`${key} tidak valid.`);
  }
  for (const key of ["customerId", "supplierId"]) {
    if (params.has(key) && (!params.get(key) || params.get(key)!.length > 256)) throw new InvalidBudgetingQuery(`${key} tidak valid.`);
  }
  return {
    page: integer("page", 1, 1_000_000), pageSize: integer("pageSize", 100, 200),
    asOf: params.get("asOf") ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(now),
    dateFrom: params.get("dateFrom"), dateTo: params.get("dateTo"),
    dueFrom: params.get("dueFrom"), dueTo: params.get("dueTo"),
    paymentStatus: params.get("paymentStatus"), dueStatus: params.get("dueStatus"),
    customerId: params.get("customerId"), supplierId: params.get("supplierId"),
  };
}

export function agingFields(dueDate: string | null, remainingPayment: number, paymentStatus: string, asOf: string) {
  const days = dueDate && validDate(dueDate) ? Math.round((Date.parse(asOf) - Date.parse(dueDate)) / 86_400_000) : null;
  const dueStatus = paymentStatus === "CANCELLED" ? "cancelled" : remainingPayment <= 0 ? "settled" : days === null ? "no_due_date" : days > 0 ? "overdue" : days === 0 ? "on_due" : "upcoming";
  const open = !["settled", "cancelled"].includes(dueStatus);
  return { asOf, dueStatus, isOverdue: dueStatus === "overdue", isOnDue: dueStatus === "on_due", daysPastDue: open && days !== null ? Math.max(days, 0) : 0, daysUntilDue: open && days !== null ? Math.max(-days, 0) : null };
}

// Dependency injection keeps verification on an isolated fixture database.
export async function readBudgetingDocuments(db: Awaited<ReturnType<typeof getDb>>, type: DocumentType, query: ReturnType<typeof parseBudgetingQuery>, id?: string) {
  if (type === "invoices" && query.supplierId || type === "supplier-notes" && query.customerId) throw new InvalidBudgetingQuery("Filter identitas tidak sesuai jenis dokumen.");
  const invoiceDue = sql<string | null>`date(coalesce(${inv.paymentDueDate}, ${sph.paymentDueDate}, date(${inv.invoiceDate}, '+' || case when instr(upper(${inv.paymentTerm}), 'TOP') > 0 then cast(trim(substr(${inv.paymentTerm}, instr(upper(${inv.paymentTerm}), 'TOP') + 3)) as integer) else 0 end || ' days')))`;
  const paymentStatus = type === "invoices"
    ? sql<string>`case when ${inv.status} = 'cancelled' then 'CANCELLED' when ${inv.status} = 'done' or (${inv.totalAmount} > 0 and ${inv.paidAmount} >= ${inv.totalAmount}) then 'LUNAS' when ${inv.paidAmount} > 0 then 'DP' else 'BELUM BAYAR' end`
    : sql<string>`${note.paymentStatus}`;
  const remaining = type === "invoices"
    ? sql<number>`case when ${inv.status} in ('cancelled', 'done') then 0 else max(${inv.totalAmount} - ${inv.paidAmount}, 0) end`
    : sql<number>`case when ${note.paymentStatus} in ('CANCELLED', 'LUNAS') then 0 else max(${note.amount} - ${note.paidAmount}, 0) end`;
  const base = type === "invoices" ? db.select({
    id: inv.id, invoiceNo: inv.invoiceNo, invoiceDate: inv.invoiceDate, documentDate: sql<string>`${inv.invoiceDate}`.as("document_date"),
    sphId: inv.sphId, sphNo: sph.sphNo, ttbId: inv.ttbId, poNo: inv.poNo,
    customerId: sph.customerId, customerCode: sph.customerCode, customerName: inv.customerName,
    paymentTerm: inv.paymentTerm, paymentDueDate: inv.paymentDueDate, dueDate: invoiceDue.as("due_date"),
    totalAmount: inv.totalAmount, paidAmount: inv.paidAmount, remainingPayment: remaining.as("remaining_payment"),
    status: inv.status, paymentStatus: paymentStatus.as("payment_status"), processedAt: inv.processedAt,
    paymentDate: sql<string | null>`substr(${inv.processedAt}, 1, 10)`.as("payment_date"),
    createdAt: inv.createdAt, updatedAt: inv.updatedAt,
  }).from(inv).innerJoin(sph, eq(inv.sphId, sph.id)).where(inArray(sql<string>`${sph.status}`, ["menunggu_pengiriman", "proses_pengiriman", "selesai", "invoiced", "pending_invoice"]))
    : db.select({
      id: note.id, noteNo: note.noteNo, noteDate: note.noteDate, documentDate: sql<string>`${note.noteDate}`.as("document_date"),
      noteSource: note.noteSource, supplierId: note.supplierId, supplierName: suppliers.name,
      customerName: note.customerName, purchasePurpose: note.purchasePurpose, category: note.category, flag: note.flag, itemSummary: note.itemSummary,
      amount: note.amount, totalAmount: sql<number>`${note.amount}`.as("total_amount"), paidAmount: note.paidAmount,
      remainingPayment: remaining.as("remaining_payment"), storedRemainingPayment: sql<number>`${note.remainingPayment}`.as("stored_remaining_payment"),
      paymentStatus: paymentStatus.as("payment_status"), paymentTerm: note.paymentTerm, paymentDeadline: note.paymentDeadline,
      dueDate: sql<string | null>`date(${note.paymentDeadline})`.as("due_date"), paymentDate: note.paymentDate,
      createdAt: note.createdAt, updatedAt: note.updatedAt,
    }).from(note).innerJoin(suppliers, eq(note.supplierId, suppliers.id));
  const source = base.as("budget_documents");
  const filters: SQL[] = [];
  if (id) filters.push(eq(source.id, id));
  if (query.dateFrom) filters.push(gte(source.documentDate, query.dateFrom));
  if (query.dateTo) filters.push(lte(source.documentDate, query.dateTo));
  if (query.dueFrom) filters.push(gte(source.dueDate, query.dueFrom));
  if (query.dueTo) filters.push(lte(source.dueDate, query.dueTo));
  if (query.paymentStatus) filters.push(eq(source.paymentStatus, query.paymentStatus));
  if (query.customerId && "customerId" in source) filters.push(eq(source.customerId, query.customerId));
  if (query.supplierId && "supplierId" in source) filters.push(eq(source.supplierId, query.supplierId));
  const dueStatus = sql`case when ${source.paymentStatus} = 'CANCELLED' then 'cancelled' when ${source.remainingPayment} <= 0 then 'settled' when ${source.dueDate} is null then 'no_due_date' when ${source.dueDate} < ${query.asOf} then 'overdue' when ${source.dueDate} = ${query.asOf} then 'on_due' else 'upcoming' end`;
  if (query.dueStatus) filters.push(eq(dueStatus, query.dueStatus));
  const where = and(...filters);
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(source).where(where);
  const rows = await db.select().from(source).where(where).orderBy(desc(source.documentDate), asc(source.id)).limit(id ? 1 : query.pageSize).offset(id ? 0 : (query.page - 1) * query.pageSize);
  const ids = rows.map(row => row.id);
  const items = !ids.length ? [] : type === "invoices"
    ? await db.select({ id: invoiceItems.id, documentId: invoiceItems.invoiceId, sphItemId: invoiceItems.sphItemId, lineNo: invoiceItems.lineNo, partNumber: invoiceItems.partNumber, partName: invoiceItems.partName, quantity: invoiceItems.quantity, uom: invoiceItems.uom, unitPrice: invoiceItems.unitPrice, totalPrice: invoiceItems.totalPrice }).from(invoiceItems).where(inArray(invoiceItems.invoiceId, ids)).orderBy(asc(invoiceItems.lineNo))
    : await db.select({ id: supplierNoteItems.id, documentId: supplierNoteItems.supplierNoteId, lineNo: supplierNoteItems.lineNo, partNumber: supplierNoteItems.partNumber, description: supplierNoteItems.description, quantity: supplierNoteItems.quantity, uom: supplierNoteItems.uom, unitPrice: supplierNoteItems.unitPrice, totalPrice: supplierNoteItems.totalPrice, dueDate: supplierNoteItems.dueDate, status: supplierNoteItems.status, shortCode: supplierNoteItems.shortCode, flag: supplierNoteItems.flag }).from(supplierNoteItems).where(inArray(supplierNoteItems.supplierNoteId, ids)).orderBy(asc(supplierNoteItems.lineNo));
  const byDocument = new Map<string, Array<(typeof items)[number]>>();
  for (const item of items) {
    const grouped = byDocument.get(item.documentId) ?? [];
    grouped.push(item);
    byDocument.set(item.documentId, grouped);
  }
  const data = rows.map(row => ({ ...row, currency: "IDR", ...agingFields(row.dueDate, row.remainingPayment, row.paymentStatus, query.asOf), items: byDocument.get(row.id) ?? [] }));
  return { data, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize), hasNextPage: query.page * query.pageSize < total }, asOf: query.asOf, timeZone: "Asia/Jakarta" };
}
