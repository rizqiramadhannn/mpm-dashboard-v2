import { eq, inArray, sql } from "drizzle-orm";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { listSuppliers } from "../../supplier/data";
import { getDb } from "../../../db";
import {
  shipmentJourneys,
  sphDocuments,
  sphItems,
} from "../../../db/schema";

export const dynamic = "force-dynamic";

type JourneyRow = {
  id: number;
  sphItemId: number;
  supplyType: "stock" | "supplier";
  supplierId: number | null;
  origin: string;
  destination: string;
  latestStatus: string;
};

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseSupply(value: string) {
  if (value.startsWith("supplier:")) {
    const supplierId = Number(value.replace("supplier:", ""));

    if (Number.isInteger(supplierId) && supplierId > 0) {
      return { supplierId, supplyType: "supplier" as const };
    }
  }

  return { supplierId: null, supplyType: "stock" as const };
}

async function updateShipmentJourneyAction(formData: FormData) {
  "use server";

  const sphId = Number(formData.get("sphId"));

  if (!Number.isInteger(sphId) || sphId <= 0) {
    throw new Error("SPH tidak valid.");
  }

  const db = await getDb();
  const itemRows = await db
    .select({
      id: sphItems.id,
    })
    .from(sphItems)
    .where(eq(sphItems.sphId, sphId));

  if (itemRows.length === 0) {
    throw new Error("SPH belum memiliki item.");
  }

  const itemIds = itemRows.map((item) => item.id);
  const existingRows = await db
    .select({
      id: shipmentJourneys.id,
      sphItemId: shipmentJourneys.sphItemId,
    })
    .from(shipmentJourneys)
    .where(inArray(shipmentJourneys.sphItemId, itemIds));
  const journeyIdByItem = new Map(
    existingRows.map((journey) => [journey.sphItemId, journey.id])
  );

  for (const item of itemRows) {
    const supply = parseSupply(formText(formData, `supply-${item.id}`));
    const values = {
      destination: formText(formData, `destination-${item.id}`),
      latestStatus: formText(formData, `latestStatus-${item.id}`),
      origin: formText(formData, `origin-${item.id}`),
      supplierId: supply.supplierId,
      supplyType: supply.supplyType,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    };
    const journeyId = journeyIdByItem.get(item.id);

    if (journeyId) {
      await db
        .update(shipmentJourneys)
        .set(values)
        .where(eq(shipmentJourneys.id, journeyId));
    } else {
      await db.insert(shipmentJourneys).values({
        ...values,
        sphItemId: item.id,
      });
    }
  }

  revalidatePath("/pengiriman");
  revalidatePath(`/pengiriman/${sphId}`);
}

function formatSupply(journey: JourneyRow | undefined, supplierNameById: Map<number, string>) {
  if (!journey) {
    return "Stok";
  }

  if (journey.supplyType === "supplier" && journey.supplierId) {
    return supplierNameById.get(journey.supplierId) ?? "Supplier";
  }

  return "Stok";
}

export default async function PengirimanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sphId = Number(id);

  if (!Number.isInteger(sphId) || sphId <= 0) {
    notFound();
  }

  const db = await getDb();
  const [document] = await db
    .select({
      id: sphDocuments.id,
      sphNo: sphDocuments.sphNo,
      customerName: sphDocuments.customerName,
      customerCode: sphDocuments.customerCode,
      franco: sphDocuments.franco,
      deliveryDate: sphDocuments.deliveryDate,
      etaDate: sphDocuments.etaDate,
    })
    .from(sphDocuments)
    .where(eq(sphDocuments.id, sphId))
    .limit(1);

  if (!document) {
    notFound();
  }

  const itemRows = await db
    .select({
      id: sphItems.id,
      lineNo: sphItems.lineNo,
      partNumber: sphItems.partNumber,
      partName: sphItems.partName,
      quantity: sphItems.quantity,
    })
    .from(sphItems)
    .where(eq(sphItems.sphId, sphId));
  itemRows.sort((a, b) => a.lineNo - b.lineNo);

  const itemIds = itemRows.map((item) => item.id);
  const journeyRows: JourneyRow[] =
    itemIds.length > 0
      ? await db
          .select({
            id: shipmentJourneys.id,
            sphItemId: shipmentJourneys.sphItemId,
            supplyType: shipmentJourneys.supplyType,
            supplierId: shipmentJourneys.supplierId,
            origin: shipmentJourneys.origin,
            destination: shipmentJourneys.destination,
            latestStatus: shipmentJourneys.latestStatus,
          })
          .from(shipmentJourneys)
          .where(inArray(shipmentJourneys.sphItemId, itemIds))
      : [];
  const journeyByItem = new Map(journeyRows.map((journey) => [journey.sphItemId, journey]));
  const supplierOptions = await listSuppliers();
  const supplierNameById = new Map(
    supplierOptions.map((supplier) => [supplier.id, supplier.name])
  );

  return (
    <AppShell>
      <form action={updateShipmentJourneyAction} className="shipment-detail-page">
        <input name="sphId" type="hidden" value={document.id} />
        <section className="form-section">
          <div className="section-heading">
            <div>
              <p className="page-kicker">Journey Pengiriman</p>
              <h1>{document.sphNo}</h1>
              <p>
                {document.customerName} ({document.customerCode}) - Tujuan SPH:{" "}
                {document.franco || "-"}
              </p>
            </div>
            <div className="shipment-heading-actions">
              <Link className="secondary-button" href="/pengiriman">
                Kembali
              </Link>
              <button className="primary-button" type="submit">
                Simpan Journey
              </button>
            </div>
          </div>
        </section>

        <div className="shipment-journey-list">
          {itemRows.length > 0 ? (
            itemRows.map((item) => {
              const journey = journeyByItem.get(item.id);
              const selectedSupply =
                journey?.supplyType === "supplier" && journey.supplierId
                  ? `supplier:${journey.supplierId}`
                  : "stock";

              return (
                <section className="shipment-item" key={item.id}>
                  <div className="shipment-item-summary">
                    <div>
                      <span>Item {item.lineNo}</span>
                      <strong>{item.partName}</strong>
                      <p>
                        {item.partNumber || "-"} - Qty {item.quantity}
                      </p>
                    </div>
                    <div>
                      <span>Supply</span>
                      <strong>{formatSupply(journey, supplierNameById)}</strong>
                    </div>
                  </div>

                  <div className="shipment-grid">
                    <label>
                      <span>Supply</span>
                      <select name={`supply-${item.id}`} defaultValue={selectedSupply}>
                        <option value="stock">Stok</option>
                        {supplierOptions.map((supplier) => (
                          <option key={supplier.id} value={`supplier:${supplier.id}`}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Asal</span>
                      <input
                        name={`origin-${item.id}`}
                        placeholder="Gudang / lokasi supplier"
                        defaultValue={journey?.origin}
                      />
                    </label>

                    <label>
                      <span>Tujuan</span>
                      <input
                        name={`destination-${item.id}`}
                        placeholder={document.franco || "Lokasi tujuan"}
                        defaultValue={journey?.destination || document.franco}
                      />
                    </label>

                    <label>
                      <span>Status Terakhir</span>
                      <input
                        name={`latestStatus-${item.id}`}
                        placeholder="Transit, menunggu driver, sampai"
                        defaultValue={journey?.latestStatus}
                      />
                    </label>
                  </div>
                </section>
              );
            })
          ) : (
            <section className="empty-state">SPH ini belum memiliki item.</section>
          )}
        </div>
      </form>
    </AppShell>
  );
}
