import { desc, inArray } from "drizzle-orm";
import Link from "next/link";
import { AppShell } from "../components/AppShell";
import { getCurrentPage, paginateRows, Pagination } from "../components/Pagination";
import { getDb } from "../../db";
import { shipmentJourneys, shipments, sphDocuments, sphItems } from "../../db/schema";
import {
  ShipmentMoneyControl,
  ShipmentProofUpload,
} from "./ShipmentPaymentControls";

export const dynamic = "force-dynamic";

function fallbackTtbNo(dateValue: string | null, customerCode: string) {
  const yearMonth = dateValue?.slice(0, 7).replace("-", "");

  if (/^\d{6}$/.test(yearMonth ?? "")) {
    return `TTB${yearMonth}001${customerCode}`;
  }

  return `TTB001${customerCode}`;
}

type SphItemRow = {
  id: string;
  sphId: string;
  partName: string;
  partNumber: string;
  quantity: number;
};

type JourneyRow = {
  batchNo: number;
  destination: string;
  shippingCost: number;
  shippingVendor: string;
  sphItemId: string;
  latestStatus: string;
  quantity: number;
  customerReceived: boolean;
  shipmentId: string | null;
};

type DocumentRow = {
  createdAt: string;
  customerCode: string;
  customerName: string;
  deliveryDate: string | null;
  etaDate: string | null;
  franco: string;
  id: string;
  sphNo: string;
  status: string;
};

type ShipmentGroup = {
  customerCode: string;
  customerName: string;
  deliveryDate: string | null;
  destination: string;
  etaDate: string | null;
  itemCount: number;
  key: string;
  latestStatus: string;
  paidAmount: number;
  paymentProofCount: number;
  paymentProofFiles: ShipmentPaymentProofFile[];
  receivedQty: number;
  shipmentId: string | null;
  shippingCost: number;
  shippingVendor: string;
  sphDocuments: DocumentRow[];
  ttbNo: string;
  totalQty: number;
};

type ShipmentPaymentProofFile = {
  mimeType: string;
  name: string;
  size: number;
};

type ShipmentHeader = {
  customerCode: string;
  customerName: string;
  destination: string;
  id: string;
  isShippingPaid: boolean;
  latestStatus: string;
  paidAmount: number;
  paymentProofFilesJson:
    | {
        base64: string;
        mimeType: string;
        name: string;
        sha256: string;
        size: number;
      }[]
    | null;
  shipmentDate: string;
  shipmentNo: string;
  shippingCost: number;
  shippingVendor: string;
};

function shipmentPaymentProofFiles(
  files: ShipmentHeader["paymentProofFilesJson"]
): ShipmentPaymentProofFile[] {
  return Array.isArray(files)
    ? files.map((file) => ({
        mimeType: file.mimeType,
        name: file.name,
        size: file.size,
      }))
    : [];
}

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function textMatches(value: unknown, query: string) {
  return String(value ?? "").toLowerCase().includes(query);
}

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

function isShipmentFinal(status: string) {
  const normalized = status.trim().toLowerCase();

  return [
    "arrived",
    "cancelled",
    "delivered",
    "done",
    "received",
    "selesai",
    "terkirim",
  ].includes(normalized);
}

function shipmentKey(document: DocumentRow, journey: JourneyRow, sphId: string) {
  if (journey.shipmentId) {
    return `shipment:${journey.shipmentId}`;
  }

  const hasSharedShipmentMarkers =
    journey.shippingVendor.trim() ||
    journey.destination.trim() ||
    journey.shippingCost > 0;
  const vendor = hasSharedShipmentMarkers ? journey.shippingVendor.trim() : sphId;
  const destination = hasSharedShipmentMarkers
    ? journey.destination.trim() || document.franco
    : sphId;

  return [
    document.customerCode,
    document.deliveryDate ?? "",
    journey.batchNo || 1,
    vendor,
    destination,
  ].join("|");
}

function groupTitle(group: ShipmentGroup) {
  return group.shippingVendor || "Vendor belum diisi";
}

export default async function PengirimanPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = getSearchParam(params, "q").trim().toLowerCase();
  const statusFilter = getSearchParam(params, "status");
  const db = await getDb();
  const documents: DocumentRow[] = await db
    .select({
      id: sphDocuments.id,
      sphNo: sphDocuments.sphNo,
      customerName: sphDocuments.customerName,
      customerCode: sphDocuments.customerCode,
      deliveryDate: sphDocuments.deliveryDate,
      etaDate: sphDocuments.etaDate,
      franco: sphDocuments.franco,
      status: sphDocuments.status,
      createdAt: sphDocuments.createdAt,
    })
    .from(sphDocuments)
    .orderBy(desc(sphDocuments.createdAt), desc(sphDocuments.id));

  const documentIds = documents.map((document) => document.id);
  const itemRows: SphItemRow[] =
    documentIds.length > 0
      ? await db
          .select({
            id: sphItems.id,
            sphId: sphItems.sphId,
            partName: sphItems.partName,
            partNumber: sphItems.partNumber,
            quantity: sphItems.quantity,
          })
          .from(sphItems)
          .where(inArray(sphItems.sphId, documentIds))
      : [];

  const itemIds = itemRows.map((item) => item.id);
  const journeyRows: JourneyRow[] =
    itemIds.length > 0
      ? await db
          .select({
            batchNo: shipmentJourneys.batchNo,
            destination: shipmentJourneys.destination,
            shippingCost: shipmentJourneys.shippingCost,
            shippingVendor: shipmentJourneys.shippingVendor,
            sphItemId: shipmentJourneys.sphItemId,
            latestStatus: shipmentJourneys.latestStatus,
            quantity: shipmentJourneys.quantity,
            customerReceived: shipmentJourneys.customerReceived,
            shipmentId: shipmentJourneys.shipmentId,
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
  const shipmentHeaders: ShipmentHeader[] =
    shipmentIds.length > 0
      ? await db
          .select({
            customerCode: shipments.customerCode,
            customerName: shipments.customerName,
            destination: shipments.destination,
            id: shipments.id,
            isShippingPaid: shipments.isShippingPaid,
            latestStatus: shipments.latestStatus,
            paidAmount: shipments.paidAmount,
            paymentProofFilesJson: shipments.paymentProofFilesJson,
            shipmentDate: shipments.shipmentDate,
            shipmentNo: shipments.shipmentNo,
            shippingCost: shipments.shippingCost,
            shippingVendor: shipments.shippingVendor,
          })
          .from(shipments)
          .where(inArray(shipments.id, shipmentIds))
      : [];

  const documentById = new Map(documents.map((document) => [document.id, document]));
  const shipmentById = new Map(shipmentHeaders.map((shipment) => [shipment.id, shipment]));
  const sphIdByItem = new Map<string, string>();
  const itemById = new Map(itemRows.map((item) => [item.id, item]));

  for (const item of itemRows) {
    sphIdByItem.set(item.id, item.sphId);
  }

  const shipmentGroupsByKey = new Map<string, ShipmentGroup>();

  for (const journey of journeyRows) {
    const sphId = sphIdByItem.get(journey.sphItemId);
    const item = itemById.get(journey.sphItemId);
    const document = sphId ? documentById.get(sphId) : undefined;

    if (!sphId || !item || !document) {
      continue;
    }

    const key = shipmentKey(document, journey, sphId);
    const current = shipmentGroupsByKey.get(key);
    const shipment = journey.shipmentId ? shipmentById.get(journey.shipmentId) : undefined;
    const paymentProofFiles = shipmentPaymentProofFiles(
      shipment?.paymentProofFilesJson ?? null
    );
    const nextDocuments = current?.sphDocuments.some((sph) => sph.id === document.id)
      ? current.sphDocuments
      : [...(current?.sphDocuments ?? []), document];

    shipmentGroupsByKey.set(key, {
      customerCode: shipment?.customerCode || document.customerCode,
      customerName: shipment?.customerName || document.customerName,
      deliveryDate: shipment?.shipmentDate || document.deliveryDate,
      destination: shipment?.destination || journey.destination || document.franco,
      etaDate: shipment?.shipmentDate || document.etaDate,
      itemCount: (current?.itemCount ?? 0) + 1,
      key,
      latestStatus:
        shipment?.latestStatus || journey.latestStatus.trim() || current?.latestStatus || "-",
      paidAmount: shipment?.paidAmount ?? current?.paidAmount ?? 0,
      paymentProofCount: paymentProofFiles.length || current?.paymentProofCount || 0,
      paymentProofFiles:
        paymentProofFiles.length > 0 ? paymentProofFiles : (current?.paymentProofFiles ?? []),
      receivedQty: (current?.receivedQty ?? 0) + (journey.customerReceived ? journey.quantity : 0),
      shipmentId: shipment?.id ?? null,
      shippingCost: shipment?.shippingCost ?? Math.max(current?.shippingCost ?? 0, journey.shippingCost),
      shippingVendor: shipment?.shippingVendor || current?.shippingVendor || journey.shippingVendor,
      sphDocuments: nextDocuments.sort((a, b) => a.sphNo.localeCompare(b.sphNo)),
      ttbNo:
        shipment?.shipmentNo ||
        fallbackTtbNo(document.deliveryDate || document.createdAt, document.customerCode),
      totalQty: (current?.totalQty ?? 0) + journey.quantity,
    });
  }

  const shipmentGroups = Array.from(shipmentGroupsByKey.values()).filter((group) => {
    const isDone =
      group.totalQty > 0 &&
      group.receivedQty >= group.totalQty &&
      isShipmentFinal(group.latestStatus);
    const matchesQuery =
      !query ||
      [
        group.customerName,
        group.customerCode,
        group.destination,
        group.shippingVendor,
        group.latestStatus,
        group.ttbNo,
        ...group.sphDocuments.map((document) => document.sphNo),
      ].some((value) => textMatches(value, query));
    const matchesStatus =
      !statusFilter ||
      (statusFilter === "pending" ? !isDone : isDone);

    return matchesQuery && matchesStatus;
  });
  const shipmentRows = shipmentGroups.sort((a, b) => {
      const dateCompare = String(b.deliveryDate ?? "").localeCompare(
        String(a.deliveryDate ?? "")
      );

      return dateCompare || groupTitle(a).localeCompare(groupTitle(b));
    });
  const { pageRows, safePage } = paginateRows(shipmentRows, getCurrentPage(params));

  return (
    <AppShell>
      <section className="sph-list-page">
        <div className="dashboard-header">
          <div>
            <p className="page-kicker">Operasional Pengiriman</p>
            <h1>Pengiriman</h1>
            <p className="form-subtitle">
              Batch dengan customer, tanggal, vendor, dan tujuan yang sama ditampilkan
              sebagai satu pengiriman gabungan.
            </p>
          </div>
          <Link className="primary-button" href="/pengiriman/create">
            Tambah Pengiriman
          </Link>
        </div>

        <form className="table-filter-bar">
          <label>
            <span>Search</span>
            <input
              name="q"
              placeholder="No TTB, SPH, customer, vendor, tujuan, status"
              defaultValue={getSearchParam(params, "q")}
            />
          </label>
          <label>
            <span>Status</span>
            <select name="status" defaultValue={statusFilter}>
              <option value="">Semua Status</option>
              <option value="pending">Pending</option>
              <option value="done">Selesai</option>
            </select>
          </label>
          <div className="table-filter-actions">
            <button type="submit">Filter</button>
            <Link href="/pengiriman">Reset</Link>
          </div>
        </form>

        <div className="customer-table-wrap">
          <table className="customer-table shipment-list-table">
            <thead>
              <tr>
                <th>No TTB</th>
                <th>Customer</th>
                <th>Tujuan</th>
                <th>Jadwal</th>
                <th>Item / Qty</th>
                <th>Vendor</th>
                <th>Ongkir</th>
                <th>Payment</th>
                <th>Bukti Bayar</th>
                <th>Status Terakhir</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length > 0 ? (
                pageRows.map((shipment) => {
                  return (
                    <tr key={shipment.key}>
                      <td>
                        <div className="stacked-cell">
                          <strong className="table-primary">{shipment.ttbNo}</strong>
                          <span>
                            Ref SPH{" "}
                            {shipment.sphDocuments
                              .map((document) => document.sphNo)
                              .join(", ")}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="stacked-cell">
                          <strong>{shipment.customerName}</strong>
                          <span>{shipment.customerCode}</span>
                        </div>
                      </td>
                      <td>{shipment.destination || "-"}</td>
                      <td>
                        <div className="stacked-cell">
                          <strong>{formatDate(shipment.deliveryDate)}</strong>
                          <span>ETA {formatDate(shipment.etaDate)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="stacked-cell">
                          <strong>{shipment.itemCount} item</strong>
                          <span className="journey-progress">
                            {shipment.receivedQty}/{shipment.totalQty} qty
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong>{shipment.shippingVendor || "-"}</strong>
                      </td>
                      <td>
                        <div className="stacked-cell">
                          <ShipmentMoneyControl
                            amount={shipment.shippingCost}
                            field="shippingCost"
                            label="Ongkir"
                            shipmentId={shipment.shipmentId}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="stacked-cell">
                          <strong>
                            {shipment.paidAmount <= 0
                              ? "Belum Bayar"
                              : shipment.paidAmount >= shipment.shippingCost &&
                                  shipment.shippingCost > 0
                                ? "Sudah Bayar"
                                : "DP"}
                          </strong>
                          <ShipmentMoneyControl
                            amount={shipment.paidAmount}
                            disabled={shipment.shippingCost <= 0}
                            field="paidAmount"
                            label="Terbayar"
                            shipmentId={shipment.shipmentId}
                          />
                          <span>
                            Sisa{" "}
                            {new Intl.NumberFormat("id-ID", {
                              currency: "IDR",
                              maximumFractionDigits: 0,
                              style: "currency",
                            }).format(Math.max(shipment.shippingCost - shipment.paidAmount, 0))}
                          </span>
                        </div>
                      </td>
                      <td>
                        <ShipmentProofUpload
                          paymentProofFiles={shipment.paymentProofFiles}
                          shipmentId={shipment.shipmentId}
                          ttbNo={shipment.ttbNo}
                        />
                      </td>
                      <td>{shipment.latestStatus || "-"}</td>
                      <td>
                        <div className="table-actions icon-actions">
                          {shipment.shipmentId ? (
                            <>
                              <a
                                aria-label={`Download ${shipment.ttbNo}`}
                                className="icon-action"
                                href={`/pengiriman/ttb/${shipment.shipmentId}/download`}
                                title={`Download ${shipment.ttbNo}`}
                              >
                                <DownloadIcon />
                              </a>
                              <Link
                                aria-label={`Edit ${shipment.ttbNo}`}
                                className="icon-action"
                                href={`/pengiriman/${shipment.sphDocuments[0]?.id ?? ""}`}
                                title={`Edit ${shipment.ttbNo}`}
                              >
                                <EditIcon />
                              </Link>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11}>Belum ada pengiriman sesuai filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={safePage}
          params={params}
          totalItems={shipmentRows.length}
        />
      </section>
    </AppShell>
  );
}
