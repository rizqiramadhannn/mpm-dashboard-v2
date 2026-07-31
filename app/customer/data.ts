import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "../../db";
import { customers } from "../../db/schema";

export const seededCustomers = [
  {
    code: "QLJ",
    name: "PT Quarry Logam Jaya",
    detailLine1: "Site Morowali",
    detailLine2: "Sulawesi Tengah",
    detailLine3: "Up Ibu Tesha",
    contactName: "Ibu Tesha",
  },
  {
    code: "RDP",
    name: "PT Rai Dili Pratama",
    detailLine1: "Site Kendari",
    detailLine2: "Sulawesi Tenggara",
    detailLine3: "Up Bapak Majid",
    contactName: "Bapak Majid",
  },
  {
    code: "AJB",
    name: "PT Albar Jaya Bersama",
    detailLine1: "Kendari",
    detailLine2: "Sulawesi Tenggara",
    detailLine3: "Up Ibu Rahba",
    contactName: "Ibu Rahba",
  },
  {
    code: "MPA",
    name: "PT Mutiara Perdana Abadi",
    detailLine1: "Site Toili Barat",
    detailLine2: "Sulawesi Tengah",
    detailLine3: "Up Ibu Ayu",
    contactName: "Ibu Ayu",
  },
  {
    code: "MIM",
    name: "PT Morowali Indo Makmur",
    detailLine1: "Site Morowali",
    detailLine2: "Sulawesi Tengah",
    detailLine3: "Up Ibu Linda",
    contactName: "Ibu Linda",
  },
];

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} wajib diisi.`);
  }

  return value.trim();
}

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function ensureSeedCustomers() {
  const db = await getDb();

  for (const customer of seededCustomers) {
    const [existing] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.code, customer.code))
      .limit(1);

    if (!existing) {
      await db.insert(customers).values(customer);
    }
  }
}

export async function listCustomers() {
  await ensureSeedCustomers();

  const db = await getDb();
  return db
    .select({
      id: customers.id,
      code: customers.code,
      name: customers.name,
      detailLine1: customers.detailLine1,
      detailLine2: customers.detailLine2,
      detailLine3: customers.detailLine3,
      contactName: customers.contactName,
    })
    .from(customers)
    .orderBy(asc(customers.name));
}

export async function createCustomerAction(formData: FormData) {
  "use server";

  const db = await getDb();
  const code = requiredString(formData, "code").toUpperCase();

  await db.insert(customers).values({
    code,
    name: requiredString(formData, "name"),
    detailLine1: requiredString(formData, "detailLine1"),
    detailLine2: requiredString(formData, "detailLine2"),
    detailLine3: optionalString(formData, "detailLine3"),
    contactName: optionalString(formData, "contactName"),
  });

  revalidatePath("/customer/customer-list");
  revalidatePath("/customer/add-new-customer");
  revalidatePath("/sph/create");
  redirect("/customer/customer-list");
}
