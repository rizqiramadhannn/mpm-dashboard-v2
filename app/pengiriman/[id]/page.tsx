import { eq, inArray } from "drizzle-orm";
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
import { ShipmentJourneyForm } from "./ShipmentJourneyForm";

export const dynamic = "force-dynamic";

type JourneyRow = {
  id: string;
  sphItemId: string;
  splitNo: number;
  quantity: number;
  supplyType: "stock" | "supplier";
  supplierId: string | null;
  origin: string;
  destination: string;
  latestStatus: string;
  shippingVendor: string;
  shippingCost: number;
  isShippingPaid: boolean;
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

  const sphIdValue = formData.get("sphId");

  if (typeof sphIdValue !== "string" || sphIdValue.trim() === "") {
    throw new Error("SPH tidak valid.");
  }

  const sphId = sphIdValue.trim();
  const db = await getDb();
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

      return {
        destination: formText(formData, `destination-${item.id}-${splitKey}`),
        isShippingPaid: formData.get(`isShippingPaid-${item.id}-${splitKey}`) === "on",
        latestStatus: formText(formData, `latestStatus-${item.id}-${splitKey}`),
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

  await db.delete(shipmentJourneys).where(inArray(shipmentJourneys.sphItemId, itemIds));

  if (journeyValues.length > 0) {
    await db.insert(shipmentJourneys).values(journeyValues);
  }

  revalidatePath("/pengiriman");
  revalidatePath(`/pengiriman/${sphId}`);
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
            sphItemId: shipmentJourneys.sphItemId,
            splitNo: shipmentJourneys.splitNo,
            quantity: shipmentJourneys.quantity,
            supplyType: shipmentJourneys.supplyType,
            supplierId: shipmentJourneys.supplierId,
            origin: shipmentJourneys.origin,
            destination: shipmentJourneys.destination,
            latestStatus: shipmentJourneys.latestStatus,
            shippingVendor: shipmentJourneys.shippingVendor,
            shippingCost: shipmentJourneys.shippingCost,
            isShippingPaid: shipmentJourneys.isShippingPaid,
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
