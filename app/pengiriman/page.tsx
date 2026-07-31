import { desc, inArray } from "drizzle-orm";
import Link from "next/link";
import { AppShell } from "../components/AppShell";
import { getDb } from "../../db";
import { shipmentJourneys, sphDocuments, sphItems } from "../../db/schema";

export const dynamic = "force-dynamic";

type SphItemRow = {
  id: number;
  sphId: number;
};

type JourneyRow = {
  sphItemId: number;
  latestStatus: string;
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

export default async function PengirimanPage() {
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
          })
          .from(shipmentJourneys)
          .where(inArray(shipmentJourneys.sphItemId, itemIds))
      : [];

  const itemCountBySph = new Map<number, number>();
  const sphIdByItem = new Map<number, number>();

  for (const item of itemRows) {
    sphIdByItem.set(item.id, item.sphId);
    itemCountBySph.set(item.sphId, (itemCountBySph.get(item.sphId) ?? 0) + 1);
  }

  const updatedCountBySph = new Map<number, number>();
  const latestStatusBySph = new Map<number, string>();

  for (const journey of journeyRows) {
    const sphId = sphIdByItem.get(journey.sphItemId);

    if (!sphId) {
      continue;
    }

    if (journey.latestStatus.trim()) {
      updatedCountBySph.set(sphId, (updatedCountBySph.get(sphId) ?? 0) + 1);
      latestStatusBySph.set(sphId, journey.latestStatus.trim());
    }
  }

  return (
    <AppShell>
      <section className="sph-list-page">
        <div className="dashboard-header">
          <div>
            <p className="page-kicker">Journey Pengiriman</p>
            <h1>Pengiriman per SPH</h1>
          </div>
        </div>

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
              {documents.length > 0 ? (
                documents.map((document) => {
                  const itemCount = itemCountBySph.get(document.id) ?? 0;
                  const updatedCount = updatedCountBySph.get(document.id) ?? 0;

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
                          {updatedCount}/{itemCount} item
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
                  <td colSpan={7}>Belum ada SPH untuk pengiriman.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
