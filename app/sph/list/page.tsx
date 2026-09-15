import { approveSphPrice, confirmSphPo } from "../workflow-actions";
import { isInvoiceEligibleSph } from "../workflow";
import { ConfigurableTable, TableHeader, TableCell, TableSpanCell } from "../../components/ConfigurableTable";
import { TABLE_COLUMNS } from "../../components/tableDefinitions";
import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AppShell } from "../../components/AppShell";
import { ConfirmForm } from "../../components/ConfirmForm";
import { DateRangeFilter } from "../../components/DateRangeFilter";
import { getCurrentPage, paginateRows, Pagination } from "../../components/Pagination";
import { recordActivityLog, requireUser } from "../../auth";
import { ItemListModal } from "./ItemListModal";
import { MigrateSphDialog } from "./MigrateSphDialog";
import { SphExcelDownload, type SphExportRow } from "./SphExcelDownload";
import {
  buildSphMigrationUpdates,
  invoiceNoFromMigratedSph,
  isMigratableSphStatus,
  assertValidTargetMonth,
} from "./migration";
import { getDb } from "../../../db";
import {
  invoiceDocuments,
  invoiceItems,
  invoiceLogs,
  shipmentJourneys,
  shipments,
  sphDocuments,
  sphItems,
} from "../../../db/schema";

export const dynamic = "force-dynamic";

type SphItemRow = {
  id: string;
  sphId: string;
  lineNo: number;
  partNumber: string;
  partName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type ShipmentJourneyRow = {
  customerReceived: boolean;
  latestStatus: string;
  quantity: number;
  shipmentId: string | null;
  shippingVendor: string;
  sphItemId: string;
};

type ShipmentHeaderRow = {
  id: string;
  latestStatus: string;
  shipmentNo: string;
  shippingVendor: string;
};

type InvoicePaymentRow = {
  invoiceNo: string;
  paidAmount: number;
  sphId: string;
  status: "draft" | "pending" | "pending_replace" | "done" | "cancelled";
  totalAmount: number;
};

const sphStatuses = [
  "cek_harga",
  "menunggu_po_konfirmasi",
  "menunggu_pengiriman",
  "proses_pengiriman",
  "selesai",
  "cancel",
];

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    cancel: "Cancel",
    cancelled: "Cancel",
    cek_harga: "Cek Harga",
    menunggu_po_konfirmasi: "Menunggu PO / Konfirmasi",
    draft: "Cek Harga",
    invoiced: "Menunggu Pengiriman",
    menunggu_pengiriman: "Menunggu Pengiriman",
    pending_invoice: "Menunggu Pengiriman",
    proses_pengiriman: "Proses Pengiriman",
    selesai: "Selesai",
  };

  return labels[status] ?? status;
}

function shipmentStatusLabel(status: string) {
  const normalized = status.trim().toLowerCase();
  const labels: Record<string, string> = {
    arrived: "Terkirim",
    delivered: "Terkirim",
    done: "Terkirim",
    received: "Terkirim",
    selesai: "Terkirim",
    terkirim: "Terkirim",
    terjadwal: "Terjadwal",
  };

  return labels[normalized] ?? status;
}

function itemDeliveryStatus({
  itemQty,
  journeys,
}: {
  itemQty: number;
  journeys: ShipmentJourneyRow[];
}) {
  const shippedQty = journeys.reduce((total, journey) => total + journey.quantity, 0);
  const receivedQty = journeys.reduce(
    (total, journey) => total + (journey.customerReceived ? journey.quantity : 0),
    0
  );

  if (receivedQty >= itemQty && itemQty > 0) {
    return "Terkirim";
  }

  if (shippedQty > 0) {
    return "Proses Pengiriman";
  }

  return "Menunggu Pengiriman";
}

function invoicePaymentStatus(invoice: InvoicePaymentRow | undefined) {
  if (!invoice) {
    return "Belum Ada Invoice";
  }

  if (invoice.status === "cancelled") {
    return "Invoice Cancelled";
  }

  if (invoice.totalAmount > 0 && invoice.paidAmount >= invoice.totalAmount) {
    return "Sudah Dibayar";
  }

  if (invoice.paidAmount > 0) {
    return "DP";
  }

  return "Belum Dibayar";
}

function normalizedStatus(status: string) {
  const aliases: Record<string, string> = {
    cancelled: "cancel",
    draft: "cek_harga",
    invoiced: "menunggu_pengiriman",
    pending_invoice: "menunggu_pengiriman",
  };

  return aliases[status] ?? status;
}

function textMatches(value: unknown, query: string) {
  return String(value ?? "").toLowerCase().includes(query);
}

function isWithinDateRange(value: string | null, from: string, to: string) {
  if (!value) {
    return !from && !to;
  }

  const dateValue = value.slice(0, 10);
  return (!from || dateValue >= from) && (!to || dateValue <= to);
}

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function EditIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M3 6h18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M8 6V4h8v2m-1 5v6M9 11v6m-4-11 1 14h12l1-14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="m20 6-11 11-5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

async function deleteSphAction(formData: FormData) {
  "use server";

  const user = await requireUser("/sph/list");
  const idValue = formData.get("sphId");

  if (typeof idValue !== "string" || idValue.trim() === "") {
    throw new Error("SPH tidak valid.");
  }

  const sphId = idValue.trim();
  const db = await getDb();
  const invoices = await db
    .select({ id: invoiceDocuments.id })
    .from(invoiceDocuments)
    .where(eq(invoiceDocuments.sphId, sphId));
  const invoiceIds = invoices.map((invoice) => invoice.id);

  if (invoiceIds.length > 0) {
    await db.delete(invoiceItems).where(inArray(invoiceItems.invoiceId, invoiceIds));
    await db.delete(invoiceDocuments).where(inArray(invoiceDocuments.id, invoiceIds));
  }

  await db.delete(sphDocuments).where(inArray(sphDocuments.id, [sphId]));
  await recordActivityLog({
    action: "sph_deleted",
    actor: user,
    details: { sphId },
  });
  revalidatePath("/dashboard");
  revalidatePath("/invoice");
  revalidatePath("/sph/list");
}

async function cancelSphAction(formData: FormData) {
  "use server";

  const user = await requireUser("/sph/list");
  const idValue = formData.get("sphId");

  if (typeof idValue !== "string" || idValue.trim() === "") {
    throw new Error("SPH tidak valid.");
  }

  const sphId = idValue.trim();
  const db = await getDb();
  const invoices = await db
    .select({ id: invoiceDocuments.id })
    .from(invoiceDocuments)
    .where(eq(invoiceDocuments.sphId, sphId));
  const invoiceIds = invoices.map((invoice) => invoice.id);

  if (invoiceIds.length > 0) {
    await db.delete(invoiceItems).where(inArray(invoiceItems.invoiceId, invoiceIds));
    await db.delete(invoiceDocuments).where(inArray(invoiceDocuments.id, invoiceIds));
  }

  await db
    .update(sphDocuments)
    .set({ status: "cancel" })
    .where(eq(sphDocuments.id, sphId));
  await recordActivityLog({
    action: "sph_cancelled",
    actor: user,
    details: { sphId },
  });
  revalidatePath("/dashboard");
  revalidatePath("/invoice");
  revalidatePath("/sph/list");
}

async function approveHargaAction(formData: FormData) {
  "use server";
  const user = await requireUser("/sph/list");
  const sphId = String(formData.get("sphId") ?? "").trim();
  if (!sphId) throw new Error("SPH tidak valid.");
  const result = await approveSphPrice(await getDb(), sphId);
  if (result) await recordActivityLog({ action: "sph_price_approved", actor: user, details: { sphId, sphNo: result.sphNo } });
  revalidatePath("/dashboard");
  revalidatePath("/sph/list");
}

async function confirmPoAction(formData: FormData) {
  "use server";
  const user = await requireUser("/sph/list");
  const sphId = String(formData.get("sphId") ?? "").trim();
  if (!sphId) throw new Error("SPH tidak valid.");
  const result = await confirmSphPo(await getDb(), sphId);
  if (result) await recordActivityLog({ action: "sph_po_confirmed", actor: user, details: { sphId, ...result }, targetUsername: result.customerName });
  revalidatePath("/dashboard");
  revalidatePath("/invoice");
  revalidatePath("/pengiriman");
  revalidatePath("/sph/list");
}

async function migrateSphAction(formData: FormData) {
  "use server";

  const user = await requireUser("/sph/list");

  try {
    const targetMonthValue = formData.get("targetMonth");
    const targetMonth =
      typeof targetMonthValue === "string" ? targetMonthValue.trim() : "";
    const { mm, yy } = assertValidTargetMonth(targetMonth);
    const sphIds = [
      ...new Set(
        formData
          .getAll("sphId")
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter(Boolean)
      ),
    ];

    if (sphIds.length === 0) {
      throw new Error("Pilih minimal satu SPH untuk dimigrasi.");
    }

    const db = await getDb();
    const documents = await db
      .select({
        customerCode: sphDocuments.customerCode,
        id: sphDocuments.id,
        mm: sphDocuments.mm,
        paymentTerm: sphDocuments.paymentTerm,
        pdfSphDate: sphDocuments.pdfSphDate,
        sphDate: sphDocuments.sphDate,
        sphNo: sphDocuments.sphNo,
        status: sphDocuments.status,
        yy: sphDocuments.yy,
      })
      .from(sphDocuments)
      .where(inArray(sphDocuments.id, sphIds));

    if (documents.length !== sphIds.length) {
      throw new Error("Ada SPH yang tidak ditemukan. Refresh halaman lalu coba lagi.");
    }

    const [latestSph] = await db
      .select({ sequence: sphDocuments.sequence })
      .from(sphDocuments)
      .where(and(eq(sphDocuments.yy, yy), eq(sphDocuments.mm, mm)))
      .orderBy(desc(sphDocuments.sequence))
      .limit(1);
    const updates = buildSphMigrationUpdates({
      documents,
      latestSequence: latestSph?.sequence ?? 0,
      targetMonth,
    });

    await db.transaction(async (tx) => {
      for (const update of updates) {
        const document = documents.find((row) => row.id === update.id);

        if (!document) {
          throw new Error("Ada SPH yang tidak ditemukan. Refresh halaman lalu coba lagi.");
        }

        await tx
          .update(sphDocuments)
          .set({
            mm,
            paymentDueDate: update.paymentDueDate,
            pdfSphDate: document.pdfSphDate ?? document.sphDate,
            sequence: update.sequence,
            sphDate: update.sphDate,
            sphNo: update.sphNo,
            yy,
          })
          .where(eq(sphDocuments.id, update.id));

        const previousInvoiceNo = invoiceNoFromMigratedSph(document.sphNo);
        const nextInvoiceNo = update.invoiceNo;
        const invoiceDate = update.sphDate;

        await tx
          .update(invoiceDocuments)
          .set({
            invoiceDate,
            invoiceNo: nextInvoiceNo,
            paymentDueDate: update.paymentDueDate,
          })
          .where(eq(invoiceDocuments.sphId, update.id));

        await tx
          .update(invoiceLogs)
          .set({
            invoiceNo: nextInvoiceNo,
            sphNo: update.sphNo,
          })
          .where(eq(invoiceLogs.sphNo, document.sphNo));

        await tx
          .update(invoiceLogs)
          .set({
            invoiceNo: nextInvoiceNo,
            sphNo: update.sphNo,
          })
          .where(eq(invoiceLogs.invoiceNo, previousInvoiceNo));
      }
    });

    await recordActivityLog({
      action: "sph_migrated",
      actor: user,
      details: {
        count: updates.length,
        sphIds,
        targetMonth,
        updatedSphNos: updates.map((update) => update.sphNo),
      },
    });
    revalidatePath("/dashboard");
    revalidatePath("/employee/employee-list");
    revalidatePath("/invoice");
    revalidatePath("/sph/list");
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Gagal migrate SPH.",
    };
  }
}

export default async function ListSphPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = getSearchParam(params, "q").trim().toLowerCase();
  const customerFilter = getSearchParam(params, "customer");
  const statusFilter = getSearchParam(params, "status");
  const paymentFilter = getSearchParam(params, "payment");
  const fromDate = getSearchParam(params, "from");
  const toDate = getSearchParam(params, "to");
  const db = await getDb();
  const documents = await db
    .select({
      id: sphDocuments.id,
      sphNo: sphDocuments.sphNo,
      customerName: sphDocuments.customerName,
      customerCode: sphDocuments.customerCode,
      sphDate: sphDocuments.sphDate,
      deliveryDate: sphDocuments.deliveryDate,
      etaDate: sphDocuments.etaDate,
      paymentTerm: sphDocuments.paymentTerm,
      franco: sphDocuments.franco,
      totalAmount: sphDocuments.totalAmount,
      status: sphDocuments.status,
      createdAt: sphDocuments.createdAt,
    })
    .from(sphDocuments)
    .orderBy(desc(sphDocuments.sphNo), desc(sphDocuments.id));

  const documentIds = documents.map((document) => document.id);
  const itemRows: SphItemRow[] =
    documentIds.length > 0
      ? await db
          .select({
            id: sphItems.id,
            sphId: sphItems.sphId,
            lineNo: sphItems.lineNo,
            partNumber: sphItems.partNumber,
            partName: sphItems.partName,
            quantity: sphItems.quantity,
            unitPrice: sphItems.unitPrice,
            totalPrice: sphItems.totalPrice,
          })
          .from(sphItems)
          .where(inArray(sphItems.sphId, documentIds))
      : [];

  const itemsBySph = new Map<string, SphItemRow[]>();

  for (const item of itemRows) {
    const items = itemsBySph.get(item.sphId) ?? [];
    items.push(item);
    itemsBySph.set(item.sphId, items);
  }

  for (const items of itemsBySph.values()) {
    items.sort((a, b) => a.lineNo - b.lineNo);
  }
  const itemIds = itemRows.map((item) => item.id);
  const journeyRows: ShipmentJourneyRow[] =
    itemIds.length > 0
      ? await db
          .select({
            customerReceived: shipmentJourneys.customerReceived,
            latestStatus: shipmentJourneys.latestStatus,
            quantity: shipmentJourneys.quantity,
            shipmentId: shipmentJourneys.shipmentId,
            shippingVendor: shipmentJourneys.shippingVendor,
            sphItemId: shipmentJourneys.sphItemId,
          })
          .from(shipmentJourneys)
          .where(inArray(shipmentJourneys.sphItemId, itemIds))
      : [];
  const shipmentIds = [
    ...new Set(
      journeyRows
        .map((journey) => journey.shipmentId)
        .filter((shipmentId): shipmentId is string => Boolean(shipmentId))
    ),
  ];
  const shipmentRows: ShipmentHeaderRow[] =
    shipmentIds.length > 0
      ? await db
          .select({
            id: shipments.id,
            latestStatus: shipments.latestStatus,
            shipmentNo: shipments.shipmentNo,
            shippingVendor: shipments.shippingVendor,
          })
          .from(shipments)
          .where(inArray(shipments.id, shipmentIds))
      : [];
  const invoiceRows: InvoicePaymentRow[] =
    documentIds.length > 0
      ? await db
          .select({
            invoiceNo: invoiceDocuments.invoiceNo,
            paidAmount: invoiceDocuments.paidAmount,
            sphId: invoiceDocuments.sphId,
            status: invoiceDocuments.status,
            totalAmount: invoiceDocuments.totalAmount,
          })
          .from(invoiceDocuments)
          .where(inArray(invoiceDocuments.sphId, documentIds))
      : [];
  const journeysByItem = new Map<string, ShipmentJourneyRow[]>();
  const shipmentById = new Map(shipmentRows.map((shipment) => [shipment.id, shipment]));
  const invoiceBySph = new Map(invoiceRows.map((invoice) => [invoice.sphId, invoice]));

  for (const journey of journeyRows) {
    const journeys = journeysByItem.get(journey.sphItemId) ?? [];
    journeys.push(journey);
    journeysByItem.set(journey.sphItemId, journeys);
  }

  const paymentOptions = [...new Set(documents.map((document) => document.paymentTerm))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const customerOptions = [...new Set(documents.map((document) => document.customerName))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const filteredDocuments = documents.filter((document) => {
    const items = itemsBySph.get(document.id) ?? [];
    const status = normalizedStatus(document.status);
    const matchesQuery =
      !query ||
      [
        document.sphNo,
        document.customerName,
        document.customerCode,
        document.franco,
        document.paymentTerm,
        statusLabel(document.status),
        ...items.flatMap((item) => [item.partNumber, item.partName]),
    ].some((value) => textMatches(value, query));
    const matchesStatus =
      !statusFilter ||
      (statusFilter === "active"
        ? status !== "cancel" && status !== "selesai"
        : status === statusFilter);
    const matchesCustomer = !customerFilter || document.customerName === customerFilter;
    const matchesPayment = !paymentFilter || document.paymentTerm === paymentFilter;
    const matchesDate = isWithinDateRange(document.sphDate, fromDate, toDate);

    return matchesQuery && matchesStatus && matchesCustomer && matchesPayment && matchesDate;
  });
  const { pageRows, safePage } = paginateRows(
    filteredDocuments,
    getCurrentPage(params)
  );
  const exportRows: SphExportRow[] = pageRows.flatMap((document) => {
    const items = itemsBySph.get(document.id) ?? [];
    const invoice = isInvoiceEligibleSph(document.status) ? invoiceBySph.get(document.id) : undefined;

    return items.map((item) => {
      const journeys = journeysByItem.get(item.id) ?? [];
      const receivedQty = journeys.reduce(
        (total, journey) => total + (journey.customerReceived ? journey.quantity : 0),
        0
      );
      const latestStatuses = [
        ...new Set(
          journeys
            .map((journey) => {
              const shipment = journey.shipmentId
                ? shipmentById.get(journey.shipmentId)
                : undefined;

              return shipment?.latestStatus || journey.latestStatus;
            })
            .filter(Boolean)
            .map(shipmentStatusLabel)
        ),
      ];
      const shipmentNos = [
        ...new Set(
          journeys
            .map((journey) =>
              journey.shipmentId ? shipmentById.get(journey.shipmentId)?.shipmentNo : ""
            )
            .filter(Boolean)
        ),
      ];
      const shippingVendors = [
        ...new Set(
          journeys
            .map((journey) => {
              const shipment = journey.shipmentId
                ? shipmentById.get(journey.shipmentId)
                : undefined;

              return shipment?.shippingVendor || journey.shippingVendor;
            })
            .filter(Boolean)
        ),
      ];

      return {
        customerCode: document.customerCode,
        customerName: document.customerName,
        deliveryDate: document.deliveryDate,
        etaDate: document.etaDate,
        franco: document.franco,
        itemDeliveryStatus: itemDeliveryStatus({ itemQty: item.quantity, journeys }),
        latestShipmentStatus: latestStatuses.join(", ") || "-",
        lineNo: item.lineNo,
        partName: item.partName,
        partNumber: item.partNumber,
        invoiceNo: invoice?.invoiceNo ?? "",
        invoicePaidAmount: invoice?.paidAmount ?? 0,
        invoicePaymentStatus: invoicePaymentStatus(invoice),
        invoiceRemainingAmount: invoice
          ? Math.max(invoice.totalAmount - invoice.paidAmount, 0)
          : 0,
        invoiceTotalAmount: invoice?.totalAmount ?? 0,
        paymentTerm: document.paymentTerm,
        quantity: item.quantity,
        receivedQty,
        shippedQty: journeys.reduce((total, journey) => total + journey.quantity, 0),
        shipmentNos: shipmentNos.join(", "),
        shippingVendors: shippingVendors.join(", "),
        sphDate: document.sphDate,
        sphNo: document.sphNo,
        sphStatus: statusLabel(document.status),
        totalPrice: item.totalPrice,
        unitPrice: item.unitPrice,
      };
    });
  });

  return (
    <AppShell>
      <section className="sph-list-page">
        <div className="dashboard-header">
          <div>
            <p className="page-kicker">Surat Penawaran Harga</p>
            <h1>List SPH</h1>
          </div>
          <div className="sph-header-actions">
            <MigrateSphDialog
              action={migrateSphAction}
              rows={documents
                .filter((document) => isMigratableSphStatus(document.status))
                .map((document) => ({
                  customerCode: document.customerCode,
                  customerName: document.customerName,
                  id: document.id,
                  items: itemsBySph.get(document.id) ?? [],
                  paymentTerm: document.paymentTerm,
                  sphDate: document.sphDate,
                  sphNo: document.sphNo,
                  status: normalizedStatus(document.status),
                  statusLabel: statusLabel(document.status),
                  totalAmount: document.totalAmount,
                }))}
            />
            <Link className="primary-button" href="/sph/create">
              Create SPH
            </Link>
          </div>
        </div>

        <form className="table-filter-bar">
          <label>
            <span>Search</span>
            <input
              name="q"
              placeholder="No SPH, customer, tujuan, item"
              defaultValue={getSearchParam(params, "q")}
            />
          </label>
          <label>
            <span>Customer</span>
            <select name="customer" defaultValue={customerFilter}>
              <option value="">Semua Customer</option>
              {customerOptions.map((customer) => (
                <option key={customer} value={customer}>
                  {customer}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select name="status" defaultValue={statusFilter}>
              <option value="">Semua Status</option>
              <option value="active">Aktif</option>
              {sphStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Payment</span>
            <select name="payment" defaultValue={paymentFilter}>
              <option value="">Semua Payment</option>
              {paymentOptions.map((payment) => (
                <option key={payment} value={payment}>
                  {payment}
                </option>
              ))}
            </select>
          </label>
          <DateRangeFilter from={fromDate} to={toDate} />
          <div className="table-filter-actions">
            <button type="submit">Filter</button>
            <Link href="/sph/list">Reset</Link>
          </div>
        </form>

        <SphExcelDownload rows={exportRows} />
        <div className="customer-table-wrap">
          <ConfigurableTable tableId="sph-list" columns={TABLE_COLUMNS.sph_list}
            className="customer-table sph-list-table"
            data-sortable-table
            data-sort-column="0"
            data-sort-direction="desc"
          >
            <thead>
              <tr>
                <TableHeader columnId="c0">No. SPH</TableHeader>
                <TableHeader columnId="c1">Tanggal</TableHeader>
                <TableHeader columnId="c2">Customer</TableHeader>
                <TableHeader columnId="c3">Pengiriman</TableHeader>
                <TableHeader columnId="c4">Payment</TableHeader>
                <TableHeader columnId="c5">Total</TableHeader>
                <TableHeader columnId="c6">Item</TableHeader>
                <TableHeader columnId="c7">Status</TableHeader>
                <TableHeader columnId="c8">Action</TableHeader>
              </tr>
            </thead>
            <tbody>
              {pageRows.length > 0 ? (
                pageRows.map((document) => {
                  const items = itemsBySph.get(document.id) ?? [];
                  const status = normalizedStatus(document.status);
                  const isCekHarga = status === "cek_harga";
                  const isWaitingPo = status === "menunggu_po_konfirmasi";
                  const isCancel = status === "cancel";

                  return (
                    <tr key={document.id}>
                      <TableCell columnId="c0">
                        <strong className="table-primary">{document.sphNo}</strong>
                      </TableCell>
                      <TableCell columnId="c1">{formatDate(document.sphDate)}</TableCell>
                      <TableCell columnId="c2">
                        <div className="stacked-cell">
                          <strong>{document.customerName}</strong>
                          <span>{document.customerCode}</span>
                        </div>
                      </TableCell>
                      <TableCell columnId="c3">
                        <div className="stacked-cell">
                          <strong>{document.franco || "-"}</strong>
                          <span>
                            {formatDate(document.deliveryDate)} / ETA{" "}
                            {formatDate(document.etaDate)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell columnId="c4">{document.paymentTerm}</TableCell>
                      <TableCell columnId="c5">{formatRupiah(document.totalAmount)}</TableCell>
                      <TableCell columnId="c6">
                        <ItemListModal items={items} sphNo={document.sphNo} />
                      </TableCell>
                      <TableCell columnId="c7">
                        <span className={`status-badge ${status}`}>
                          {statusLabel(document.status)}
                        </span>
                      </TableCell>
                      <TableCell columnId="c8">
                        <div className="table-actions icon-actions">
                          {isCekHarga ? (
                            <button
                              aria-label={`Download ${document.sphNo} disabled`}
                              className="icon-action"
                              disabled
                              title="Approve harga dulu untuk download SPH"
                              type="button"
                            >
                              <DownloadIcon />
                            </button>
                          ) : (
                            <a
                              aria-label={`Download ${document.sphNo}`}
                              className="icon-action"
                              href={`/sph/download/${document.id}`}
                              title="Download SPH"
                            >
                              <DownloadIcon />
                            </a>
                          )}
                          {isCekHarga ? (
                            <ConfirmForm
                              action={approveHargaAction}
                              confirmMessage={`Approve harga SPH ${document.sphNo} dan lanjut ke Menunggu PO / Konfirmasi?`}
                            >
                              <input name="sphId" type="hidden" value={document.id} />
                              <button
                                aria-label={`Approve harga ${document.sphNo}`}
                                className="icon-action success"
                                title="Approve Harga"
                                type="submit"
                              >
                                <CheckIcon />
                              </button>
                            </ConfirmForm>
                          ) : null}
                          {isWaitingPo ? (
                            <ConfirmForm action={confirmPoAction} confirmMessage={`Konfirmasi PO SPH ${document.sphNo} dan aktifkan invoice?`}>
                              <input name="sphId" type="hidden" value={document.id} />
                              <button aria-label={`Konfirmasi PO ${document.sphNo}`} className="icon-action success" title="Konfirmasi PO" type="submit">
                                <CheckIcon />
                              </button>
                            </ConfirmForm>
                          ) : null}
                          <Link
                            aria-label={`Edit ${document.sphNo}`}
                            className="icon-action"
                            href={`/sph/edit/${document.id}`}
                            title="Edit SPH"
                          >
                            <EditIcon />
                          </Link>
                          <ConfirmForm
                            action={cancelSphAction}
                            confirmMessage={`Cancel SPH ${document.sphNo}?`}
                          >
                            <input name="sphId" type="hidden" value={document.id} />
                            <button
                              aria-label={`Cancel ${document.sphNo}`}
                              className="icon-action warning"
                              disabled={isCancel}
                              title="Cancel SPH"
                              type="submit"
                            >
                              <CancelIcon />
                            </button>
                          </ConfirmForm>
                          <ConfirmForm
                            action={deleteSphAction}
                            confirmMessage={`Hapus SPH ${document.sphNo} beserta invoice terkait?`}
                          >
                            <input name="sphId" type="hidden" value={document.id} />
                            <button
                              aria-label={`Delete ${document.sphNo}`}
                              className="icon-action danger"
                              title="Delete SPH"
                              type="submit"
                            >
                              <TrashIcon />
                            </button>
                          </ConfirmForm>
                        </div>
                      </TableCell>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <TableSpanCell >Tidak ada SPH sesuai filter.</TableSpanCell>
                </tr>
              )}
            </tbody>
          </ConfigurableTable>
        </div>
        <Pagination
          currentPage={safePage}
          params={params}
          totalItems={filteredDocuments.length}
        />
      </section>
    </AppShell>
  );
}
