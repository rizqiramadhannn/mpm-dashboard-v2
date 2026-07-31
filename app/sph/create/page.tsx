import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { getDb } from "../../../db";
import { customers, sphDocuments, sphItems } from "../../../db/schema";
import { listCustomers } from "../../customer/data";
import { CreateSphForm } from "./CreateSphForm";

export const dynamic = "force-dynamic";

const staticSphSnapshot = {
  company: {
    name: "PT Morowali Putra Mandiri",
    addressLines: [
      "Jl. Trans Sulawesi",
      "Kavling Bintang Putri Blok D No 4",
      "Bahodopi - Morowali",
      "Sulawesi Tengah",
    ],
  },
  paymentAccount: {
    bank: "Bank BCA",
    accountName: "Morowali Putra Mandiri",
    accountNumber: "7245751010",
  },
  signature: {
    label: "Hormat Kami,",
    companyName: "PT Morowali Putra Mandiri",
  },
};

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

function toYearMonth(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal SPH tidak valid.");
  }

  return {
    yy: date.getFullYear().toString().slice(-2),
    mm: (date.getMonth() + 1).toString().padStart(2, "0"),
  };
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

async function createSphAction(formData: FormData) {
  "use server";

  const db = await getDb();
  const customerId = parseInteger(formData.get("customerId"), "Customer");
  const sphDate = requiredString(formData, "sphDate");
  const paymentTerm = requiredString(formData, "paymentTerm");
  const franco = requiredString(formData, "franco");
  const deliveryDate = optionalString(formData, "deliveryDate") || null;
  const etaDate = optionalString(formData, "etaDate") || null;
  const additionalInfo = optionalString(formData, "additionalInfo");
  const { yy, mm } = toYearMonth(sphDate);

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
      partNumber,
      partName,
      quantity,
      unitPrice,
      totalPrice: quantity * unitPrice,
    };
  });

  if (items.length === 0) {
    throw new Error("Minimal satu item wajib diisi.");
  }

  const [latestSph] = await db
    .select({ sequence: sphDocuments.sequence })
    .from(sphDocuments)
    .where(and(eq(sphDocuments.yy, yy), eq(sphDocuments.mm, mm)))
    .orderBy(desc(sphDocuments.sequence))
    .limit(1);

  const sequence = (latestSph?.sequence ?? 0) + 1;
  const customerCode = customerInitials(customer.code, customer.name);
  const sphNo = `SPH${yy}${mm}${sequence.toString().padStart(3, "0")}${customerCode}`;
  const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

  const insertedSph = await db
    .insert(sphDocuments)
    .values({
      sphNo,
      yy,
      mm,
      sequence,
      customerCode,
      customerId: customer.id,
      customerName: customer.name,
      customerDetailLine1: customer.detailLine1,
      customerDetailLine2: customer.detailLine2,
      customerDetailLine3: customer.detailLine3,
      paymentTerm,
      franco,
      sphDate,
      deliveryDate,
      etaDate,
      paymentDueDate: sphDate,
      additionalInfo,
      totalAmount,
      amountInWords: toRupiahWords(totalAmount),
      staticSnapshotJson: staticSphSnapshot,
      status: "pending_invoice",
    })
    .returning({ id: sphDocuments.id });

  await db.insert(sphItems).values(
    items.map((item) => ({
      sphId: insertedSph[0].id,
      lineNo: item.lineNo,
      partNumber: item.partNumber,
      partName: item.partName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }))
  );

  redirect("/sph/list");
}

export default async function CreateSphPage() {
  let customerOptions: {
    id: number;
    code: string;
    name: string;
    detailLine1: string;
    detailLine2: string;
    detailLine3: string;
  }[] = [];
  let databaseError: string | null = null;

  try {
    customerOptions = await listCustomers();
  } catch (error) {
    databaseError = error instanceof Error ? error.message : "Database unavailable.";
  }

  return (
    <AppShell>
      {databaseError ? (
        <section className="form-section">
          <p className="page-kicker">Surat Penawaran Harga</p>
          <h1>Create SPH</h1>
          <div className="empty-state">{databaseError}</div>
        </section>
      ) : (
        <CreateSphForm action={createSphAction} customers={customerOptions} />
      )}
    </AppShell>
  );
}
