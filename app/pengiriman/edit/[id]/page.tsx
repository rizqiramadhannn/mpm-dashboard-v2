import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { ConfirmForm } from "../../../components/ConfirmForm";
import { getDb } from "../../../../db";
import {
  shipmentJourneys,
  shipments,
  sphDocuments,
  sphItems,
} from "../../../../db/schema";
import { recordActivityLog, requireUser } from "../../../auth";
import { listSuppliers } from "../../../supplier/data";

export const dynamic = "force-dynamic";

type ShipmentItemRow = {
  customerReceived: boolean;
  customerReceivedAt: string | null;
  journeyId: string;
  latestStatus: string;
  lineNo: number;
  origin: string;
  partName: string;
  partNumber: string;
  quantity: number;
  sphId: string;
  sphItemId: string;
  sphNo: string;
  sphQuantity: number;
  supplierId: string | null;
  supplyType: "stock" | "supplier";
};

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseAmount(value: FormDataEntryValue | null, key: string) {
  const amount = Number(value);

  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`${key} harus berupa angka valid.`);
  }

  return amount;
}

function parseSupply(value: string) {
  if (value.startsWith("supplier:")) {
    const supplierId = value.replace("supplier:", "").trim();

    if (supplierId) {
      return { supplierId, supplyType: "supplier" as const };
    }
  }

  return { supplierId: null, supplyType: "stock" as const };
}

async function refreshSphStatuses(
  db: Awaited<ReturnType<typeof getDb>>,
  sphIds: string[]
) {
  for (const sphId of sphIds) {
    const documentItems = await db
      .select({
        id: sphItems.id,
        quantity: sphItems.quantity,
      })
      .from(sphItems)
      .where(eq(sphItems.sphId, sphId));
    const itemIds = documentItems.map((item) => item.id);
    const journeys =
      itemIds.length > 0
        ? await db
            .select({
              customerReceived: shipmentJourneys.customerReceived,
              latestStatus: shipmentJourneys.latestStatus,
              origin: shipmentJourneys.origin,
              quantity: shipmentJourneys.quantity,
              shippingCost: shipmentJourneys.shippingCost,
              shippingVendor: shipmentJourneys.shippingVendor,
              sphItemId: shipmentJourneys.sphItemId,
              supplyType: shipmentJourneys.supplyType,
            })
            .from(shipmentJourneys)
            .where(inArray(shipmentJourneys.sphItemId, itemIds))
        : [];
    const receivedQtyByItem = new Map<string, number>();
    let hasShipmentData = false;

    for (const journey of journeys) {
      if (journey.customerReceived) {
        receivedQtyByItem.set(
          journey.sphItemId,
          (receivedQtyByItem.get(journey.sphItemId) ?? 0) + journey.quantity
        );
      }

      if (
        journey.customerReceived ||
        journey.latestStatus.trim() ||
        journey.origin.trim() ||
        journey.shippingVendor.trim() ||
        journey.shippingCost > 0 ||
        journey.supplyType === "supplier"
      ) {
        hasShipmentData = true;
      }
    }

    const isComplete = documentItems.every(
      (item) => (receivedQtyByItem.get(item.id) ?? 0) >= item.quantity
    );
    const [document] = await db
      .select({ status: sphDocuments.status })
      .from(sphDocuments)
      .where(eq(sphDocuments.id, sphId))
      .limit(1);

    if (!document || ["cek_harga", "draft", "cancel", "cancelled"].includes(document.status)) {
      continue;
    }

    await db
      .update(sphDocuments)
      .set({
        status: isComplete
          ? "selesai"
          : hasShipmentData
            ? "proses_pengiriman"
            : "menunggu_pengiriman",
      })
      .where(eq(sphDocuments.id, sphId));
  }
}

async function updateShipmentAction(formData: FormData) {
  "use server";

  const user = await requireUser("/pengiriman");
  const shipmentId = formText(formData, "shipmentId");

  if (!shipmentId) {
    throw new Error("Pengiriman tidak valid.");
  }

  const shipmentDate = formText(formData, "shipmentDate");
  const origin = formText(formData, "origin");
  const destination = formText(formData, "destination");
  const shippingVendor = formText(formData, "shippingVendor");
  const formStatus = formText(formData, "latestStatus") || "TERJADWAL";
  const notes = formText(formData, "notes");
  const shippingCost = parseAmount(formData.get("shippingCost"), "Ongkir");
  const journeyIds = formData
    .getAll("journeyId")
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .map((value) => value.trim());

  if (!shipmentDate) {
    throw new Error("Tanggal pengiriman wajib diisi.");
  }

  if (!origin) {
    throw new Error("Asal pengiriman wajib diisi.");
  }

  if (!destination) {
    throw new Error("Tujuan pengiriman wajib diisi.");
  }

  if (journeyIds.length === 0) {
    throw new Error("Pengiriman belum memiliki item.");
  }

  const db = await getDb();
  const currentJourneys = await db
    .select({
      customerReceived: shipmentJourneys.customerReceived,
      customerReceivedAt: shipmentJourneys.customerReceivedAt,
      id: shipmentJourneys.id,
      shipmentId: shipmentJourneys.shipmentId,
      sphItemId: shipmentJourneys.sphItemId,
    })
    .from(shipmentJourneys)
    .where(inArray(shipmentJourneys.id, journeyIds));

  if (
    currentJourneys.length !== journeyIds.length ||
    currentJourneys.some((journey) => journey.shipmentId !== shipmentId)
  ) {
    throw new Error("Item pengiriman tidak cocok dengan TTB ini.");
  }

  const itemIds = currentJourneys.map((journey) => journey.sphItemId);
  const itemRows = await db
    .select({
      id: sphItems.id,
      quantity: sphItems.quantity,
      sphId: sphItems.sphId,
    })
    .from(sphItems)
    .where(inArray(sphItems.id, itemIds));
  const itemById = new Map(itemRows.map((item) => [item.id, item]));
  const affectedSphIds = [...new Set(itemRows.map((item) => item.sphId))];
  const allItemJourneys = await db
    .select({
      id: shipmentJourneys.id,
      quantity: shipmentJourneys.quantity,
      sphItemId: shipmentJourneys.sphItemId,
    })
    .from(shipmentJourneys)
    .where(inArray(shipmentJourneys.sphItemId, itemIds));
  const otherQtyByItem = new Map<string, number>();

  for (const journey of allItemJourneys) {
    if (journeyIds.includes(journey.id)) {
      continue;
    }

    otherQtyByItem.set(
      journey.sphItemId,
      (otherQtyByItem.get(journey.sphItemId) ?? 0) + journey.quantity
    );
  }

  let allReceived = true;

  for (const journey of currentJourneys) {
    const item = itemById.get(journey.sphItemId);
    const quantity = parseAmount(formData.get(`quantity-${journey.id}`), "Qty kirim");
    const supply = parseSupply(formText(formData, `supply-${journey.id}`));
    const customerReceived = formData.get(`customerReceived-${journey.id}`) === "on";
    const latestStatus = customerReceived
      ? "TERKIRIM"
      : formText(formData, `latestStatus-${journey.id}`) || formStatus;

    if (!item) {
      throw new Error("Item pengiriman tidak ditemukan.");
    }

    const maxEditableQuantity = item.quantity - (otherQtyByItem.get(item.id) ?? 0);

    if (quantity <= 0 || quantity > maxEditableQuantity) {
      throw new Error("Qty kirim harus lebih dari 0 dan tidak boleh melebihi qty SPH.");
    }

    allReceived = allReceived && customerReceived;

    await db
      .update(shipmentJourneys)
      .set({
        customerReceived,
        customerReceivedAt: customerReceived
          ? journey.customerReceivedAt || new Date().toISOString()
          : null,
        destination,
        latestStatus,
        origin,
        quantity,
        shippingCost,
        shippingVendor,
        supplierId: supply.supplierId,
        supplyType: supply.supplyType,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shipmentJourneys.id, journey.id));
  }

  await db
    .update(shipments)
    .set({
      destination,
      latestStatus: allReceived ? "TERKIRIM" : formStatus,
      notes,
      shipmentDate,
      shippingCost,
      shippingVendor,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(shipments.id, shipmentId));

  await refreshSphStatuses(db, affectedSphIds);

  await recordActivityLog({
    action: "shipment_journey_updated",
    actor: user,
    details: {
      journeyCount: journeyIds.length,
      shipmentId,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/invoice");
  revalidatePath("/pengiriman");
  revalidatePath(`/pengiriman/edit/${shipmentId}`);
  revalidatePath("/sph/list");
  redirect("/pengiriman");
}

export default async function EditShipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  const db = await getDb();
  const [shipment] = await db
    .select({
      customerCode: shipments.customerCode,
      customerName: shipments.customerName,
      destination: shipments.destination,
      id: shipments.id,
      latestStatus: shipments.latestStatus,
      notes: shipments.notes,
      shipmentDate: shipments.shipmentDate,
      shipmentNo: shipments.shipmentNo,
      shippingCost: shipments.shippingCost,
      shippingVendor: shipments.shippingVendor,
    })
    .from(shipments)
    .where(eq(shipments.id, id))
    .limit(1);

  if (!shipment) {
    notFound();
  }

  const [items, suppliers] = await Promise.all([
    db
      .select({
        customerReceived: shipmentJourneys.customerReceived,
        customerReceivedAt: shipmentJourneys.customerReceivedAt,
        journeyId: shipmentJourneys.id,
        latestStatus: shipmentJourneys.latestStatus,
        lineNo: sphItems.lineNo,
        origin: shipmentJourneys.origin,
        partName: sphItems.partName,
        partNumber: sphItems.partNumber,
        quantity: shipmentJourneys.quantity,
        sphId: sphDocuments.id,
        sphItemId: sphItems.id,
        sphNo: sphDocuments.sphNo,
        sphQuantity: sphItems.quantity,
        supplierId: shipmentJourneys.supplierId,
        supplyType: shipmentJourneys.supplyType,
      })
      .from(shipmentJourneys)
      .innerJoin(sphItems, eq(shipmentJourneys.sphItemId, sphItems.id))
      .innerJoin(sphDocuments, eq(sphItems.sphId, sphDocuments.id))
      .where(eq(shipmentJourneys.shipmentId, id)),
    listSuppliers(),
  ]);
  const rows = (items as ShipmentItemRow[]).sort(
    (a, b) => a.sphNo.localeCompare(b.sphNo) || a.lineNo - b.lineNo
  );
  const origin = rows.find((item) => item.origin.trim())?.origin ?? "";

  return (
    <AppShell>
      <ConfirmForm
        action={updateShipmentAction}
        className="shipment-detail-page"
        confirmMessage={`Simpan pengiriman ${shipment.shipmentNo}?`}
      >
        <input name="shipmentId" type="hidden" value={shipment.id} />
        <section className="form-section">
          <div className="section-heading">
            <div>
              <p className="page-kicker">Operasional Pengiriman</p>
              <h1>Edit Pengiriman</h1>
              <p>
                {shipment.shipmentNo} - {shipment.customerName} ({shipment.customerCode})
              </p>
            </div>
            <div className="shipment-heading-actions">
              <Link className="secondary-button" href="/pengiriman">
                Kembali
              </Link>
              <button className="primary-button" type="submit">
                Simpan Pengiriman
              </button>
            </div>
          </div>

          <div className="form-grid">
            <label>
              <span>Tanggal Pengiriman</span>
              <input
                defaultValue={shipment.shipmentDate}
                name="shipmentDate"
                type="date"
              />
            </label>
            <label>
              <span>Vendor Pengiriman</span>
              <input
                defaultValue={shipment.shippingVendor}
                name="shippingVendor"
                placeholder="Nama vendor / ekspedisi"
              />
            </label>
            <label>
              <span>Biaya Kirim</span>
              <input
                defaultValue={shipment.shippingCost || ""}
                min="0"
                name="shippingCost"
                placeholder="0"
                type="number"
              />
            </label>
            <label className="full-width">
              <span>Asal</span>
              <input
                defaultValue={origin}
                name="origin"
                placeholder="Gudang / lokasi supplier"
              />
            </label>
            <label className="full-width">
              <span>Tujuan</span>
              <input
                defaultValue={shipment.destination}
                name="destination"
                placeholder="Lokasi tujuan pengiriman"
              />
            </label>
            <label>
              <span>Status</span>
              <input defaultValue={shipment.latestStatus} name="latestStatus" />
            </label>
            <label>
              <span>Catatan</span>
              <input defaultValue={shipment.notes} name="notes" placeholder="Opsional" />
            </label>
          </div>
        </section>

        <section className="form-section">
          <div className="section-heading compact">
            <div>
              <h2>Item Pengiriman</h2>
              <p>Item yang masuk dalam TTB ini.</p>
            </div>
          </div>

          <div className="customer-table-wrap">
            <table className="customer-table shipment-create-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>SPH</th>
                  <th>Item</th>
                  <th>Supply</th>
                  <th>Qty SPH</th>
                  <th>Qty Kirim</th>
                  <th>Status</th>
                  <th>Diterima</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item, index) => (
                  <tr key={item.journeyId}>
                    <td>{index + 1}</td>
                    <td>{item.sphNo}</td>
                    <td>
                      <strong>{item.partName}</strong>
                      <span className="shipment-row-meta">
                        {item.partNumber || "-"} / Line {item.lineNo}
                      </span>
                    </td>
                    <td>
                      <input name="journeyId" type="hidden" value={item.journeyId} />
                      <select
                        defaultValue={
                          item.supplyType === "supplier" && item.supplierId
                            ? `supplier:${item.supplierId}`
                            : "stock"
                        }
                        name={`supply-${item.journeyId}`}
                      >
                        <option value="stock">Stok</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={`supplier:${supplier.id}`}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className="journey-progress">{item.sphQuantity}</span>
                    </td>
                    <td>
                      <input
                        defaultValue={item.quantity}
                        min="1"
                        max={item.sphQuantity}
                        name={`quantity-${item.journeyId}`}
                        type="number"
                      />
                    </td>
                    <td>
                      <input
                        defaultValue={item.latestStatus || shipment.latestStatus}
                        name={`latestStatus-${item.journeyId}`}
                        placeholder="Transit, menunggu driver, sampai"
                      />
                    </td>
                    <td>
                      <label className="checkbox-field compact-checkbox">
                        <input
                          defaultChecked={item.customerReceived}
                          name={`customerReceived-${item.journeyId}`}
                          type="checkbox"
                        />
                        <span>Ya</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </ConfirmForm>
    </AppShell>
  );
}
