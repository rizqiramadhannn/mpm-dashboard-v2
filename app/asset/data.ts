import { asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getDb } from "../../db";
import { assets } from "../../db/schema";
import { recordActivityLog, requireUser } from "../auth";

const seededAssets = [
  {
    acquisitionDate: null,
    assetCode: "AST-0001",
    assetValue: 8000000,
    category: "Elektronik",
    condition: "Baik",
    currentOrLastPic: "Egha",
    itemName: "Laptop",
    location: "Luwuk",
    notes: "",
    status: "Aktif",
  },
  {
    acquisitionDate: null,
    assetCode: "AST-0002",
    assetValue: 0,
    category: "Elektronik",
    condition: "Baik",
    currentOrLastPic: "",
    itemName: "Printer",
    location: "Kolaka",
    notes: "",
    status: "Aktif",
  },
  {
    acquisitionDate: null,
    assetCode: "AST-0003",
    assetValue: 0,
    category: "Peralatan Kantor",
    condition: "Baik",
    currentOrLastPic: "",
    itemName: "Kipas Angin",
    location: "Kolaka",
    notes: "",
    status: "Aktif",
  },
];

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function requiredString(formData: FormData, key: string) {
  const value = asString(formData.get(key));

  if (!value) {
    throw new Error(`${key} wajib diisi.`);
  }

  return value;
}

function parseAmount(value: FormDataEntryValue | null) {
  const raw = asString(value).replace(/[^\d]/g, "");
  const amount = raw ? Number(raw) : 0;

  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("Nilai barang harus berupa angka valid.");
  }

  return amount;
}

function parseId(formData: FormData) {
  return requiredString(formData, "id");
}

function assetValuesFromForm(formData: FormData) {
  return {
    acquisitionDate: asString(formData.get("acquisitionDate")) || null,
    assetCode: requiredString(formData, "assetCode"),
    assetValue: parseAmount(formData.get("assetValue")),
    category: asString(formData.get("category")),
    condition: asString(formData.get("condition")) || "Baik",
    currentOrLastPic: asString(formData.get("currentOrLastPic")),
    itemName: requiredString(formData, "itemName"),
    location: requiredString(formData, "location"),
    notes: asString(formData.get("notes")),
    status: asString(formData.get("status")) || "Aktif",
  };
}

export async function ensureSeedAssets() {
  const db = await getDb();

  for (const asset of seededAssets) {
    const [existing] = await db
      .select({ id: assets.id })
      .from(assets)
      .where(eq(assets.assetCode, asset.assetCode))
      .limit(1);

    if (!existing) {
      await db.insert(assets).values(asset);
    }
  }
}

export async function listAssets(order: "asc" | "desc" = "asc") {
  await ensureSeedAssets();

  const db = await getDb();

  return db
    .select({
      acquisitionDate: assets.acquisitionDate,
      assetCode: assets.assetCode,
      assetValue: assets.assetValue,
      category: assets.category,
      condition: assets.condition,
      createdAt: assets.createdAt,
      currentOrLastPic: assets.currentOrLastPic,
      id: assets.id,
      itemName: assets.itemName,
      location: assets.location,
      notes: assets.notes,
      status: assets.status,
    })
    .from(assets)
    .orderBy(
      order === "asc" ? asc(assets.itemName) : desc(assets.itemName),
      order === "asc" ? asc(assets.createdAt) : desc(assets.createdAt)
    );
}

export async function getAsset(id: string) {
  await ensureSeedAssets();

  const db = await getDb();
  const [asset] = await db
    .select({
      acquisitionDate: assets.acquisitionDate,
      assetCode: assets.assetCode,
      assetValue: assets.assetValue,
      category: assets.category,
      condition: assets.condition,
      currentOrLastPic: assets.currentOrLastPic,
      id: assets.id,
      itemName: assets.itemName,
      location: assets.location,
      notes: assets.notes,
      status: assets.status,
    })
    .from(assets)
    .where(eq(assets.id, id))
    .limit(1);

  if (!asset) {
    notFound();
  }

  return asset;
}

export async function createAssetAction(formData: FormData) {
  "use server";

  const user = await requireUser("/asset/add-new-asset");
  const db = await getDb();
  const values = assetValuesFromForm(formData);

  const [inserted] = await db
    .insert(assets)
    .values(values)
    .returning({ id: assets.id });
  await recordActivityLog({
    action: "asset_created",
    actor: user,
    details: {
      assetCode: values.assetCode,
      assetId: inserted.id,
      itemName: values.itemName,
    },
    targetUsername: values.currentOrLastPic,
  });

  revalidatePath("/asset");
  revalidatePath("/asset/add-new-asset");
  revalidatePath("/asset/asset-list");
  redirect("/asset/asset-list");
}

export async function updateAssetAction(formData: FormData) {
  "use server";

  const user = await requireUser("/asset/asset-list");
  const db = await getDb();
  const assetId = parseId(formData);
  const values = assetValuesFromForm(formData);

  await db
    .update(assets)
    .set({
      ...values,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(assets.id, assetId));
  await recordActivityLog({
    action: "asset_updated",
    actor: user,
    details: { assetCode: values.assetCode, assetId, itemName: values.itemName },
    targetUsername: values.currentOrLastPic,
  });

  revalidatePath("/asset");
  revalidatePath("/asset/asset-list");
  redirect("/asset/asset-list");
}

export async function updateAssetTrackingAction(formData: FormData) {
  "use server";

  const user = await requireUser("/asset/asset-list");
  const id = requiredString(formData, "id");
  const db = await getDb();
  const nextValues = {
    condition: asString(formData.get("condition")) || "Baik",
    currentOrLastPic: requiredString(formData, "currentOrLastPic"),
    location: requiredString(formData, "location"),
    notes: asString(formData.get("notes")),
    status: asString(formData.get("status")) || "Aktif",
  };

  await db
    .update(assets)
    .set({
      ...nextValues,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(assets.id, id));
  await recordActivityLog({
    action: "asset_tracking_updated",
    actor: user,
    details: { assetId: id, location: nextValues.location, status: nextValues.status },
    targetUsername: nextValues.currentOrLastPic,
  });

  revalidatePath("/asset");
}
