import { desc, inArray } from "drizzle-orm";
import Link from "next/link";
import { AppShell } from "../components/AppShell";
import { getCurrentPage, paginateRows, Pagination } from "../components/Pagination";
import { getDb } from "../../db";
import { shipmentJourneys, sphDocuments, sphItems } from "../../db/schema";

export const dynamic = "force-dynamic";

type SphItemRow = {
  id: string;
  sphId: string;
  quantity: number;
};

type JourneyRow = {
  sphItemId: string;
  latestStatus: string;
  quantity: number;
  customerReceived: boolean;
};

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

function isShipmentFinal(status: string) {
  const normalized = status.trim().toLowerCase();

  return [
    "arrived",
    "cancelled",
    "delivered",
    "done",
    "received",
    "selesai",
    "terkirim",
  ].includes(normalized);
}

function normalizedSphStatus(status: string) {
  const aliases: Record<string, string> = {
    cancelled: "cancel",
    draft: "cek_harga",
    invoiced: "menunggu_pengiriman",
    pending_invoice: "menunggu_pengiriman",
  };

  return aliases[status] ?? status;
}

export default async function PengirimanPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = getSearchParam(params, "q").trim().toLowerCase();
  const statusFilter = getSearchParam(params, "status");
  const db = await getDb();
  const documents = await db
    .select({
      id: sphDocuments.id,
      sphNo: sphDocuments.sphNo,
      customerName: sphDocuments.customerName,
      customerCode: sphDocuments.customerCode,
      deliveryDate: sphDocuments.deliveryDate,
      etaDate: sphDocuments.etaDate,
      franco: sphDocuments.franco,
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
            quantity: sphItems.quantity,
          })
          .from(sphItems)
          .where(inArray(sphItems.sphId, documentIds))
      : [];

  const itemIds = itemRows.map((item) => item.id);
  const journeyRows: JourneyRow[] =
    itemIds.length > 0
      ? await db
          .select({
            sphItemId: shipmentJourneys.sphItemId,
            latestStatus: shipmentJourneys.latestStatus,
            quantity: shipmentJourneys.quantity,
            customerReceived: shipmentJourneys.customerReceived,
          })
          .from(shipmentJourneys)
          .where(inArray(shipmentJourneys.sphItemId, itemIds))
      : [];

  const itemQtyBySph = new Map<string, number>();
  const sphIdByItem = new Map<string, string>();

  for (const item of itemRows) {
    sphIdByItem.set(item.id, item.sphId);
    itemQtyBySph.set(item.sphId, (itemQtyBySph.get(item.sphId) ?? 0) + item.quantity);
  }

  const receivedQtyBySph = new Map<string, number>();
  const latestStatusBySph = new Map<string, string>();

  for (const journey of journeyRows) {
    const sphId = sphIdByItem.get(journey.sphItemId);

    if (!sphId) {
      continue;
    }

    if (journey.customerReceived) {
      receivedQtyBySph.set(
        sphId,
        (receivedQtyBySph.get(sphId) ?? 0) + journey.quantity
      );
    }

    if (journey.latestStatus.trim()) {
      latestStatusBySph.set(sphId, journey.latestStatus.trim());
    }
  }

  const filteredDocuments = documents.filter((document) => {
    const sphStatus = normalizedSphStatus(document.status);
    const totalQty = itemQtyBySph.get(document.id) ?? 0;
    const receivedQty = receivedQtyBySph.get(document.id) ?? 0;
    const latestStatus = latestStatusBySph.get(document.id) || "";
    const isPending =
      sphStatus !== "selesai" &&
      (totalQty === 0 || receivedQty < totalQty || !isShipmentFinal(latestStatus));
    const matchesQuery =
      !query ||
      [
        document.sphNo,
        document.customerName,
        document.customerCode,
        document.franco,
        latestStatus,
      ].some((value) => textMatches(value, query));
    const matchesStatus =
      !statusFilter ||
      (statusFilter === "pending" ? isPending : !isPending);

    return (
      !["cek_harga", "cancel"].includes(sphStatus) &&
      matchesQuery &&
      matchesStatus
    );
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
            <p className="page-kicker">Journey Pengiriman</p>
            <h1>Pengiriman per SPH</h1>
          </div>
        </div>

        <form className="table-filter-bar">
          <label>
            <span>Search</span>
            <input
              name="q"
              placeholder="No SPH, customer, tujuan, status"
              defaultValue={getSearchParam(params, "q")}
            />
          </label>
          <label>
            <span>Status</span>
            <select name="status" defaultValue={statusFilter}>
              <option value="">Semua Status</option>
              <option value="pending">Pending</option>
              <option value="done">Selesai</option>
            </select>
          </label>
          <div className="table-filter-actions">
            <button type="submit">Filter</button>
            <Link href="/pengiriman">Reset</Link>
          </div>
        </form>

        <div className="customer-table-wrap">
          <table className="customer-table shipment-list-table">
            <thead>
              <tr>
                <th>No. SPH</th>
                <th>Customer</th>
                <th>Tujuan SPH</th>
                <th>Jadwal</th>
                <th>Item Journey</th>
                <th>Status Terakhir</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length > 0 ? (
                pageRows.map((document) => {
                  const totalQty = itemQtyBySph.get(document.id) ?? 0;
                  const receivedQty = receivedQtyBySph.get(document.id) ?? 0;

                  return (
                    <tr key={document.id}>
                      <td>
                        <strong className="table-primary">{document.sphNo}</strong>
                      </td>
                      <td>
                        <div className="stacked-cell">
                          <strong>{document.customerName}</strong>
                          <span>{document.customerCode}</span>
                        </div>
                      </td>
                      <td>{document.franco || "-"}</td>
                      <td>
                        <div className="stacked-cell">
                          <strong>{formatDate(document.deliveryDate)}</strong>
                          <span>ETA {formatDate(document.etaDate)}</span>
                        </div>
                      </td>
                      <td>
                        <span className="journey-progress">
                          {receivedQty}/{totalQty} qty
                        </span>
                      </td>
                      <td>{latestStatusBySph.get(document.id) || "-"}</td>
                      <td>
                        <div className="table-actions">
                          <Link href={`/pengiriman/${document.id}`}>
                            Detail Journey
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>Belum ada SPH untuk pengiriman sesuai filter.</td>
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
