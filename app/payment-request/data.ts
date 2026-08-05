import { asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "../../db";
import { paymentRequests } from "../../db/schema";
import { recordActivityLog, requireSuperadmin, requireUser } from "../auth";

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
      requestedByUsername: paymentRequests.requestedByUsername,
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

  const user = await requireUser("/payment-request");
  const db = await getDb();

  const [inserted] = await db.insert(paymentRequests).values({
    amount: parseAmount(formData.get("amount")),
    description: requiredString(formData, "description"),
    destinationAccount: requiredString(formData, "destinationAccount"),
    requestDate: asString(formData.get("requestDate")) || todayKey(),
    requestedByUserId: user.id,
    requestedByUsername: user.username,
    sourceFund: requiredString(formData, "sourceFund"),
    status: asString(formData.get("status")),
    transactionPurpose: requiredString(formData, "transactionPurpose"),
  }).returning({ id: paymentRequests.id });

  await recordActivityLog({
    action: "payment_request_created",
    actor: user,
    details: {
      amount: parseAmount(formData.get("amount")),
      description: requiredString(formData, "description"),
      paymentRequestId: inserted.id,
      sourceFund: requiredString(formData, "sourceFund"),
    },
    targetUsername: user.username,
    targetUserId: user.id,
  });

  revalidatePath("/payment-request");
}

export async function updatePaymentRequestAction(formData: FormData) {
  "use server";

  const user = await requireUser("/payment-request");
  const id = requiredString(formData, "id");
  const db = await getDb();

  await db
    .update(paymentRequests)
    .set({
      amount: parseAmount(formData.get("amount")),
      description: requiredString(formData, "description"),
      destinationAccount: requiredString(formData, "destinationAccount"),
      requestDate: requiredString(formData, "requestDate"),
      sourceFund: requiredString(formData, "sourceFund"),
      status: asString(formData.get("status")),
      transactionPurpose: requiredString(formData, "transactionPurpose"),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(paymentRequests.id, id));

  await recordActivityLog({
    action: "payment_request_updated",
    actor: user,
    details: {
      amount: parseAmount(formData.get("amount")),
      description: requiredString(formData, "description"),
      paymentRequestId: id,
      sourceFund: requiredString(formData, "sourceFund"),
    },
    targetUserId: user.id,
    targetUsername: user.username,
  });

  revalidatePath("/payment-request");
}

export async function deletePaymentRequestAction(formData: FormData) {
  "use server";

  const user = await requireSuperadmin();
  const id = requiredString(formData, "id");
  const db = await getDb();
  const existing = await db.query.paymentRequests.findFirst({
    where: eq(paymentRequests.id, id),
  });

  if (!existing) {
    revalidatePath("/payment-request");
    return;
  }

  await db.delete(paymentRequests).where(eq(paymentRequests.id, id));
  await recordActivityLog({
    action: "payment_request_deleted",
    actor: user,
    details: {
      amount: existing.amount,
      description: existing.description,
      requestDate: existing.requestDate,
      requestedByUsername: existing.requestedByUsername,
      sourceFund: existing.sourceFund,
    },
    targetUsername: existing.requestedByUsername,
  });

  revalidatePath("/payment-request");
}
