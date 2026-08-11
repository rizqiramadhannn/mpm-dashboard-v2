import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { listSuppliers } from "../../supplier/data";
import { getDb } from "../../../db";
import {
  shipmentJourneys,
  shipments,
  sphDocuments,
  sphItems,
} from "../../../db/schema";
import { recordActivityLog, requireUser } from "../../auth";
import { ShipmentJourneyForm } from "./ShipmentJourneyForm";

export const dynamic = "force-dynamic";

type JourneyRow = {
  id: string;
  shipmentId: string | null;
  sphItemId: string;
  splitNo: number;
  batchNo: number;
  quantity: number;
  supplyType: "stock" | "supplier";
  supplierId: string | null;
  origin: string;
  destination: string;
  latestStatus: string;
  shippingVendor: string;
  shippingCost: number;
  isShippingPaid: boolean;
  customerReceived: boolean;
};

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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

function parseInteger(value: FormDataEntryValue | null, key: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${key} harus berupa angka valid.`);
  }

  return parsed;
}

async function updateShipmentJourneyAction(formData: FormData) {
  "use server";

  const user = await requireUser("/pengiriman");
  const sphIdValue = formData.get("sphId");

  if (typeof sphIdValue !== "string" || sphIdValue.trim() === "") {
    throw new Error("SPH tidak valid.");
  }

  const sphId = sphIdValue.trim();
  const db = await getDb();
  const [document] = await db
    .select({ status: sphDocuments.status })
    .from(sphDocuments)
    .where(eq(sphDocuments.id, sphId))
    .limit(1);

  if (!document) {
    throw new Error("SPH tidak ditemukan.");
  }

  const itemRows = await db
    .select({
      id: sphItems.id,
      quantity: sphItems.quantity,
    })
    .from(sphItems)
    .where(eq(sphItems.sphId, sphId));

  if (itemRows.length === 0) {
    throw new Error("SPH belum memiliki item.");
  }

  const itemIds = itemRows.map((item) => item.id);
  const existingJourneys = await db
    .select({
      id: shipmentJourneys.id,
      shipmentId: shipmentJourneys.shipmentId,
    })
    .from(shipmentJourneys)
    .where(inArray(shipmentJourneys.sphItemId, itemIds));
  const shipmentIdByJourneyId = new Map(
    existingJourneys.map((journey) => [journey.id, journey.shipmentId])
  );
  const journeyValues: (typeof shipmentJourneys.$inferInsert)[] = [];

  for (const item of itemRows) {
    const splitKeys = formData
      .getAll(`splitKey-${item.id}`)
      .filter((value): value is string => typeof value === "string");
    const journeys = splitKeys.map((splitKey, index) => {
      const quantity = parseInteger(
        formData.get(`quantity-${item.id}-${splitKey}`),
        `Qty split ${index + 1}`
      );
      const supply = parseSupply(formText(formData, `supply-${item.id}-${splitKey}`));
      const customerReceived =
        formData.get(`customerReceived-${item.id}-${splitKey}`) === "on";

      return {
        shipmentId: shipmentIdByJourneyId.get(splitKey) ?? null,
        destination: formText(formData, `destination-${item.id}-${splitKey}`),
        isShippingPaid: formData.get(`isShippingPaid-${item.id}-${splitKey}`) === "on",
        customerReceived,
        customerReceivedAt: customerReceived ? new Date().toISOString() : null,
        latestStatus: customerReceived
          ? "TERKIRIM"
          : formText(formData, `latestStatus-${item.id}-${splitKey}`),
        batchNo: parseInteger(
          formData.get(`batchNo-${item.id}-${splitKey}`),
          `Batch split ${index + 1}`
        ),
        origin: formText(formData, `origin-${item.id}-${splitKey}`),
        quantity,
        shippingCost: parseInteger(
          formData.get(`shippingCost-${item.id}-${splitKey}`),
          `Biaya kirim split ${index + 1}`
        ),
        shippingVendor: formText(formData, `shippingVendor-${item.id}-${splitKey}`),
        sphItemId: item.id,
        splitNo: index + 1,
        supplierId: supply.supplierId,
        supplyType: supply.supplyType,
      };
    });
    const totalSplitQty = journeys.reduce((total, journey) => total + journey.quantity, 0);

    if (totalSplitQty > item.quantity) {
      throw new Error(`Total split item ${item.id} melebihi qty SPH.`);
    }

    journeyValues.push(...journeys);
  }

  const batchDetails = new Map<
    number,
    { isShippingPaid: boolean; shippingCost: number; shippingVendor: string }
  >();

  for (const journey of journeyValues) {
    const current = batchDetails.get(journey.batchNo ?? 1);

    batchDetails.set(journey.batchNo ?? 1, {
      isShippingPaid: Boolean(current?.isShippingPaid || journey.isShippingPaid),
      shippingCost: Math.max(current?.shippingCost ?? 0, journey.shippingCost ?? 0),
      shippingVendor: current?.shippingVendor || journey.shippingVendor || "",
    });
  }

  for (const journey of journeyValues) {
    const batch = batchDetails.get(journey.batchNo ?? 1);

    if (batch) {
      journey.isShippingPaid = batch.isShippingPaid;
      journey.shippingCost = batch.shippingCost;
      journey.shippingVendor = batch.shippingVendor;
    }
  }

  await db.delete(shipmentJourneys).where(inArray(shipmentJourneys.sphItemId, itemIds));

  if (journeyValues.length > 0) {
    await db.insert(shipmentJourneys).values(journeyValues);
  }

  for (const [batchNo, batch] of batchDetails) {
    const shipmentId = journeyValues.find(
      (journey) => (journey.batchNo ?? 1) === batchNo && journey.shipmentId
    )?.shipmentId;

    if (!shipmentId) {
      continue;
    }

    await db
      .update(shipments)
      .set({
        isShippingPaid: batch.shippingCost > 0 ? batch.isShippingPaid : false,
        shippingCost: batch.shippingCost,
        shippingVendor: batch.shippingVendor,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shipments.id, shipmentId));
  }

  const receivedQtyByItem = new Map<string, number>();
  let hasShipmentData = false;

  for (const journey of journeyValues) {
    if (journey.customerReceived) {
      receivedQtyByItem.set(
        journey.sphItemId,
        (receivedQtyByItem.get(journey.sphItemId) ?? 0) + (journey.quantity ?? 0)
      );
    }

    if (
      journey.customerReceived ||
      (journey.latestStatus ?? "").trim() ||
      (journey.origin ?? "").trim() ||
      (journey.shippingVendor ?? "").trim() ||
      (journey.shippingCost ?? 0) > 0 ||
      journey.isShippingPaid ||
      journey.supplyType === "supplier"
    ) {
      hasShipmentData = true;
    }
  }

  const isComplete = itemRows.every(
    (item) => (receivedQtyByItem.get(item.id) ?? 0) >= item.quantity
  );
  const currentStatus = document.status;

  if (!["cek_harga", "draft", "cancel", "cancelled"].includes(currentStatus)) {
    const nextStatus = isComplete
      ? "selesai"
      : hasShipmentData
        ? "proses_pengiriman"
        : "menunggu_pengiriman";

    await db
      .update(sphDocuments)
      .set({ status: nextStatus })
      .where(eq(sphDocuments.id, sphId));
  }

  await recordActivityLog({
    action: "shipment_journey_updated",
    actor: user,
    details: {
      journeyCount: journeyValues.length,
      sphId,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/invoice");
  revalidatePath("/pengiriman");
  revalidatePath(`/pengiriman/${sphId}`);
  revalidatePath("/sph/list");
}

export default async function PengirimanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id) {
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
    .where(eq(sphDocuments.id, id))
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
    .where(eq(sphItems.sphId, id));
  itemRows.sort((a, b) => a.lineNo - b.lineNo);

  const itemIds = itemRows.map((item) => item.id);
  const journeyRows: JourneyRow[] =
    itemIds.length > 0
      ? await db
          .select({
            id: shipmentJourneys.id,
            shipmentId: shipmentJourneys.shipmentId,
            sphItemId: shipmentJourneys.sphItemId,
            splitNo: shipmentJourneys.splitNo,
            batchNo: shipmentJourneys.batchNo,
            quantity: shipmentJourneys.quantity,
            supplyType: shipmentJourneys.supplyType,
            supplierId: shipmentJourneys.supplierId,
            origin: shipmentJourneys.origin,
            destination: shipmentJourneys.destination,
            latestStatus: shipmentJourneys.latestStatus,
            shippingVendor: shipmentJourneys.shippingVendor,
            shippingCost: shipmentJourneys.shippingCost,
            isShippingPaid: shipmentJourneys.isShippingPaid,
            customerReceived: shipmentJourneys.customerReceived,
          })
          .from(shipmentJourneys)
          .where(inArray(shipmentJourneys.sphItemId, itemIds))
      : [];
  const supplierOptions = await listSuppliers();
  const journeysByItem: Record<string, JourneyRow[]> = {};

  for (const journey of journeyRows) {
    journeysByItem[journey.sphItemId] = [
      ...(journeysByItem[journey.sphItemId] ?? []),
      journey,
    ];
  }

  return (
    <AppShell>
      <ShipmentJourneyForm
        action={updateShipmentJourneyAction}
        customerCode={document.customerCode}
        customerName={document.customerName}
        destinationFallback={document.franco}
        items={itemRows}
        journeysByItem={journeysByItem}
        sphId={document.id}
        sphNo={document.sphNo}
        suppliers={supplierOptions}
      />
    </AppShell>
  );
}
