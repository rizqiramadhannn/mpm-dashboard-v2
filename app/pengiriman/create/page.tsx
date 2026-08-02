import { desc, eq, inArray, like } from "drizzle-orm";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { ConfirmForm } from "../../components/ConfirmForm";
import { getDb } from "../../../db";
import {
  shipmentJourneys,
  shipments,
  sphDocuments,
  sphItems,
} from "../../../db/schema";
import { listSuppliers } from "../../supplier/data";
import { CreateShipmentItemsTable } from "./CreateShipmentItemsTable";

export const dynamic = "force-dynamic";

export type AvailableItem = {
  customerCode: string;
  customerName: string;
  destination: string;
  itemId: string;
  lineNo: number;
  partName: string;
  partNumber: string;
  remainingQty: number;
  sphId: string;
  sphNo: string;
};

export type SupplierOption = {
  id: string;
  name: string;
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

function todayDate() {
  return new Date().toISOString().slice(0, 10);
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

function isEligibleSph(status: string) {
  return !["cek_harga", "cancel"].includes(normalizedSphStatus(status));
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

function regexEscape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function nextShipmentNo(
  db: Awaited<ReturnType<typeof getDb>>,
  shipmentDate: string,
  customerCode: string
) {
  const yearMonth = shipmentDate.slice(0, 7).replace("-", "");

  if (!/^\d{6}$/.test(yearMonth)) {
    throw new Error("Tanggal pengiriman tidak valid untuk nomor TTB.");
  }

  const prefix = `TTB${yearMonth}`;
  const existingRows = await db
    .select({ shipmentNo: shipments.shipmentNo })
    .from(shipments)
    .where(like(shipments.shipmentNo, `${prefix}%${customerCode}`));
  const pattern = new RegExp(`^${prefix}(\\d{3})${regexEscape(customerCode)}$`);
  const maxSequence = existingRows.reduce((max, row) => {
    const match = row.shipmentNo.match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `${prefix}${String(maxSequence + 1).padStart(3, "0")}${customerCode}`;
}

async function createShipmentAction(formData: FormData) {
  "use server";

  const selectedItemIds = formData
    .getAll("selectedItemId")
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .map((value) => value.trim());
  const uniqueSelectedItemIds = [...new Set(selectedItemIds)];

  if (uniqueSelectedItemIds.length === 0) {
    throw new Error("Pilih minimal satu item untuk dikirim.");
  }

  const shipmentDate = formText(formData, "shipmentDate") || todayDate();
  const origin = formText(formData, "origin");
  const destination = formText(formData, "destination");
  const shippingVendor = formText(formData, "shippingVendor");
  const latestStatus = formText(formData, "latestStatus") || "TERJADWAL";
  const notes = formText(formData, "notes");
  const shippingCost = parseAmount(formData.get("shippingCost"), "Ongkir");

  if (!destination) {
    throw new Error("Tujuan pengiriman wajib diisi.");
  }

  if (!origin) {
    throw new Error("Asal pengiriman wajib diisi.");
  }

  const db = await getDb();
  const itemRows = await db
    .select({
      customerCode: sphDocuments.customerCode,
      customerName: sphDocuments.customerName,
      itemId: sphItems.id,
      quantity: sphItems.quantity,
      sphId: sphDocuments.id,
      sphStatus: sphDocuments.status,
    })
    .from(sphItems)
    .innerJoin(sphDocuments, eq(sphItems.sphId, sphDocuments.id))
    .where(inArray(sphItems.id, uniqueSelectedItemIds));

  if (itemRows.length !== uniqueSelectedItemIds.length) {
    throw new Error("Sebagian item tidak ditemukan.");
  }

  const invalidSph = itemRows.find((item) => !isEligibleSph(item.sphStatus));

  if (invalidSph) {
    throw new Error("Ada item dari SPH yang belum eligible untuk pengiriman.");
  }

  const customerCodes = new Set(itemRows.map((item) => item.customerCode));

  if (customerCodes.size > 1) {
    throw new Error("Satu pengiriman hanya boleh berisi item dari customer yang sama.");
  }

  const existingJourneys = await db
    .select({
      quantity: shipmentJourneys.quantity,
      sphItemId: shipmentJourneys.sphItemId,
      splitNo: shipmentJourneys.splitNo,
    })
    .from(shipmentJourneys)
    .where(inArray(shipmentJourneys.sphItemId, uniqueSelectedItemIds));
  const usedQtyByItem = new Map<string, number>();
  const maxSplitNoByItem = new Map<string, number>();

  for (const journey of existingJourneys) {
    usedQtyByItem.set(
      journey.sphItemId,
      (usedQtyByItem.get(journey.sphItemId) ?? 0) + journey.quantity
    );
    maxSplitNoByItem.set(
      journey.sphItemId,
      Math.max(maxSplitNoByItem.get(journey.sphItemId) ?? 0, journey.splitNo)
    );
  }

  const journeyValues: (typeof shipmentJourneys.$inferInsert)[] = [];

  for (const item of itemRows) {
    const sendQty = parseAmount(formData.get(`quantity-${item.itemId}`), "Qty kirim");
    const supply = parseSupply(formText(formData, `supply-${item.itemId}`));
    const remainingQty = item.quantity - (usedQtyByItem.get(item.itemId) ?? 0);

    if (sendQty <= 0) {
      throw new Error("Qty kirim item terpilih harus lebih dari 0.");
    }

    if (sendQty > remainingQty) {
      throw new Error(`Qty kirim melebihi sisa qty untuk item ${item.itemId}.`);
    }

    journeyValues.push({
      batchNo: 1,
      customerReceived: false,
      customerReceivedAt: null,
      destination,
      isShippingPaid: false,
      latestStatus,
      origin,
      quantity: sendQty,
      shipmentId: "",
      shippingCost,
      shippingVendor,
      sphItemId: item.itemId,
      splitNo: (maxSplitNoByItem.get(item.itemId) ?? 0) + 1,
      supplierId: supply.supplierId,
      supplyType: supply.supplyType,
    });
  }

  const [firstItem] = itemRows;
  const shipmentNo = await nextShipmentNo(db, shipmentDate, firstItem.customerCode);
  const [insertedShipment] = await db
    .insert(shipments)
    .values({
      customerCode: firstItem.customerCode,
      customerName: firstItem.customerName,
      destination,
      isShippingPaid: false,
      latestStatus,
      notes,
      shipmentDate,
      shipmentNo,
      shippingCost,
      shippingVendor,
    })
    .returning({ id: shipments.id });

  await db.insert(shipmentJourneys).values(
    journeyValues.map((journey) => ({
      ...journey,
      shipmentId: insertedShipment.id,
    }))
  );

  const affectedSphIds = [...new Set(itemRows.map((item) => item.sphId))];

  if (affectedSphIds.length > 0) {
    await db
      .update(sphDocuments)
      .set({ status: "proses_pengiriman" })
      .where(inArray(sphDocuments.id, affectedSphIds));
  }

  revalidatePath("/pengiriman");
  revalidatePath("/dashboard");
  revalidatePath("/invoice");
  revalidatePath("/sph/list");
  redirect("/pengiriman");
}

async function getAvailableItems() {
  const db = await getDb();
  const documentRows = await db
    .select({
      customerCode: sphDocuments.customerCode,
      customerName: sphDocuments.customerName,
      destination: sphDocuments.franco,
      sphId: sphDocuments.id,
      sphNo: sphDocuments.sphNo,
      status: sphDocuments.status,
    })
    .from(sphDocuments)
    .orderBy(desc(sphDocuments.createdAt), desc(sphDocuments.id));
  const eligibleDocuments = documentRows.filter((document) => isEligibleSph(document.status));
  const sphIds = eligibleDocuments.map((document) => document.sphId);
  const itemRows =
    sphIds.length > 0
      ? await db
          .select({
            itemId: sphItems.id,
            lineNo: sphItems.lineNo,
            partName: sphItems.partName,
            partNumber: sphItems.partNumber,
            quantity: sphItems.quantity,
            sphId: sphItems.sphId,
          })
          .from(sphItems)
          .where(inArray(sphItems.sphId, sphIds))
      : [];
  const itemIds = itemRows.map((item) => item.itemId);
  const journeyRows =
    itemIds.length > 0
      ? await db
          .select({
            quantity: shipmentJourneys.quantity,
            sphItemId: shipmentJourneys.sphItemId,
          })
          .from(shipmentJourneys)
          .where(inArray(shipmentJourneys.sphItemId, itemIds))
      : [];
  const documentById = new Map(eligibleDocuments.map((document) => [document.sphId, document]));
  const usedQtyByItem = new Map<string, number>();

  for (const journey of journeyRows) {
    usedQtyByItem.set(
      journey.sphItemId,
      (usedQtyByItem.get(journey.sphItemId) ?? 0) + journey.quantity
    );
  }

  return itemRows
    .map((item): AvailableItem | null => {
      const document = documentById.get(item.sphId);
      const remainingQty = item.quantity - (usedQtyByItem.get(item.itemId) ?? 0);

      if (!document || remainingQty <= 0) {
        return null;
      }

      return {
        customerCode: document.customerCode,
        customerName: document.customerName,
        destination: document.destination,
        itemId: item.itemId,
        lineNo: item.lineNo,
        partName: item.partName,
        partNumber: item.partNumber,
        remainingQty,
        sphId: item.sphId,
        sphNo: document.sphNo,
      };
    })
    .filter((item): item is AvailableItem => item !== null)
    .sort(
      (a, b) =>
        a.customerName.localeCompare(b.customerName) ||
        a.sphNo.localeCompare(b.sphNo) ||
        a.lineNo - b.lineNo
    );
}

export default async function CreatePengirimanPage() {
  const [availableItems, suppliers] = await Promise.all([
    getAvailableItems(),
    listSuppliers(),
  ]);

  return (
    <AppShell>
      <ConfirmForm
        action={createShipmentAction}
        className="shipment-detail-page"
        confirmMessage="Buat batch pengiriman dari item terpilih?"
      >
        <section className="form-section">
          <div className="section-heading">
            <div>
              <p className="page-kicker">Operasional Pengiriman</p>
              <h1>Tambah Pengiriman</h1>
              <p>
                Pilih item dari SPH yang belum masuk pengiriman. Satu submit membuat satu
                batch pengiriman fisik.
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
              <input name="shipmentDate" type="date" defaultValue={todayDate()} />
            </label>
            <label>
              <span>Vendor Pengiriman</span>
              <input name="shippingVendor" placeholder="Nama vendor / ekspedisi" />
            </label>
            <label>
              <span>Biaya Kirim</span>
              <input min="0" name="shippingCost" placeholder="0" type="number" />
            </label>
            <label className="full-width">
              <span>Asal</span>
              <input name="origin" placeholder="Gudang / lokasi supplier" />
            </label>
            <label className="full-width">
              <span>Tujuan</span>
              <input name="destination" placeholder="Lokasi tujuan pengiriman" />
            </label>
            <label>
              <span>Status</span>
              <input name="latestStatus" defaultValue="TERJADWAL" />
            </label>
            <label>
              <span>Catatan</span>
              <input name="notes" placeholder="Opsional" />
            </label>
          </div>
        </section>

        <CreateShipmentItemsTable
          availableItems={availableItems}
          suppliers={suppliers.map((supplier) => ({
            id: supplier.id,
            name: supplier.name,
          }))}
        />
      </ConfirmForm>
    </AppShell>
  );
}
