import { asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "../../db";
import { paymentRequests } from "../../db/schema";

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
    throw new Error("Nominal harus berupa angka valid.");
  }

  return amount;
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(new Date());
}

export async function listPaymentRequests(order: "asc" | "desc" = "desc") {
  const db = await getDb();

  return db
    .select({
      amount: paymentRequests.amount,
      createdAt: paymentRequests.createdAt,
      description: paymentRequests.description,
      destinationAccount: paymentRequests.destinationAccount,
      id: paymentRequests.id,
      requestDate: paymentRequests.requestDate,
      sourceFund: paymentRequests.sourceFund,
      status: paymentRequests.status,
      transactionPurpose: paymentRequests.transactionPurpose,
    })
    .from(paymentRequests)
    .orderBy(
      order === "asc"
        ? asc(paymentRequests.requestDate)
        : desc(paymentRequests.requestDate),
      order === "asc" ? asc(paymentRequests.createdAt) : desc(paymentRequests.createdAt)
    );
}

export async function createPaymentRequestAction(formData: FormData) {
  "use server";

  const db = await getDb();

  await db.insert(paymentRequests).values({
    amount: parseAmount(formData.get("amount")),
    description: requiredString(formData, "description"),
    destinationAccount: requiredString(formData, "destinationAccount"),
    requestDate: asString(formData.get("requestDate")) || todayKey(),
    sourceFund: requiredString(formData, "sourceFund"),
    status: asString(formData.get("status")),
    transactionPurpose: requiredString(formData, "transactionPurpose"),
  });

  revalidatePath("/payment-request");
}

export async function updatePaymentRequestStatusAction(formData: FormData) {
  "use server";

  const id = requiredString(formData, "id");
  const db = await getDb();

  await db
    .update(paymentRequests)
    .set({
      status: asString(formData.get("status")),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(paymentRequests.id, id));

  revalidatePath("/payment-request");
}
