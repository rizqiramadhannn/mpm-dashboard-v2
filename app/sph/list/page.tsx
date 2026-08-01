import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AppShell } from "../../components/AppShell";
import { DateRangeFilter } from "../../components/DateRangeFilter";
import { getCurrentPage, paginateRows, Pagination } from "../../components/Pagination";
import { getDb } from "../../../db";
import { sphDocuments, sphItems } from "../../../db/schema";

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
    cancelled: "Cancelled",
    draft: "Draft",
    invoiced: "Invoiced",
    pending_invoice: "Pending Invoice",
  };

  return labels[status] ?? status;
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

async function deleteSphAction(formData: FormData) {
  "use server";

  const idValue = formData.get("sphId");

  if (typeof idValue !== "string" || idValue.trim() === "") {
    throw new Error("SPH tidak valid.");
  }

  const sphId = idValue.trim();
  const db = await getDb();
  await db.delete(sphDocuments).where(inArray(sphDocuments.id, [sphId]));
  revalidatePath("/sph/list");
}

async function cancelSphAction(formData: FormData) {
  "use server";

  const idValue = formData.get("sphId");

  if (typeof idValue !== "string" || idValue.trim() === "") {
    throw new Error("SPH tidak valid.");
  }

  const sphId = idValue.trim();
  const db = await getDb();
  await db
    .update(sphDocuments)
    .set({ status: "cancelled" })
    .where(eq(sphDocuments.id, sphId));
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
    .orderBy(desc(sphDocuments.createdAt), desc(sphDocuments.id));

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
        ? document.status !== "cancelled" && document.status !== "invoiced"
        : document.status === statusFilter);
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
              {["draft", "pending_invoice", "invoiced", "cancelled"].map((status) => (
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
          <table className="customer-table sph-list-table">
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
                        <details className="item-preview">
                          <summary>{items.length} item</summary>
                          <div>
                            {items.map((item) => (
                              <p key={item.id}>
                                <span>{item.lineNo}.</span> {item.partNumber || "-"} -{" "}
                                {item.partName} ({item.quantity} x{" "}
                                {formatRupiah(item.unitPrice)})
                              </p>
                            ))}
                          </div>
                        </details>
                      </td>
                      <td>
                        <span className={`status-badge ${document.status}`}>
                          {statusLabel(document.status)}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions icon-actions">
                          <a
                            aria-label={`Download ${document.sphNo}`}
                            className="icon-action"
                            href={`/sph/download/${document.id}`}
                            title="Download SPH"
                          >
                            <DownloadIcon />
                          </a>
                          <Link
                            aria-label={`Edit ${document.sphNo}`}
                            className="icon-action"
                            href={`/sph/edit/${document.id}`}
                            title="Edit SPH"
                          >
                            <EditIcon />
                          </Link>
                          <form action={cancelSphAction}>
                            <input name="sphId" type="hidden" value={document.id} />
                            <button
                              aria-label={`Cancel ${document.sphNo}`}
                              className="icon-action warning"
                              disabled={document.status === "cancelled"}
                              title="Cancel SPH"
                              type="submit"
                            >
                              <CancelIcon />
                            </button>
                          </form>
                          <form action={deleteSphAction}>
                            <input name="sphId" type="hidden" value={document.id} />
                            <button
                              aria-label={`Delete ${document.sphNo}`}
                              className="icon-action danger"
                              title="Delete SPH"
                              type="submit"
                            >
                              <TrashIcon />
                            </button>
                          </form>
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
