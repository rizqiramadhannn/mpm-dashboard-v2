import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AppShell } from "../../components/AppShell";
import { getDb } from "../../../db";
import { sphDocuments, sphItems } from "../../../db/schema";

export const dynamic = "force-dynamic";

type SphItemRow = {
  id: number;
  sphId: number;
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
  const sphId = Number(idValue);

  if (!Number.isInteger(sphId) || sphId <= 0) {
    throw new Error("SPH tidak valid.");
  }

  const db = await getDb();
  await db.delete(sphDocuments).where(inArray(sphDocuments.id, [sphId]));
  revalidatePath("/sph/list");
}

async function cancelSphAction(formData: FormData) {
  "use server";

  const idValue = formData.get("sphId");
  const sphId = Number(idValue);

  if (!Number.isInteger(sphId) || sphId <= 0) {
    throw new Error("SPH tidak valid.");
  }

  const db = await getDb();
  await db
    .update(sphDocuments)
    .set({ status: "cancelled" })
    .where(eq(sphDocuments.id, sphId));
  revalidatePath("/sph/list");
}

export default async function ListSphPage() {
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

  const itemsBySph = new Map<number, SphItemRow[]>();

  for (const item of itemRows) {
    const items = itemsBySph.get(item.sphId) ?? [];
    items.push(item);
    itemsBySph.set(item.sphId, items);
  }

  for (const items of itemsBySph.values()) {
    items.sort((a, b) => a.lineNo - b.lineNo);
  }

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
              {documents.length > 0 ? (
                documents.map((document) => {
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
                  <td colSpan={9}>Belum ada SPH.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
