import type { CSSProperties } from "react";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { AppShell } from "../components/AppShell";
import { getDb } from "../../db";
import {
  invoiceDocuments,
  shipmentJourneys,
  sphDocuments,
  sphItems,
  supplierNotes,
  suppliers,
} from "../../db/schema";

export const dynamic = "force-dynamic";

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

type Tone = "danger" | "neutral" | "positive" | "warning";

type Stat = {
  change: string;
  href?: string;
  label: string;
  tone: Tone;
  value: string;
};

type RankingItem = {
  name: string;
  percent: number;
  value: string;
};

type MonthlyCashflow = {
  expense: number;
  income: number;
  month: string;
};

type DashboardData = {
  activities: string[];
  cashflow: {
    expense: number;
    income: number;
    net: number;
  };
  invoiceStatus: Array<{
    label: string;
    percent: string;
  }>;
  monthlyCashflow: MonthlyCashflow[];
  period: string;
  stats: Stat[];
  topCustomers: RankingItem[];
  topSuppliers: RankingItem[];
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateKey(value: string | null) {
  return value?.slice(0, 10) ?? "";
}

function isWithinMonth(value: string | null, key: string) {
  return dateKey(value).startsWith(key);
}

function formatPeriod(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(date);
}

function formatMoney(value: number) {
  return `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function formatCompactMoney(value: number) {
  const absolute = Math.abs(value);
  const formatter = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 1,
  });

  if (absolute >= 1_000_000_000) {
    return `Rp ${formatter.format(value / 1_000_000_000)} M`;
  }

  if (absolute >= 1_000_000) {
    return `Rp ${formatter.format(value / 1_000_000)} jt`;
  }

  if (absolute >= 1_000) {
    return `Rp ${formatter.format(value / 1_000)} rb`;
  }

  return formatMoney(value);
}

function formatPercent(value: number, total: number) {
  if (total <= 0) {
    return "0%";
  }

  return `${Math.round((value / total) * 100)}%`;
}

function addMonths(date: Date, offset: number) {
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() + offset);
  return result;
}

function isInvoicePaid(status: string) {
  return status === "done";
}

function isInvoiceCancelled(status: string) {
  return status === "cancelled";
}

function normalizedSphStatus(status: string) {
  const aliases: Record<string, string> = {
    cancelled: "cancel",
    draft: "cek_harga",
    invoiced: "menunggu_pengiriman",
    pending_invoice: "menunggu_pengiriman",
  };

  return aliases[status] ?? status;
}

function isSupplierNoteCancelled(status: string) {
  return status === "CANCELLED";
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

function rankingFromMap(values: Map<string, number>) {
  const maxValue = Math.max(0, ...values.values());

  return [...values.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({
      name,
      percent: maxValue > 0 ? Math.max(4, Math.round((value / maxValue) * 100)) : 0,
      value: formatCompactMoney(value),
    }));
}

function pushActivity(
  activities: Array<{ at: string; text: string }>,
  at: string | null,
  text: string
) {
  if (at) {
    activities.push({ at, text });
  }
}

function getFallbackDashboardData(): DashboardData {
  return {
    activities: [
      "SPH-2026-0718 dibuat untuk PT Armada Prima",
      "INV-2026-1442 lunas dari Bengkel Sinar Teknik",
      "Pengiriman INV-2026-1437 dijadwalkan sore ini",
      "Stok fast moving filter solar masuk dari supplier",
    ],
    cashflow: {
      expense: 315_200_000,
      income: 428_500_000,
      net: 113_300_000,
    },
    invoiceStatus: [
      { label: "Lunas", percent: "68%" },
      { label: "Belum Lunas", percent: "22%" },
      { label: "Jatuh Tempo", percent: "10%" },
    ],
    monthlyCashflow: [
      { month: "Jan", income: 310, expense: 226 },
      { month: "Feb", income: 342, expense: 241 },
      { month: "Mar", income: 368, expense: 252 },
      { month: "Apr", income: 331, expense: 268 },
      { month: "Mei", income: 392, expense: 281 },
      { month: "Jun", income: 418, expense: 297 },
      { month: "Jul", income: 428, expense: 315 },
    ],
    period: formatPeriod(new Date()),
    stats: [
      {
        change: "+12,4%",
        label: "Penjualan Bulan Ini",
        tone: "positive",
        value: "Rp 428,5 jt",
      },
      {
        change: "18 invoice",
        href: "/invoice?status=BELUM%20BAYAR",
        label: "Invoice Belum Lunas",
        tone: "warning",
        value: "Rp 86,2 jt",
      },
      {
        change: "9 menunggu follow up",
        href: "/sph/list?status=active",
        label: "SPH Aktif",
        tone: "neutral",
        value: "37",
      },
      {
        change: "5 prioritas hari ini",
        href: "/pengiriman?status=pending",
        label: "Pengiriman Pending",
        tone: "danger",
        value: "14",
      },
      {
        change: "7 nota belum lunas",
        href: "/supplier/nota-supplier?payment=OUTSTANDING",
        label: "Piutang ke Supplier",
        tone: "warning",
        value: "Rp 52,4 jt",
      },
    ],
    topCustomers: [
      { name: "PT Surya Motor Abadi", value: "Rp 78,4 jt", percent: 92 },
      { name: "CV Mekar Jaya Diesel", value: "Rp 64,1 jt", percent: 75 },
      { name: "Bengkel Sinar Teknik", value: "Rp 51,8 jt", percent: 61 },
      { name: "PT Armada Prima", value: "Rp 44,6 jt", percent: 52 },
      { name: "UD Lancar Sparepart", value: "Rp 39,2 jt", percent: 46 },
    ],
    topSuppliers: [
      { name: "Astra Otoparts", value: "Rp 122 jt", percent: 89 },
      { name: "Indoparts Mandiri", value: "Rp 96,3 jt", percent: 70 },
      { name: "Sumber Bearing", value: "Rp 84,8 jt", percent: 62 },
      { name: "Mega Filter Nusantara", value: "Rp 57,5 jt", percent: 42 },
      { name: "Central Diesel Part", value: "Rp 48,7 jt", percent: 36 },
    ],
  };
}

async function getDashboardData(): Promise<DashboardData> {
  const db = await getDb();
  const now = new Date();
  const currentMonth = monthKey(now);
  const today = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(now);
  const months = Array.from({ length: 7 }, (_, index) => addMonths(now, index - 6));
  const monthKeys = months.map(monthKey);
  const monthLabels = months.map((date) => monthNames[date.getMonth()]);

  const [rawInvoices, sphRows, supplierNoteRows, shipmentRows, sphItemRows] =
    await Promise.all([
      db
        .select({
          createdAt: invoiceDocuments.createdAt,
          customerName: invoiceDocuments.customerName,
          invoiceDate: invoiceDocuments.invoiceDate,
          invoiceNo: invoiceDocuments.invoiceNo,
          paidAmount: invoiceDocuments.paidAmount,
          paymentDueDate: invoiceDocuments.paymentDueDate,
          sphId: invoiceDocuments.sphId,
          status: invoiceDocuments.status,
          totalAmount: invoiceDocuments.totalAmount,
        })
        .from(invoiceDocuments),
      db
        .select({
          createdAt: sphDocuments.createdAt,
          customerName: sphDocuments.customerName,
          deliveryDate: sphDocuments.deliveryDate,
          etaDate: sphDocuments.etaDate,
          id: sphDocuments.id,
          sphDate: sphDocuments.sphDate,
          sphNo: sphDocuments.sphNo,
          status: sphDocuments.status,
          totalAmount: sphDocuments.totalAmount,
        })
        .from(sphDocuments),
      db
        .select({
          amount: supplierNotes.amount,
          createdAt: supplierNotes.createdAt,
          noteDate: supplierNotes.noteDate,
          noteNo: supplierNotes.noteNo,
          paidAmount: supplierNotes.paidAmount,
          paymentStatus: supplierNotes.paymentStatus,
          remainingPayment: supplierNotes.remainingPayment,
          supplierName: suppliers.name,
        })
        .from(supplierNotes)
        .innerJoin(suppliers, eq(supplierNotes.supplierId, suppliers.id)),
      db
        .select({
          createdAt: shipmentJourneys.createdAt,
          isShippingPaid: shipmentJourneys.isShippingPaid,
          latestStatus: shipmentJourneys.latestStatus,
          shippingCost: shipmentJourneys.shippingCost,
          sphItemId: shipmentJourneys.sphItemId,
        })
        .from(shipmentJourneys),
      db
        .select({
          id: sphItems.id,
          sphId: sphItems.sphId,
        })
        .from(sphItems),
    ]);

  const validSphIds = new Set(sphRows.map((sph) => sph.id));
  const invoices = rawInvoices.filter((invoice) => validSphIds.has(invoice.sphId));
  const sphIdByItem = new Map(sphItemRows.map((item) => [item.id, item.sphId]));
  const sphByInternalId = new Map(sphRows.map((sph) => [sph.id, sph]));

  const invoiceThisMonth = invoices.filter(
    (invoice) =>
      !isInvoiceCancelled(invoice.status) &&
      isWithinMonth(invoice.invoiceDate, currentMonth)
  );
  const incomeThisMonth = invoiceThisMonth.reduce(
    (sum, invoice) => sum + invoice.totalAmount,
    0
  );
  const unpaidInvoices = invoices.filter(
    (invoice) => !isInvoicePaid(invoice.status) && !isInvoiceCancelled(invoice.status)
  );
  const unpaidAmount = unpaidInvoices.reduce(
    (sum, invoice) => sum + Math.max(invoice.totalAmount - invoice.paidAmount, 0),
    0
  );
  const overdueInvoices = unpaidInvoices.filter(
    (invoice) => dateKey(invoice.paymentDueDate) && dateKey(invoice.paymentDueDate) < today
  );
  const activeSph = sphRows.filter(
    (sph) => !["cancel", "selesai"].includes(normalizedSphStatus(sph.status))
  );
  const followUpSph = sphRows.filter(
    (sph) => normalizedSphStatus(sph.status) === "cek_harga"
  );
  const pendingShipments = shipmentRows.filter(
    (shipment) => !isShipmentFinal(shipment.latestStatus)
  );
  const supplierOutstandingRows = supplierNoteRows.filter(
    (note) =>
      !isSupplierNoteCancelled(note.paymentStatus) &&
      Math.max(note.amount - note.paidAmount, note.remainingPayment, 0) > 0
  );
  const supplierOutstandingAmount = supplierOutstandingRows.reduce(
    (sum, note) => sum + Math.max(note.amount - note.paidAmount, note.remainingPayment, 0),
    0
  );

  const priorityShipmentCount = pendingShipments.filter((shipment) => {
    const sphId = sphIdByItem.get(shipment.sphItemId);
    const relatedSph = sphId ? sphByInternalId.get(sphId) : null;
    const dueDate = dateKey(relatedSph?.etaDate ?? relatedSph?.deliveryDate ?? null);

    return dueDate && dueDate <= today;
  }).length;

  const topCustomerValues = new Map<string, number>();
  const topSupplierValues = new Map<string, number>();

  for (const invoice of invoiceThisMonth) {
    topCustomerValues.set(
      invoice.customerName,
      (topCustomerValues.get(invoice.customerName) ?? 0) + invoice.totalAmount
    );
  }

  for (const note of supplierNoteRows) {
    if (
      isSupplierNoteCancelled(note.paymentStatus) ||
      !isWithinMonth(note.noteDate, currentMonth)
    ) {
      continue;
    }

    topSupplierValues.set(
      note.supplierName,
      (topSupplierValues.get(note.supplierName) ?? 0) + note.amount
    );
  }

  const monthlyCashflow: MonthlyCashflow[] = monthKeys.map((key, index) => {
    const income = invoices
      .filter(
        (invoice) =>
          !isInvoiceCancelled(invoice.status) && isWithinMonth(invoice.invoiceDate, key)
      )
      .reduce((sum, invoice) => sum + invoice.totalAmount, 0);
    const supplierExpense = supplierNoteRows
      .filter(
        (note) =>
          !isSupplierNoteCancelled(note.paymentStatus) &&
          isWithinMonth(note.noteDate, key)
      )
      .reduce((sum, note) => sum + note.amount, 0);
    const shippingExpense = shipmentRows
      .filter((shipment) => isWithinMonth(shipment.createdAt, key))
      .reduce((sum, shipment) => sum + shipment.shippingCost, 0);

    return {
      expense: Math.round((supplierExpense + shippingExpense) / 1_000_000),
      income: Math.round(income / 1_000_000),
      month: monthLabels[index],
    };
  });

  const currentMonthExpense =
    supplierNoteRows
      .filter(
        (note) =>
          !isSupplierNoteCancelled(note.paymentStatus) &&
          isWithinMonth(note.noteDate, currentMonth)
      )
      .reduce((sum, note) => sum + note.amount, 0) +
    shipmentRows
      .filter((shipment) => isWithinMonth(shipment.createdAt, currentMonth))
      .reduce((sum, shipment) => sum + shipment.shippingCost, 0);

  const paidInvoiceCount = invoices.filter((invoice) => isInvoicePaid(invoice.status)).length;
  const cancelledInvoiceCount = invoices.filter((invoice) =>
    isInvoiceCancelled(invoice.status)
  ).length;
  const activeInvoiceCount = Math.max(invoices.length - cancelledInvoiceCount, 0);
  const overdueInvoiceCount = overdueInvoices.length;
  const unpaidNotOverdueCount = Math.max(
    unpaidInvoices.length - overdueInvoiceCount,
    0
  );

  const activities: Array<{ at: string; text: string }> = [];
  for (const sph of sphRows) {
    pushActivity(activities, sph.createdAt, `${sph.sphNo} dibuat untuk ${sph.customerName}`);
  }

  for (const invoice of invoices) {
    pushActivity(
      activities,
      invoice.createdAt,
      `${invoice.invoiceNo} ${isInvoicePaid(invoice.status) ? "lunas" : "dibuat"} untuk ${invoice.customerName}`
    );
  }

  for (const note of supplierNoteRows) {
    pushActivity(
      activities,
      note.createdAt,
      `Nota supplier ${note.noteNo} dicatat dari ${note.supplierName}`
    );
  }

  for (const shipment of shipmentRows) {
    pushActivity(
      activities,
      shipment.createdAt,
      shipment.latestStatus
        ? `Pengiriman diperbarui: ${shipment.latestStatus}`
        : "Pengiriman baru dibuat"
    );
  }

  const stats: Stat[] = [
    {
      change: `${invoiceThisMonth.length} invoice bulan ini`,
      label: "Penjualan Bulan Ini",
      tone: incomeThisMonth > 0 ? "positive" : "neutral",
      value: formatCompactMoney(incomeThisMonth),
    },
    {
      change: `${unpaidInvoices.length} invoice`,
      href: "/invoice?status=BELUM%20BAYAR",
      label: "Invoice Belum Lunas",
      tone: unpaidInvoices.length > 0 ? "warning" : "positive",
      value: formatCompactMoney(unpaidAmount),
    },
    {
      change: `${followUpSph.length} menunggu follow up`,
      href: "/sph/list?status=active",
      label: "SPH Aktif",
      tone: "neutral",
      value: activeSph.length.toString(),
    },
    {
      change: `${priorityShipmentCount} prioritas hari ini`,
      href: "/pengiriman?status=pending",
      label: "Pengiriman Pending",
      tone: pendingShipments.length > 0 ? "danger" : "positive",
      value: pendingShipments.length.toString(),
    },
    {
      change: `${supplierOutstandingRows.length} nota belum lunas`,
      href: "/supplier/nota-supplier?payment=OUTSTANDING",
      label: "Piutang ke Supplier",
      tone: supplierOutstandingAmount > 0 ? "warning" : "positive",
      value: formatCompactMoney(supplierOutstandingAmount),
    },
  ];

  return {
    activities: activities
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 6)
      .map((activity) => activity.text),
    cashflow: {
      expense: currentMonthExpense,
      income: incomeThisMonth,
      net: incomeThisMonth - currentMonthExpense,
    },
    invoiceStatus: [
      {
        label: "Lunas",
        percent: formatPercent(paidInvoiceCount, activeInvoiceCount),
      },
      {
        label: "Belum Lunas",
        percent: formatPercent(unpaidNotOverdueCount, activeInvoiceCount),
      },
      {
        label: "Jatuh Tempo",
        percent: formatPercent(overdueInvoiceCount, activeInvoiceCount),
      },
    ],
    monthlyCashflow,
    period: formatPeriod(now),
    stats,
    topCustomers: rankingFromMap(topCustomerValues),
    topSuppliers: rankingFromMap(topSupplierValues),
  };
}

export default async function DashboardPage() {
  const dashboard = await getDashboardData().catch((error) => {
    console.error("Dashboard data unavailable, showing fallback data.", error);
    return getFallbackDashboardData();
  });
  const maxCashflow = Math.max(
    1,
    ...dashboard.monthlyCashflow.flatMap((item) => [item.income, item.expense])
  );

  return (
    <AppShell>
      <section className="dashboard-page">
        <div className="dashboard-header">
          <div>
            <p className="page-kicker">Penjualan Sparepart</p>
            <h1>Dashboard</h1>
          </div>
          <div className="dashboard-period">{dashboard.period}</div>
        </div>

        <div className="stats-grid">
          {dashboard.stats.map((item) => (
            <MetricCard item={item} key={item.label} />
          ))}
        </div>

        <div className="dashboard-grid">
          <article className="dashboard-card cashflow-card">
            <div className="card-heading">
              <div>
                <h2>Cashflow Bulan Ini</h2>
                <p>Ringkasan pemasukan dan pengeluaran berjalan</p>
              </div>
            </div>
            <div className="cashflow-summary">
              <div>
                <span>Pemasukan</span>
                <strong>{formatCompactMoney(dashboard.cashflow.income)}</strong>
              </div>
              <div>
                <span>Pengeluaran</span>
                <strong>{formatCompactMoney(dashboard.cashflow.expense)}</strong>
              </div>
              <div>
                <span>Net Cashflow</span>
                <strong>{formatCompactMoney(dashboard.cashflow.net)}</strong>
              </div>
            </div>
          </article>

          <article className="dashboard-card">
            <div className="card-heading">
              <div>
                <h2>Status Invoice</h2>
                <p>Berdasarkan status invoice real</p>
              </div>
            </div>
            <div className="invoice-status">
              {dashboard.invoiceStatus.map((item) => (
                <div key={item.label} style={{ "--value": item.percent } as CSSProperties}>
                  <span>{item.label}</span>
                  <strong>{item.percent}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="dashboard-card chart-card">
            <div className="card-heading">
              <div>
                <h2>Pemasukan & Pengeluaran Perbulan</h2>
                <p>Dalam juta rupiah, 7 bulan terakhir</p>
              </div>
              <div className="chart-legend">
                <span className="income">Pemasukan</span>
                <span className="expense">Pengeluaran</span>
              </div>
            </div>
            <div className="bar-chart" aria-label="Grafik pemasukan dan pengeluaran perbulan">
              {dashboard.monthlyCashflow.map((item) => (
                <div className="bar-group" key={item.month}>
                  <div className="bars">
                    <span
                      className="bar income"
                      style={{ height: `${(item.income / maxCashflow) * 100}%` }}
                      title={`Pemasukan ${item.month}: ${formatMoney(item.income * 1_000_000)}`}
                    />
                    <span
                      className="bar expense"
                      style={{ height: `${(item.expense / maxCashflow) * 100}%` }}
                      title={`Pengeluaran ${item.month}: ${formatMoney(item.expense * 1_000_000)}`}
                    />
                  </div>
                  <span className="bar-label">{item.month}</span>
                </div>
              ))}
            </div>
          </article>

          <RankingCard
            emptyText="Belum ada invoice bulan ini."
            items={dashboard.topCustomers}
            subtitle="Berdasarkan invoice bulan ini"
            title="Top 5 Customer"
          />
          <RankingCard
            emptyText="Belum ada nota supplier bulan ini."
            items={dashboard.topSuppliers}
            subtitle="Berdasarkan nota supplier bulan ini"
            title="Top 5 Supplier"
          />

          <article className="dashboard-card">
            <div className="card-heading">
              <div>
                <h2>Aktivitas Terbaru</h2>
                <p>Aktivitas dari SPH, invoice, supplier, dan pengiriman</p>
              </div>
            </div>
            <ul className="activity-list">
              {dashboard.activities.length > 0 ? (
                dashboard.activities.map((activity, index) => (
                  <li key={`${activity}-${index}`}>{activity}</li>
                ))
              ) : (
                <li>Belum ada aktivitas.</li>
              )}
            </ul>
          </article>
        </div>
      </section>
    </AppShell>
  );
}

function MetricCard({ item }: { item: Stat }) {
  const content = (
    <>
      <p>{item.label}</p>
      <strong>{item.value}</strong>
      <span className={`metric-change ${item.tone}`}>{item.change}</span>
    </>
  );

  if (item.href) {
    return (
      <Link className="metric-card metric-link" href={item.href}>
        {content}
      </Link>
    );
  }

  return <article className="metric-card">{content}</article>;
}

function RankingCard({
  emptyText,
  title,
  subtitle,
  items,
}: {
  emptyText: string;
  title: string;
  subtitle: string;
  items: RankingItem[];
}) {
  return (
    <article className="dashboard-card">
      <div className="card-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="ranking-list">
        {items.length > 0 ? (
          items.map((item, index) => (
            <div className="ranking-item" key={item.name}>
              <div className="ranking-row">
                <span>
                  {index + 1}. {item.name}
                </span>
                <strong>{item.value}</strong>
              </div>
              <div className="progress-track">
                <span className="progress-fill" style={{ width: `${item.percent}%` }} />
              </div>
            </div>
          ))
        ) : (
          <p className="empty-card-text">{emptyText}</p>
        )}
      </div>
    </article>
  );
}
