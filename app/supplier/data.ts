import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getDb } from "../../db";
import { suppliers } from "../../db/schema";
import { recordActivityLog, requireUser } from "../auth";

const seededSuppliers = [
  {
    name: "GIBRIL",
    normalizedName: "GIBRIL",
    supplierType: "Supplier Sparepart",
    suppliedItems: "DT SHACMAN",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "",
    defaultPaymentTerm: "",
  },
  {
    name: "ALI IMRAN",
    normalizedName: "ALI IMRAN",
    supplierType: "Supplier Sparepart",
    suppliedItems: "DT SHACMAN",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "Sulawesi Tengah, Bahodopi",
    defaultPaymentTerm: "",
  },
  {
    name: "PT SANY HEAVY INDUSTRY INDONESIA",
    normalizedName: "SANY HEAVY INDUSTRY INDONESIA",
    supplierType: "Supplier Sparepart",
    suppliedItems: "DT SANY",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "Sulawesi Tengah, Topogaro",
    defaultPaymentTerm: "COD",
  },
  {
    name: "PT ABADI JAYA MACHINERY",
    normalizedName: "ABADI JAYA MACHINERY",
    supplierType: "Supplier Sparepart",
    suppliedItems: "DT HOWO & SHACMAN",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "",
    defaultPaymentTerm: "",
  },
  {
    name: "PT SHACMAN PART SOLUTION",
    normalizedName: "SHACMAN PART SOLUTION",
    supplierType: "Supplier Sparepart",
    suppliedItems: "",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "Sulawesi Tenggara, Kendari",
    defaultPaymentTerm: "COD",
  },
  {
    name: "PT PART MART INDONESIA",
    normalizedName: "PART MART INDONESIA",
    supplierType: "Supplier Sparepart",
    suppliedItems: "",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "Sulawesi Tenggara, Pomalaa",
    defaultPaymentTerm: "TOP 30 HARI",
  },
  {
    name: "MARSEL",
    normalizedName: "MARSEL",
    supplierType: "Supplier Sparepart",
    suppliedItems: "",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "Sulawesi Tenggara, Kendari",
    defaultPaymentTerm: "",
  },
  {
    name: "PT GAYA MAKMUR MOBIL",
    normalizedName: "GAYA MAKMUR MOBIL",
    supplierType: "Supplier Sparepart",
    suppliedItems: "DT HANVAN",
    contactPerson: "Bpk Wawan / sufyan",
    phone: "081190092211",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "Sulawesi Selatan, Makassar / Jakarta",
    defaultPaymentTerm: "CBD",
  },
  {
    name: "CV BBR INDONESIA",
    normalizedName: "BBR INDONESIA",
    supplierType: "Supplier Sparepart",
    suppliedItems: "",
    contactPerson: "Harry Krfisrtian",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "Sulawesi Selatan, Makassar",
    defaultPaymentTerm: "TOP 30 HARI",
  },
  {
    name: "PT SYLI TRADING INDONESIA",
    normalizedName: "SYLI TRADING INDONESIA",
    supplierType: "Supplier Sparepart",
    suppliedItems: "",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "Jakarta",
    defaultPaymentTerm: "COD",
  },
  {
    name: "HARFANDY",
    normalizedName: "HARFANDY",
    supplierType: "Supplier Sparepart",
    suppliedItems: "",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "",
    defaultPaymentTerm: "",
  },
  {
    name: "CV MJD AUTO PART",
    normalizedName: "MJD AUTO PART",
    supplierType: "Supplier Sparepart",
    suppliedItems: "",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "",
    defaultPaymentTerm: "",
  },
  {
    name: "IRWAN",
    normalizedName: "IRWAN",
    supplierType: "Supplier Sparepart",
    suppliedItems: "",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "",
    defaultPaymentTerm: "",
  },
  {
    name: "PT. HARTA BAN INDONESIA",
    normalizedName: "HARTA BAN INDONESIA",
    supplierType: "Supplier Tyre",
    suppliedItems: "TYRE",
    contactPerson: "Bpk Handy",
    phone: "081230771085",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "Sulawesi Tenggara, Kendari (Puuwatu)",
    defaultPaymentTerm: "COD",
  },
  {
    name: "PT. XCMG INDONESIA",
    normalizedName: "XCMG INDONESIA",
    supplierType: "Supplier Sparepart",
    suppliedItems: "DT HANVAN",
    contactPerson: "Bpk Ahmad",
    phone: "082349388798",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "Sulawesi Tenggara, Kendari (OSS)",
    defaultPaymentTerm: "COD",
  },
  {
    name: "PT. LANDSO BUMI JAYA",
    normalizedName: "LANDSO BUMI JAYA",
    supplierType: "Supplier Tools",
    suppliedItems: "TOOLS & MATERIAL",
    contactPerson: "Bpk Franka",
    phone: "081999183542",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "Jakarta",
    defaultPaymentTerm: "COD",
  },
  {
    name: "PT BERJAYA GEMILANG TEKNIK",
    normalizedName: "BERJAYA GEMILANG TEKNIK",
    supplierType: "",
    suppliedItems: "",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "",
    defaultPaymentTerm: "",
  },
  {
    name: "PT GRAHA OTO PARTS",
    normalizedName: "GRAHA OTO PARTS",
    supplierType: "",
    suppliedItems: "",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "",
    defaultPaymentTerm: "",
  },
  {
    name: "PT SINAR TERANG CIPTA SARANA",
    normalizedName: "SINAR TERANG CIPTA SARANA",
    supplierType: "",
    suppliedItems: "",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "",
    defaultPaymentTerm: "",
  },
  {
    name: "PT CIPTA NAWASENA BERSAMA",
    normalizedName: "CIPTA NAWASENA BERSAMA",
    supplierType: "",
    suppliedItems: "",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "",
    defaultPaymentTerm: "",
  },
  {
    name: "PT BENUATECH MITRA BERSAMA",
    normalizedName: "BENUATECH MITRA BERSAMA",
    supplierType: "",
    suppliedItems: "",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    address: "",
    defaultPaymentTerm: "",
  },
];

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} wajib diisi.`);
  }

  return value.trim();
}

function parseId(formData: FormData) {
  const id = formData.get("id");

  if (typeof id !== "string" || id.trim() === "") {
    throw new Error("Supplier tidak valid.");
  }

  return id.trim();
}

function normalizeSupplierName(name: string) {
  return name
    .toUpperCase()
    .replace(/\b(PT|CV|UD|TBK|PERSERO)\b/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function supplierValuesFromForm(formData: FormData) {
  const name = requiredString(formData, "name");

  return {
    name,
    normalizedName: normalizeSupplierName(name),
    contactPerson: requiredString(formData, "contactPerson"),
    phone: requiredString(formData, "phone"),
    accountType: requiredString(formData, "accountType"),
    accountNumber: requiredString(formData, "accountNumber"),
    accountName: requiredString(formData, "accountName"),
    defaultPaymentTerm: requiredString(formData, "defaultPaymentTerm"),
  };
}

export async function ensureSeedSuppliers() {
  const db = await getDb();

  for (const supplier of seededSuppliers) {
    const [existing] = await db
      .select({
        id: suppliers.id,
        supplierType: suppliers.supplierType,
        suppliedItems: suppliers.suppliedItems,
        contactPerson: suppliers.contactPerson,
        phone: suppliers.phone,
        address: suppliers.address,
        defaultPaymentTerm: suppliers.defaultPaymentTerm,
      })
      .from(suppliers)
      .where(eq(suppliers.normalizedName, supplier.normalizedName))
      .limit(1);

    if (!existing) {
      await db.insert(suppliers).values(supplier);
    } else {
      await db
        .update(suppliers)
        .set({
          supplierType: existing.supplierType || supplier.supplierType,
          suppliedItems: existing.suppliedItems || supplier.suppliedItems,
          contactPerson: existing.contactPerson || supplier.contactPerson,
          phone: existing.phone || supplier.phone,
          address: existing.address || supplier.address,
          defaultPaymentTerm:
            existing.defaultPaymentTerm || supplier.defaultPaymentTerm,
        })
        .where(eq(suppliers.id, existing.id));
    }
  }
}

export async function listSuppliers() {
  await ensureSeedSuppliers();

  const db = await getDb();
  return db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      supplierType: suppliers.supplierType,
      suppliedItems: suppliers.suppliedItems,
      contactPerson: suppliers.contactPerson,
      phone: suppliers.phone,
      accountType: suppliers.accountType,
      accountNumber: suppliers.accountNumber,
      accountName: suppliers.accountName,
      address: suppliers.address,
      defaultPaymentTerm: suppliers.defaultPaymentTerm,
    })
    .from(suppliers)
    .orderBy(asc(suppliers.name));
}

export async function getSupplier(id: string) {
  await ensureSeedSuppliers();

  const db = await getDb();
  const [supplier] = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      supplierType: suppliers.supplierType,
      suppliedItems: suppliers.suppliedItems,
      contactPerson: suppliers.contactPerson,
      phone: suppliers.phone,
      accountType: suppliers.accountType,
      accountNumber: suppliers.accountNumber,
      accountName: suppliers.accountName,
      address: suppliers.address,
      defaultPaymentTerm: suppliers.defaultPaymentTerm,
    })
    .from(suppliers)
    .where(eq(suppliers.id, id))
    .limit(1);

  if (!supplier) {
    notFound();
  }

  return supplier;
}

export async function createSupplierAction(formData: FormData) {
  "use server";

  const user = await requireUser("/supplier/add-new-supplier");
  const db = await getDb();
  const values = supplierValuesFromForm(formData);
  const [inserted] = await db
    .insert(suppliers)
    .values(values)
    .returning({ id: suppliers.id });
  await recordActivityLog({
    action: "supplier_created",
    actor: user,
    details: { name: values.name, supplierId: inserted.id },
    targetUsername: values.name,
  });

  revalidatePath("/supplier/add-new-supplier");
  revalidatePath("/supplier/supplier-list");
  redirect("/supplier/supplier-list");
}

export async function updateSupplierAction(formData: FormData) {
  "use server";

  const user = await requireUser("/supplier/supplier-list");
  const db = await getDb();
  const supplierId = parseId(formData);
  const values = supplierValuesFromForm(formData);
  await db
    .update(suppliers)
    .set(values)
    .where(eq(suppliers.id, supplierId));
  await recordActivityLog({
    action: "supplier_updated",
    actor: user,
    details: { name: values.name, supplierId },
    targetUsername: values.name,
  });

  revalidatePath("/supplier/supplier-list");
  redirect("/supplier/supplier-list");
}

export async function deleteSupplierAction(formData: FormData) {
  "use server";

  const user = await requireUser("/supplier/supplier-list");
  const db = await getDb();
  const supplierId = parseId(formData);
  const [existing] = await db
    .select({ name: suppliers.name })
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1);
  await db.delete(suppliers).where(eq(suppliers.id, supplierId));
  await recordActivityLog({
    action: "supplier_deleted",
    actor: user,
    details: { name: existing?.name ?? "", supplierId },
    targetUsername: existing?.name ?? "",
  });

  revalidatePath("/supplier/supplier-list");
}
