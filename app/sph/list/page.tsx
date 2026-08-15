import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AppShell } from "../../components/AppShell";
import { ConfirmForm } from "../../components/ConfirmForm";
import { DateRangeFilter } from "../../components/DateRangeFilter";
import { getCurrentPage, paginateRows, Pagination } from "../../components/Pagination";
import { recordActivityLog, requireUser } from "../../auth";
import { ItemListModal } from "./ItemListModal";
import { getDb } from "../../../db";
import { invoiceDocuments, invoiceItems, sphDocuments, sphItems } from "../../../db/schema";

export const dynamic = "force-dynamic";

type SphItemRow = {
  id: string;
  sphId: string;
  lineNo: number;
  partNumber: string;
  partName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

const sphStatuses = [
  "cek_harga",
  "menunggu_pengiriman",
  "proses_pengiriman",
  "selesai",
  "cancel",
];

function invoiceNoFromSph(sphNo: string) {
  return sphNo.startsWith("SPH") ? `INV${sphNo.slice(3)}` : `INV-${sphNo}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    cancel: "Cancel",
    cancelled: "Cancel",
    cek_harga: "Cek Harga",
    draft: "Cek Harga",
    invoiced: "Menunggu Pengiriman",
    menunggu_pengiriman: "Menunggu Pengiriman",
    pending_invoice: "Menunggu Pengiriman",
    proses_pengiriman: "Proses Pengiriman",
    selesai: "Selesai",
  };

  return labels[status] ?? status;
}

function normalizedStatus(status: string) {
  const aliases: Record<string, string> = {
    cancelled: "cancel",
    draft: "cek_harga",
    invoiced: "menunggu_pengiriman",
    pending_invoice: "menunggu_pengiriman",
  };

  return aliases[status] ?? status;
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

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function EditIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M3 6h18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M8 6V4h8v2m-1 5v6M9 11v6m-4-11 1 14h12l1-14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="m20 6-11 11-5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

async function deleteSphAction(formData: FormData) {
  "use server";

  const user = await requireUser("/sph/list");
  const idValue = formData.get("sphId");

  if (typeof idValue !== "string" || idValue.trim() === "") {
    throw new Error("SPH tidak valid.");
  }

  const sphId = idValue.trim();
  const db = await getDb();
  const invoices = await db
    .select({ id: invoiceDocuments.id })
    .from(invoiceDocuments)
    .where(eq(invoiceDocuments.sphId, sphId));
  const invoiceIds = invoices.map((invoice) => invoice.id);

  if (invoiceIds.length > 0) {
    await db.delete(invoiceItems).where(inArray(invoiceItems.invoiceId, invoiceIds));
    await db.delete(invoiceDocuments).where(inArray(invoiceDocuments.id, invoiceIds));
  }

  await db.delete(sphDocuments).where(inArray(sphDocuments.id, [sphId]));
  await recordActivityLog({
    action: "sph_deleted",
    actor: user,
    details: { sphId },
  });
  revalidatePath("/dashboard");
  revalidatePath("/invoice");
  revalidatePath("/sph/list");
}

async function cancelSphAction(formData: FormData) {
  "use server";

  const user = await requireUser("/sph/list");
  const idValue = formData.get("sphId");

  if (typeof idValue !== "string" || idValue.trim() === "") {
    throw new Error("SPH tidak valid.");
  }

  const sphId = idValue.trim();
  const db = await getDb();
  const invoices = await db
    .select({ id: invoiceDocuments.id })
    .from(invoiceDocuments)
    .where(eq(invoiceDocuments.sphId, sphId));
  const invoiceIds = invoices.map((invoice) => invoice.id);

  if (invoiceIds.length > 0) {
    await db.delete(invoiceItems).where(inArray(invoiceItems.invoiceId, invoiceIds));
    await db.delete(invoiceDocuments).where(inArray(invoiceDocuments.id, invoiceIds));
  }

  await db
    .update(sphDocuments)
    .set({ status: "cancel" })
    .where(eq(sphDocuments.id, sphId));
  await recordActivityLog({
    action: "sph_cancelled",
    actor: user,
    details: { sphId },
  });
  revalidatePath("/dashboard");
  revalidatePath("/invoice");
  revalidatePath("/sph/list");
}

async function approveHargaAction(formData: FormData) {
  "use server";

  const user = await requireUser("/sph/list");
  const idValue = formData.get("sphId");

  if (typeof idValue !== "string" || idValue.trim() === "") {
    throw new Error("SPH tidak valid.");
  }

  const sphId = idValue.trim();
  const db = await getDb();
  const [document] = await db
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

  if (normalizedStatus(document.status) === "cancel") {
    throw new Error("SPH cancel tidak bisa di-approve.");
  }

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
    .where(eq(sphItems.sphId, sphId));

  if (items.length === 0) {
    throw new Error("SPH belum memiliki item.");
  }

  const [existingInvoice] = await db
    .select({ id: invoiceDocuments.id })
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
        await db
          .insert(invoiceDocuments)
          .values(invoiceValues)
          .returning({ id: invoiceDocuments.id })
      )[0].id;

  if (existingInvoice) {
    await db
      .update(invoiceDocuments)
      .set(invoiceValues)
      .where(eq(invoiceDocuments.id, existingInvoice.id));
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, existingInvoice.id));
  }

  await db.insert(invoiceItems).values(
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

  await db
    .update(sphDocuments)
    .set({ status: "menunggu_pengiriman" })
    .where(eq(sphDocuments.id, sphId));
  await recordActivityLog({
    action: existingInvoice ? "invoice_recreated_from_sph" : "invoice_created_from_sph",
    actor: user,
    details: {
      invoiceId,
      sphId,
      sphNo: document.sphNo,
      totalAmount: document.totalAmount,
    },
    targetUsername: document.customerName,
  });
  revalidatePath("/dashboard");
  revalidatePath("/invoice");
  revalidatePath("/pengiriman");
  revalidatePath("/sph/list");
}

export default async function ListSphPage({
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
  const documents = await db
    .select({
      id: sphDocuments.id,
      sphNo: sphDocuments.sphNo,
      customerName: sphDocuments.customerName,
      customerCode: sphDocuments.customerCode,
      sphDate: sphDocuments.sphDate,
      deliveryDate: sphDocuments.deliveryDate,
      etaDate: sphDocuments.etaDate,
      paymentTerm: sphDocuments.paymentTerm,
      franco: sphDocuments.franco,
      totalAmount: sphDocuments.totalAmount,
      status: sphDocuments.status,
      createdAt: sphDocuments.createdAt,
    })
    .from(sphDocuments)
    .orderBy(desc(sphDocuments.sphNo), desc(sphDocuments.id));

  const documentIds = documents.map((document) => document.id);
  const itemRows: SphItemRow[] =
    documentIds.length > 0
      ? await db
          .select({
            id: sphItems.id,
            sphId: sphItems.sphId,
            lineNo: sphItems.lineNo,
            partNumber: sphItems.partNumber,
            partName: sphItems.partName,
            quantity: sphItems.quantity,
            unitPrice: sphItems.unitPrice,
            totalPrice: sphItems.totalPrice,
          })
          .from(sphItems)
          .where(inArray(sphItems.sphId, documentIds))
      : [];

  const itemsBySph = new Map<string, SphItemRow[]>();

  for (const item of itemRows) {
    const items = itemsBySph.get(item.sphId) ?? [];
    items.push(item);
    itemsBySph.set(item.sphId, items);
  }

  for (const items of itemsBySph.values()) {
    items.sort((a, b) => a.lineNo - b.lineNo);
  }
  const paymentOptions = [...new Set(documents.map((document) => document.paymentTerm))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const filteredDocuments = documents.filter((document) => {
    const items = itemsBySph.get(document.id) ?? [];
    const status = normalizedStatus(document.status);
    const matchesQuery =
      !query ||
      [
        document.sphNo,
        document.customerName,
        document.customerCode,
        document.franco,
        document.paymentTerm,
        statusLabel(document.status),
        ...items.flatMap((item) => [item.partNumber, item.partName]),
    ].some((value) => textMatches(value, query));
    const matchesStatus =
      !statusFilter ||
      (statusFilter === "active"
        ? status !== "cancel" && status !== "selesai"
        : status === statusFilter);
    const matchesPayment = !paymentFilter || document.paymentTerm === paymentFilter;
    const matchesDate = isWithinDateRange(document.sphDate, fromDate, toDate);

    return matchesQuery && matchesStatus && matchesPayment && matchesDate;
  });
  const { pageRows, safePage } = paginateRows(
    filteredDocuments,
    getCurrentPage(params)
  );

  return (
    <AppShell>
      <section className="sph-list-page">
        <div className="dashboard-header">
          <div>
            <p className="page-kicker">Surat Penawaran Harga</p>
            <h1>List SPH</h1>
          </div>
          <Link className="primary-button" href="/sph/create">
            Create SPH
          </Link>
        </div>

        <form className="table-filter-bar">
          <label>
            <span>Search</span>
            <input
              name="q"
              placeholder="No SPH, customer, tujuan, item"
              defaultValue={getSearchParam(params, "q")}
            />
          </label>
          <label>
            <span>Status</span>
            <select name="status" defaultValue={statusFilter}>
              <option value="">Semua Status</option>
              <option value="active">Aktif</option>
              {sphStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
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
            <Link href="/sph/list">Reset</Link>
          </div>
        </form>

        <div className="customer-table-wrap">
          <table
            className="customer-table sph-list-table"
            data-sortable-table
            data-sort-column="0"
            data-sort-direction="desc"
          >
            <thead>
              <tr>
                <th>No. SPH</th>
                <th>Tanggal</th>
                <th>Customer</th>
                <th>Pengiriman</th>
                <th>Payment</th>
                <th>Total</th>
                <th>Item</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length > 0 ? (
                pageRows.map((document) => {
                  const items = itemsBySph.get(document.id) ?? [];
                  const status = normalizedStatus(document.status);
                  const isCekHarga = status === "cek_harga";
                  const isCancel = status === "cancel";

                  return (
                    <tr key={document.id}>
                      <td>
                        <strong className="table-primary">{document.sphNo}</strong>
                      </td>
                      <td>{formatDate(document.sphDate)}</td>
                      <td>
                        <div className="stacked-cell">
                          <strong>{document.customerName}</strong>
                          <span>{document.customerCode}</span>
                        </div>
                      </td>
                      <td>
                        <div className="stacked-cell">
                          <strong>{document.franco || "-"}</strong>
                          <span>
                            {formatDate(document.deliveryDate)} / ETA{" "}
                            {formatDate(document.etaDate)}
                          </span>
                        </div>
                      </td>
                      <td>{document.paymentTerm}</td>
                      <td>{formatRupiah(document.totalAmount)}</td>
                      <td>
                        <ItemListModal items={items} sphNo={document.sphNo} />
                      </td>
                      <td>
                        <span className={`status-badge ${status}`}>
                          {statusLabel(document.status)}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions icon-actions">
                          {isCekHarga ? (
                            <button
                              aria-label={`Download ${document.sphNo} disabled`}
                              className="icon-action"
                              disabled
                              title="Approve harga dulu untuk download SPH"
                              type="button"
                            >
                              <DownloadIcon />
                            </button>
                          ) : (
                            <a
                              aria-label={`Download ${document.sphNo}`}
                              className="icon-action"
                              href={`/sph/download/${document.id}`}
                              title="Download SPH"
                            >
                              <DownloadIcon />
                            </a>
                          )}
                          {isCekHarga ? (
                            <ConfirmForm
                              action={approveHargaAction}
                              confirmMessage={`Approve harga SPH ${document.sphNo} dan buat invoice?`}
                            >
                              <input name="sphId" type="hidden" value={document.id} />
                              <button
                                aria-label={`Approve harga ${document.sphNo}`}
                                className="icon-action success"
                                title="Approve Harga"
                                type="submit"
                              >
                                <CheckIcon />
                              </button>
                            </ConfirmForm>
                          ) : null}
                          <Link
                            aria-label={`Edit ${document.sphNo}`}
                            className="icon-action"
                            href={`/sph/edit/${document.id}`}
                            title="Edit SPH"
                          >
                            <EditIcon />
                          </Link>
                          <ConfirmForm
                            action={cancelSphAction}
                            confirmMessage={`Cancel SPH ${document.sphNo}?`}
                          >
                            <input name="sphId" type="hidden" value={document.id} />
                            <button
                              aria-label={`Cancel ${document.sphNo}`}
                              className="icon-action warning"
                              disabled={isCancel}
                              title="Cancel SPH"
                              type="submit"
                            >
                              <CancelIcon />
                            </button>
                          </ConfirmForm>
                          <ConfirmForm
                            action={deleteSphAction}
                            confirmMessage={`Hapus SPH ${document.sphNo} beserta invoice terkait?`}
                          >
                            <input name="sphId" type="hidden" value={document.id} />
                            <button
                              aria-label={`Delete ${document.sphNo}`}
                              className="icon-action danger"
                              title="Delete SPH"
                              type="submit"
                            >
                              <TrashIcon />
                            </button>
                          </ConfirmForm>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9}>Tidak ada SPH sesuai filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={safePage}
          params={params}
          totalItems={filteredDocuments.length}
        />
      </section>
    </AppShell>
  );
}
