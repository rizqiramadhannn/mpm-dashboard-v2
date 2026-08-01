import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { listCustomers } from "../../../customer/data";
import { getDb } from "../../../../db";
import {
  customers,
  invoiceDocuments,
  invoiceItems,
  sphDocuments,
  sphItems,
} from "../../../../db/schema";
import { CreateSphForm } from "../../create/CreateSphForm";

export const dynamic = "force-dynamic";

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

function parseInteger(value: FormDataEntryValue | null, key: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${key} harus berupa angka valid.`);
  }

  return parsed;
}

function requiredId(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} tidak valid.`);
  }

  return value.trim();
}

function customerInitials(customerCode: string, customerName: string) {
  const normalizedCode = customerCode.replace(/[^a-z0-9]/gi, "").toUpperCase();

  if (normalizedCode.length >= 3) {
    return normalizedCode.slice(0, 3);
  }

  const words = customerName
    .replace(/\b(pt|cv|tbk)\b/gi, "")
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean);

  return (words.map((word) => word[0]).join("") || normalizedCode || "CUS")
    .toUpperCase()
    .padEnd(3, "X")
    .slice(0, 3);
}

function toIndonesianWords(value: number): string {
  const units = [
    "",
    "satu",
    "dua",
    "tiga",
    "empat",
    "lima",
    "enam",
    "tujuh",
    "delapan",
    "sembilan",
    "sepuluh",
    "sebelas",
  ];

  if (value < 12) {
    return units[value];
  }

  if (value < 20) {
    return `${toIndonesianWords(value - 10)} belas`;
  }

  if (value < 100) {
    return `${toIndonesianWords(Math.floor(value / 10))} puluh ${toIndonesianWords(
      value % 10
    )}`.trim();
  }

  if (value < 200) {
    return `seratus ${toIndonesianWords(value - 100)}`.trim();
  }

  if (value < 1_000) {
    return `${toIndonesianWords(Math.floor(value / 100))} ratus ${toIndonesianWords(
      value % 100
    )}`.trim();
  }

  if (value < 2_000) {
    return `seribu ${toIndonesianWords(value - 1_000)}`.trim();
  }

  if (value < 1_000_000) {
    return `${toIndonesianWords(Math.floor(value / 1_000))} ribu ${toIndonesianWords(
      value % 1_000
    )}`.trim();
  }

  if (value < 1_000_000_000) {
    return `${toIndonesianWords(Math.floor(value / 1_000_000))} juta ${toIndonesianWords(
      value % 1_000_000
    )}`.trim();
  }

  return `${toIndonesianWords(Math.floor(value / 1_000_000_000))} miliar ${toIndonesianWords(
    value % 1_000_000_000
  )}`.trim();
}

function toRupiahWords(value: number) {
  if (value === 0) {
    return "Nol rupiah";
  }

  const words = `${toIndonesianWords(value)} rupiah`.replace(/\s+/g, " ").trim();
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function paymentDueDateFromTerm(sphDate: string, paymentTerm: string) {
  const topMatch = paymentTerm.match(/TOP\s*(\d+)/i);

  if (topMatch) {
    return addDays(sphDate, Number(topMatch[1]));
  }

  return sphDate;
}

function invoiceNoFromSph(sphNo: string) {
  return sphNo.startsWith("SPH") ? `INV${sphNo.slice(3)}` : `INV-${sphNo}`;
}

async function updateSphAction(formData: FormData) {
  "use server";

  const sphId = requiredId(formData, "sphId");
  const customerId = requiredId(formData, "customerId");
  const sphDate = requiredString(formData, "sphDate");
  const paymentTerm = requiredString(formData, "paymentTerm");
  const franco = requiredString(formData, "franco");
  const deliveryDate = optionalString(formData, "deliveryDate") || null;
  const etaDate = optionalString(formData, "etaDate") || null;
  const additionalInfo = optionalString(formData, "additionalInfo");

  const db = await getDb();
  const [existingSph] = await db
    .select({
      id: sphDocuments.id,
      sphNo: sphDocuments.sphNo,
      status: sphDocuments.status,
    })
    .from(sphDocuments)
    .where(eq(sphDocuments.id, sphId))
    .limit(1);

  if (!existingSph) {
    throw new Error("SPH tidak ditemukan.");
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);

  if (!customer) {
    throw new Error("Customer tidak ditemukan.");
  }

  const partNumbers = formData.getAll("partNumber");
  const partNames = formData.getAll("partName");
  const quantities = formData.getAll("quantity");
  const unitPrices = formData.getAll("unitPrice");

  const items = partNames.map((partNameValue, index) => {
    const partName = typeof partNameValue === "string" ? partNameValue.trim() : "";
    const partNumberValue = partNumbers[index];
    const partNumber =
      typeof partNumberValue === "string" ? partNumberValue.trim() : "";
    const quantity = parseInteger(quantities[index] ?? null, `Qty item ${index + 1}`);
    const unitPrice = parseInteger(
      unitPrices[index] ?? null,
      `Harga item ${index + 1}`
    );

    if (!partName || quantity <= 0) {
      throw new Error(`Item ${index + 1} belum lengkap.`);
    }

    return {
      lineNo: index + 1,
      partName,
      partNumber,
      quantity,
      totalPrice: quantity * unitPrice,
      unitPrice,
    };
  });

  if (items.length === 0) {
    throw new Error("Minimal satu item wajib diisi.");
  }

  const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const paymentDueDate = paymentDueDateFromTerm(sphDate, paymentTerm);

  await db
    .update(sphDocuments)
    .set({
      additionalInfo,
      amountInWords: toRupiahWords(totalAmount),
      customerDetailLine1: customer.detailLine1,
      customerDetailLine2: customer.detailLine2,
      customerDetailLine3: customer.detailLine3,
      customerCode: customerInitials(customer.code, customer.name),
      customerId: customer.id,
      customerName: customer.name,
      deliveryDate,
      etaDate,
      franco,
      paymentDueDate,
      paymentTerm,
      sphDate,
      totalAmount,
    })
    .where(eq(sphDocuments.id, sphId));

  await db.delete(sphItems).where(eq(sphItems.sphId, sphId));
  const insertedItems = await db
    .insert(sphItems)
    .values(
      items.map((item) => ({
        lineNo: item.lineNo,
        partName: item.partName,
        partNumber: item.partNumber,
        quantity: item.quantity,
        sphId,
        totalPrice: item.totalPrice,
        unitPrice: item.unitPrice,
      }))
    )
    .returning({
      id: sphItems.id,
      lineNo: sphItems.lineNo,
    });
  const sphItemIdByLine = new Map(insertedItems.map((item) => [item.lineNo, item.id]));

  const invoiceNo = invoiceNoFromSph(existingSph.sphNo);
  let [existingInvoice] = await db
    .select({
      id: invoiceDocuments.id,
      invoiceNo: invoiceDocuments.invoiceNo,
    })
    .from(invoiceDocuments)
    .where(eq(invoiceDocuments.sphId, sphId))
    .limit(1);

  if (!existingInvoice) {
    [existingInvoice] = await db
      .select({
        id: invoiceDocuments.id,
        invoiceNo: invoiceDocuments.invoiceNo,
      })
      .from(invoiceDocuments)
      .where(eq(invoiceDocuments.invoiceNo, invoiceNo))
      .limit(1);
  }

  if (existingInvoice) {
    await db
      .update(invoiceDocuments)
      .set({
        amountInWords: toRupiahWords(totalAmount),
        customerDetailLine1: customer.detailLine1,
        customerDetailLine2: customer.detailLine2,
        customerDetailLine3: customer.detailLine3,
        customerName: customer.name,
        franco,
        invoiceDate: sphDate,
        invoiceNo,
        paymentDueDate,
        paymentTerm,
        sphId,
        totalAmount,
      })
      .where(eq(invoiceDocuments.id, existingInvoice.id));

    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, existingInvoice.id));
    await db.insert(invoiceItems).values(
      items.map((item) => ({
        invoiceId: existingInvoice.id,
        lineNo: item.lineNo,
        partName: item.partName,
        partNumber: item.partNumber,
        quantity: item.quantity,
        sphItemId: sphItemIdByLine.get(item.lineNo) ?? null,
        totalPrice: item.totalPrice,
        unitPrice: item.unitPrice,
      }))
    );
  } else if (!["cek_harga", "draft", "cancel", "cancelled"].includes(existingSph.status)) {
    const insertedInvoice = await db
      .insert(invoiceDocuments)
      .values({
        amountInWords: toRupiahWords(totalAmount),
        customerDetailLine1: customer.detailLine1,
        customerDetailLine2: customer.detailLine2,
        customerDetailLine3: customer.detailLine3,
        customerName: customer.name,
        franco,
        invoiceDate: sphDate,
        invoiceNo,
        paymentDueDate,
        paymentTerm,
        sphId,
        status: "pending",
        totalAmount,
      })
      .returning({ id: invoiceDocuments.id });

    await db.insert(invoiceItems).values(
      items.map((item) => ({
        invoiceId: insertedInvoice[0].id,
        lineNo: item.lineNo,
        partName: item.partName,
        partNumber: item.partNumber,
        quantity: item.quantity,
        sphItemId: sphItemIdByLine.get(item.lineNo) ?? null,
        totalPrice: item.totalPrice,
        unitPrice: item.unitPrice,
      }))
    );
  }

  revalidatePath("/invoice");
  revalidatePath("/sph/list");
  revalidatePath(`/sph/edit/${sphId}`);
  redirect("/sph/list");
}

export default async function EditSphPage({
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
      additionalInfo: sphDocuments.additionalInfo,
      customerId: sphDocuments.customerId,
      deliveryDate: sphDocuments.deliveryDate,
      etaDate: sphDocuments.etaDate,
      franco: sphDocuments.franco,
      paymentTerm: sphDocuments.paymentTerm,
      sphDate: sphDocuments.sphDate,
      sphNo: sphDocuments.sphNo,
    })
    .from(sphDocuments)
    .where(eq(sphDocuments.id, id))
    .limit(1);

  if (!document) {
    notFound();
  }

  let customerOptions: Awaited<ReturnType<typeof listCustomers>> = [];
  let databaseError: string | null = null;

  try {
    customerOptions = await listCustomers();
  } catch (error) {
    databaseError = error instanceof Error ? error.message : "Database unavailable.";
  }

  const itemRows = await db
    .select({
      id: sphItems.id,
      lineNo: sphItems.lineNo,
      partName: sphItems.partName,
      partNumber: sphItems.partNumber,
      quantity: sphItems.quantity,
      unitPrice: sphItems.unitPrice,
    })
    .from(sphItems)
    .where(eq(sphItems.sphId, id));

  itemRows.sort((a, b) => a.lineNo - b.lineNo);

  return (
    <AppShell>
      {databaseError ? (
        <section className="form-section">
          <p className="page-kicker">Surat Penawaran Harga</p>
          <h1>Edit SPH</h1>
          <div className="empty-state">{databaseError}</div>
        </section>
      ) : (
        <CreateSphForm
          action={updateSphAction}
          customers={customerOptions}
          initialValues={{
            additionalInfo: document.additionalInfo,
            customerId: document.customerId,
            deliveryDate: document.deliveryDate ?? "",
            etaDate: document.etaDate ?? "",
            franco: document.franco,
            items: itemRows,
            paymentTerm: document.paymentTerm,
            sphDate: document.sphDate,
            sphId: id,
            sphNo: document.sphNo,
          }}
          submitLabel="Update SPH"
          title="Edit SPH"
        />
      )}
    </AppShell>
  );
}
