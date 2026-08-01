import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AppShell } from "../components/AppShell";
import { DateRangeFilter } from "../components/DateRangeFilter";
import { getCurrentPage, paginateRows, Pagination } from "../components/Pagination";
import { getDb } from "../../db";
import {
  invoiceDocuments,
  invoiceItems,
  shipmentJourneys,
  sphDocuments,
  sphItems,
} from "../../db/schema";
import { InvoiceLedgerTable, type LedgerRow } from "./InvoiceLedgerTable";

export const dynamic = "force-dynamic";

type InvoiceRow = {
  feeAmount: number;
  id: string;
  invoiceDate: string;
  invoiceNo: string;
  kodAmount: number;
  modalAmount: number;
  paymentDueDate: string | null;
  paymentTerm: string;
  processedAt: string | null;
  sphId: string;
  status: "draft" | "pending" | "pending_replace" | "done" | "cancelled";
  totalAmount: number;
};

type SphRow = {
  amountInWords: string;
  createdAt: string;
  customerDetailLine1: string;
  customerDetailLine2: string;
  customerDetailLine3: string;
  customerName: string;
  franco: string;
  id: string;
  paymentDueDate: string | null;
  paymentTerm: string;
  sphDate: string;
  sphNo: string;
  totalAmount: number;
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function paymentDueDateFromTerm(invoiceDate: string, paymentTerm: string) {
  const topMatch = paymentTerm.match(/TOP\s*(\d+)/i);

  if (topMatch) {
    return addDays(invoiceDate, Number(topMatch[1]));
  }

  return invoiceDate;
}

function invoiceNoFromSph(sphNo: string) {
  return sphNo.startsWith("SPH") ? `INV${sphNo.slice(3)}` : `INV-${sphNo}`;
}

function ledgerStatus(status: InvoiceRow["status"] | "pending") {
  if (status === "done") {
    return "LUNAS";
  }

  if (status === "cancelled") {
    return "CANCELLED";
  }

  return "BELUM BAYAR";
}

function diffDays(fromDate: string | null, toDate = new Date()) {
  if (!fromDate) {
    return "-";
  }

  const from = new Date(`${fromDate.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(from.getTime())) {
    return "-";
  }

  const to = new Date(toDate);
  to.setHours(0, 0, 0, 0);
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000).toString();
}

function formatPercent(value: number, total: number) {
  if (total <= 0) {
    return "-";
  }

  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format((value / total) * 100)}%`;
}

function formatMoney(value: number) {
  return `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function textMatches(value: unknown, query: string) {
  return String(value ?? "").toLowerCase().includes(query);
}

function isWithinDateRange(value: string | null, from: string, to: string) {
  if (!value) {
    return !from && !to;
  }

  const dateValue = value.slice(0, 10);
  return (!from || dateValue >= from) && (!to || dateValue <= to);
}

function parseLedgerField(value: string) {
  if (value === "modalAmount" || value === "feeAmount" || value === "kodAmount") {
    return value;
  }

  throw new Error("Field ledger tidak valid.");
}

function parseAmount(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.replace(/[^\d]/g, "") : "";
  const amount = raw ? Number(raw) : 0;

  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("Nominal harus berupa angka valid.");
  }

  return amount;
}

async function updateLedgerAmountAction(formData: FormData) {
  "use server";

  const invoiceId = formData.get("invoiceId");

  if (typeof invoiceId !== "string" || !invoiceId.trim()) {
    throw new Error("Invoice tidak valid.");
  }

  const field = parseLedgerField(String(formData.get("field") ?? ""));
  const amount = parseAmount(formData.get("amount"));
  const db = await getDb();

  await db
    .update(invoiceDocuments)
    .set({ [field]: amount })
    .where(eq(invoiceDocuments.id, invoiceId.trim()));

  revalidatePath("/invoice");
}

async function ensureInvoicesForSph(sphRows: SphRow[], invoiceRows: InvoiceRow[]) {
  const invoiceBySph = new Map(invoiceRows.map((invoice) => [invoice.sphId, invoice]));
  const missingSphRows = sphRows.filter((sph) => !invoiceBySph.has(sph.id));

  if (missingSphRows.length === 0) {
    return invoiceRows;
  }

  const db = await getDb();
  const insertedInvoices: InvoiceRow[] = [];

  for (const sph of missingSphRows) {
    const dueDate = sph.paymentDueDate ?? paymentDueDateFromTerm(sph.sphDate, sph.paymentTerm);
    const [insertedInvoice] = await db
      .insert(invoiceDocuments)
      .values({
        amountInWords: sph.amountInWords,
        customerDetailLine1: sph.customerDetailLine1,
        customerDetailLine2: sph.customerDetailLine2,
        customerDetailLine3: sph.customerDetailLine3,
        customerName: sph.customerName,
        franco: sph.franco,
        invoiceDate: sph.sphDate,
        invoiceNo: invoiceNoFromSph(sph.sphNo),
        paymentDueDate: dueDate,
        paymentTerm: sph.paymentTerm,
        sphId: sph.id,
        status: "pending",
        totalAmount: sph.totalAmount,
      })
      .returning({
        feeAmount: invoiceDocuments.feeAmount,
        id: invoiceDocuments.id,
        invoiceDate: invoiceDocuments.invoiceDate,
        invoiceNo: invoiceDocuments.invoiceNo,
        kodAmount: invoiceDocuments.kodAmount,
        modalAmount: invoiceDocuments.modalAmount,
        paymentDueDate: invoiceDocuments.paymentDueDate,
        paymentTerm: invoiceDocuments.paymentTerm,
        processedAt: invoiceDocuments.processedAt,
        sphId: invoiceDocuments.sphId,
        status: invoiceDocuments.status,
        totalAmount: invoiceDocuments.totalAmount,
      });
    insertedInvoices.push(insertedInvoice);

    const items = await db
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
      .where(eq(sphItems.sphId, sph.id));

    if (items.length > 0) {
      await db.insert(invoiceItems).values(
        items.map((item) => ({
          invoiceId: insertedInvoice.id,
          lineNo: item.lineNo,
          partName: item.partName,
          partNumber: item.partNumber,
          quantity: item.quantity,
          sphItemId: item.id,
          totalPrice: item.totalPrice,
          unitPrice: item.unitPrice,
        }))
      );
    }
  }

  return [...invoiceRows, ...insertedInvoices];
}

export default async function InvoicePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = getSearchParam(params, "q").trim().toLowerCase();
  const statusFilter = getSearchParam(params, "status");
  const paymentFilter = getSearchParam(params, "payment");
  const fromDate = getSearchParam(params, "from");
  const toDate = getSearchParam(params, "to");
  const db = await getDb();
  const sphRows = await db
    .select({
      amountInWords: sphDocuments.amountInWords,
      createdAt: sphDocuments.createdAt,
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
      totalAmount: sphDocuments.totalAmount,
    })
    .from(sphDocuments)
    .orderBy(desc(sphDocuments.createdAt), desc(sphDocuments.id));
  const sphIds = sphRows.map((row) => row.id);
  const invoiceRows: InvoiceRow[] =
    sphIds.length > 0
      ? await db
          .select({
            feeAmount: invoiceDocuments.feeAmount,
            id: invoiceDocuments.id,
            invoiceDate: invoiceDocuments.invoiceDate,
            invoiceNo: invoiceDocuments.invoiceNo,
            kodAmount: invoiceDocuments.kodAmount,
            modalAmount: invoiceDocuments.modalAmount,
            paymentDueDate: invoiceDocuments.paymentDueDate,
            paymentTerm: invoiceDocuments.paymentTerm,
            processedAt: invoiceDocuments.processedAt,
            sphId: invoiceDocuments.sphId,
            status: invoiceDocuments.status,
            totalAmount: invoiceDocuments.totalAmount,
          })
          .from(invoiceDocuments)
          .where(inArray(invoiceDocuments.sphId, sphIds))
      : [];
  const syncedInvoiceRows = await ensureInvoicesForSph(sphRows, invoiceRows);
  const invoiceBySph = new Map(syncedInvoiceRows.map((invoice) => [invoice.sphId, invoice]));
  const itemRows =
    sphIds.length > 0
      ? await db
          .select({
            id: sphItems.id,
            sphId: sphItems.sphId,
          })
          .from(sphItems)
          .where(inArray(sphItems.sphId, sphIds))
      : [];
  const sphIdByItem = new Map(itemRows.map((item) => [item.id, item.sphId]));
  const itemIds = itemRows.map((item) => item.id);
  const journeyRows =
    itemIds.length > 0
      ? await db
          .select({
            shippingCost: shipmentJourneys.shippingCost,
            sphItemId: shipmentJourneys.sphItemId,
          })
          .from(shipmentJourneys)
          .where(inArray(shipmentJourneys.sphItemId, itemIds))
      : [];
  const ongkirBySph = new Map<string, number>();

  for (const journey of journeyRows) {
    const sphId = sphIdByItem.get(journey.sphItemId);

    if (sphId) {
      ongkirBySph.set(sphId, (ongkirBySph.get(sphId) ?? 0) + journey.shippingCost);
    }
  }

  const ledgerRows: LedgerRow[] = sphRows.map((sph) => {
    const invoice = invoiceBySph.get(sph.id);
    const invoiceDate = invoice?.invoiceDate ?? sph.sphDate;
    const paymentTerm = invoice?.paymentTerm ?? sph.paymentTerm;
    const dueDate =
      invoice?.paymentDueDate ??
      sph.paymentDueDate ??
      paymentDueDateFromTerm(invoiceDate, paymentTerm);
    const totalAmount = invoice?.totalAmount ?? sph.totalAmount;
    const modalAmount = invoice?.modalAmount ?? 0;
    const feeAmount = invoice?.feeAmount ?? 0;
    const kodAmount = invoice?.kodAmount ?? 0;
    const ongkirAmount = ongkirBySph.get(sph.id) ?? 0;
    const hppAmount = modalAmount + feeAmount + ongkirAmount + kodAmount;
    const gpAmount = totalAmount - hppAmount;
    const status = ledgerStatus(invoice?.status ?? "pending");

    return {
      aging: status === "LUNAS" ? "-" : diffDays(dueDate),
      customerName: sph.customerName,
      feeAmount,
      gpAmount,
      gpPercent: formatPercent(gpAmount, totalAmount),
      hppAmount,
      invoiceDate: formatDate(invoiceDate),
      invoiceDateRaw: invoiceDate,
      invoiceId: invoice?.id ?? null,
      invoiceNo: invoice?.invoiceNo ?? invoiceNoFromSph(sph.sphNo),
      kodAmount,
      modalAmount,
      ongkirAmount,
      paymentDate: invoice?.processedAt ? formatDate(invoice.processedAt) : "-",
      paymentDueDate: formatDate(dueDate),
      paymentTerm,
      sphId: sph.id,
      sphNo: sph.sphNo,
      status,
      statusClassName: status.toLowerCase().replace(/\s+/g, "-"),
      totalAmount,
    };
  });
  const paymentOptions = [...new Set(ledgerRows.map((row) => row.paymentTerm))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const statusOptions = [...new Set(ledgerRows.map((row) => row.status))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const filteredLedgerRows = ledgerRows.filter((row) => {
    const matchesQuery =
      !query ||
      [
        row.invoiceNo,
        row.sphNo,
        row.customerName,
        row.paymentTerm,
        row.status,
      ].some((value) => textMatches(value, query));
    const matchesStatus = !statusFilter || row.status === statusFilter;
    const matchesPayment = !paymentFilter || row.paymentTerm === paymentFilter;
    const matchesDate = isWithinDateRange(row.invoiceDateRaw, fromDate, toDate);

    return matchesQuery && matchesStatus && matchesPayment && matchesDate;
  });
  const { pageRows, safePage } = paginateRows(
    filteredLedgerRows,
    getCurrentPage(params)
  );
  const totals = filteredLedgerRows.reduce(
    (summary, row) => {
      summary.omset += row.totalAmount;
      if (row.status === "BELUM BAYAR") {
        summary.unpaid += row.totalAmount;
      }
      return summary;
    },
    { omset: 0, unpaid: 0 }
  );

  return (
    <AppShell>
      <section className="sph-list-page invoice-ledger-page">
        <div className="dashboard-header">
          <div>
            <p className="page-kicker">Ledger Invoice</p>
            <h1>List Invoice</h1>
          </div>
          <div className="invoice-summary">
            <div>
              <span>Total Transaksi</span>
              <strong>{filteredLedgerRows.length}</strong>
            </div>
            <div>
              <span>Total Omset</span>
              <strong>{formatMoney(totals.omset)}</strong>
            </div>
            <div>
              <span>Belum Bayar</span>
              <strong>{formatMoney(totals.unpaid)}</strong>
            </div>
          </div>
        </div>

        <form className="table-filter-bar">
          <label>
            <span>Search</span>
            <input
              name="q"
              placeholder="Invoice, SPH, customer"
              defaultValue={getSearchParam(params, "q")}
            />
          </label>
          <label>
            <span>Status</span>
            <select name="status" defaultValue={statusFilter}>
              <option value="">Semua Status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Payment</span>
            <select name="payment" defaultValue={paymentFilter}>
              <option value="">Semua Payment</option>
              {paymentOptions.map((payment) => (
                <option key={payment} value={payment}>
                  {payment}
                </option>
              ))}
            </select>
          </label>
          <DateRangeFilter from={fromDate} to={toDate} />
          <div className="table-filter-actions">
            <button type="submit">Filter</button>
            <Link href="/invoice">Reset</Link>
          </div>
        </form>

        <InvoiceLedgerTable
          key={[query, statusFilter, paymentFilter, fromDate, toDate, safePage].join("|")}
          rows={pageRows}
          updateLedgerAmountAction={updateLedgerAmountAction}
        />
        <Pagination
          currentPage={safePage}
          params={params}
          totalItems={filteredLedgerRows.length}
        />
      </section>
    </AppShell>
  );
}
