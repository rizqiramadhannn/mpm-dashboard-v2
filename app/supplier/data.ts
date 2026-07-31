import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getDb } from "../../db";
import { suppliers } from "../../db/schema";

const seededSuppliers = [
  {
    name: "GIBRIL",
    normalizedName: "GIBRIL",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    defaultPaymentTerm: "",
  },
  {
    name: "ALI IMRAN",
    normalizedName: "ALI IMRAN",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    defaultPaymentTerm: "",
  },
  {
    name: "PT SANY HEAVY INDUSTRY INDONESIA",
    normalizedName: "SANY HEAVY INDUSTRY INDONESIA",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    defaultPaymentTerm: "COD",
  },
  {
    name: "PT ABADI JAYA MACHINERY",
    normalizedName: "ABADI JAYA MACHINERY",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    defaultPaymentTerm: "",
  },
  {
    name: "PT SHACMAN PART SOLUTION",
    normalizedName: "SHACMAN PART SOLUTION",
    contactPerson: "",
    phone: "",
    accountType: "",
    accountNumber: "",
    accountName: "",
    defaultPaymentTerm: "COD",
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
  const id = Number(formData.get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Supplier tidak valid.");
  }

  return id;
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
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.normalizedName, supplier.normalizedName))
      .limit(1);

    if (!existing) {
      await db.insert(suppliers).values(supplier);
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
      contactPerson: suppliers.contactPerson,
      phone: suppliers.phone,
      accountType: suppliers.accountType,
      accountNumber: suppliers.accountNumber,
      accountName: suppliers.accountName,
      defaultPaymentTerm: suppliers.defaultPaymentTerm,
    })
    .from(suppliers)
    .orderBy(asc(suppliers.name));
}

export async function getSupplier(id: number) {
  await ensureSeedSuppliers();

  const db = await getDb();
  const [supplier] = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      contactPerson: suppliers.contactPerson,
      phone: suppliers.phone,
      accountType: suppliers.accountType,
      accountNumber: suppliers.accountNumber,
      accountName: suppliers.accountName,
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

  const db = await getDb();
  await db.insert(suppliers).values(supplierValuesFromForm(formData));

  revalidatePath("/supplier/add-new-supplier");
  revalidatePath("/supplier/supplier-list");
  redirect("/supplier/supplier-list");
}

export async function updateSupplierAction(formData: FormData) {
  "use server";

  const db = await getDb();
  await db
    .update(suppliers)
    .set(supplierValuesFromForm(formData))
    .where(eq(suppliers.id, parseId(formData)));

  revalidatePath("/supplier/supplier-list");
  redirect("/supplier/supplier-list");
}

export async function deleteSupplierAction(formData: FormData) {
  "use server";

  const db = await getDb();
  await db.delete(suppliers).where(eq(suppliers.id, parseId(formData)));

  revalidatePath("/supplier/supplier-list");
}
