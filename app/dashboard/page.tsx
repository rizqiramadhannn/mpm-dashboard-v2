import { AppShell } from "../components/AppShell";
import type { CSSProperties } from "react";

const stats = [
  {
    label: "Penjualan Bulan Ini",
    value: "Rp 428,5 jt",
    change: "+12,4%",
    tone: "positive",
  },
  {
    label: "Invoice Belum Lunas",
    value: "Rp 86,2 jt",
    change: "18 invoice",
    tone: "warning",
  },
  {
    label: "SPH Aktif",
    value: "37",
    change: "9 menunggu follow up",
    tone: "neutral",
  },
  {
    label: "Pengiriman Pending",
    value: "14",
    change: "5 prioritas hari ini",
    tone: "danger",
  },
];

const topCustomers = [
  { name: "PT Surya Motor Abadi", value: "Rp 78,4 jt", percent: 92 },
  { name: "CV Mekar Jaya Diesel", value: "Rp 64,1 jt", percent: 75 },
  { name: "Bengkel Sinar Teknik", value: "Rp 51,8 jt", percent: 61 },
  { name: "PT Armada Prima", value: "Rp 44,6 jt", percent: 52 },
  { name: "UD Lancar Sparepart", value: "Rp 39,2 jt", percent: 46 },
];

const topSuppliers = [
  { name: "Astra Otoparts", value: "Rp 122,0 jt", percent: 89 },
  { name: "Indoparts Mandiri", value: "Rp 96,3 jt", percent: 70 },
  { name: "Sumber Bearing", value: "Rp 84,8 jt", percent: 62 },
  { name: "Mega Filter Nusantara", value: "Rp 57,5 jt", percent: 42 },
  { name: "Central Diesel Part", value: "Rp 48,7 jt", percent: 36 },
];

const monthlyCashflow = [
  { month: "Jan", income: 310, expense: 226 },
  { month: "Feb", income: 342, expense: 241 },
  { month: "Mar", income: 368, expense: 252 },
  { month: "Apr", income: 331, expense: 268 },
  { month: "Mei", income: 392, expense: 281 },
  { month: "Jun", income: 418, expense: 297 },
  { month: "Jul", income: 428, expense: 315 },
];

const recentActivities = [
  "SPH-2026-0718 dibuat untuk PT Armada Prima",
  "INV-2026-1442 lunas dari Bengkel Sinar Teknik",
  "Pengiriman INV-2026-1437 dijadwalkan sore ini",
  "Stok fast moving filter solar masuk dari supplier",
];

const maxCashflow = Math.max(...monthlyCashflow.flatMap((item) => [item.income, item.expense]));

export default function DashboardPage() {
  return (
    <AppShell>
      <section className="dashboard-page">
        <div className="dashboard-header">
          <div>
            <p className="page-kicker">Penjualan Sparepart</p>
            <h1>Dashboard</h1>
          </div>
          <div className="dashboard-period">Juli 2026</div>
        </div>

        <div className="stats-grid">
          {stats.map((item) => (
            <article className="metric-card" key={item.label}>
              <p>{item.label}</p>
              <strong>{item.value}</strong>
              <span className={`metric-change ${item.tone}`}>{item.change}</span>
            </article>
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
                <strong>Rp 428,5 jt</strong>
              </div>
              <div>
                <span>Pengeluaran</span>
                <strong>Rp 315,2 jt</strong>
              </div>
              <div>
                <span>Net Cashflow</span>
                <strong>Rp 113,3 jt</strong>
              </div>
            </div>
          </article>

          <article className="dashboard-card">
            <div className="card-heading">
              <div>
                <h2>Status Invoice</h2>
                <p>Dummy aging pembayaran</p>
              </div>
            </div>
            <div className="invoice-status">
              <div style={{ "--value": "68%" } as CSSProperties}>
                <span>Lunas</span>
                <strong>68%</strong>
              </div>
              <div style={{ "--value": "22%" } as CSSProperties}>
                <span>Belum Lunas</span>
                <strong>22%</strong>
              </div>
              <div style={{ "--value": "10%" } as CSSProperties}>
                <span>Jatuh Tempo</span>
                <strong>10%</strong>
              </div>
            </div>
          </article>

          <article className="dashboard-card chart-card">
            <div className="card-heading">
              <div>
                <h2>Pemasukan & Pengeluaran Perbulan</h2>
                <p>Dalam juta rupiah</p>
              </div>
              <div className="chart-legend">
                <span className="income">Pemasukan</span>
                <span className="expense">Pengeluaran</span>
              </div>
            </div>
            <div className="bar-chart" aria-label="Grafik pemasukan dan pengeluaran perbulan">
              {monthlyCashflow.map((item) => (
                <div className="bar-group" key={item.month}>
                  <div className="bars">
                    <span
                      className="bar income"
                      style={{ height: `${(item.income / maxCashflow) * 100}%` }}
                      title={`Pemasukan ${item.month}: Rp ${item.income} jt`}
                    />
                    <span
                      className="bar expense"
                      style={{ height: `${(item.expense / maxCashflow) * 100}%` }}
                      title={`Pengeluaran ${item.month}: Rp ${item.expense} jt`}
                    />
                  </div>
                  <span className="bar-label">{item.month}</span>
                </div>
              ))}
            </div>
          </article>

          <RankingCard title="Top 5 Customer" subtitle="Berdasarkan penjualan bulan ini" items={topCustomers} />
          <RankingCard title="Top 5 Supplier" subtitle="Berdasarkan pembelian bulan ini" items={topSuppliers} />

          <article className="dashboard-card">
            <div className="card-heading">
              <div>
                <h2>Aktivitas Terbaru</h2>
                <p>Data dummy untuk gambaran operasional</p>
              </div>
            </div>
            <ul className="activity-list">
              {recentActivities.map((activity) => (
                <li key={activity}>{activity}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </AppShell>
  );
}

function RankingCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{ name: string; value: string; percent: number }>;
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
        {items.map((item, index) => (
          <div className="ranking-item" key={item.name}>
            <div className="ranking-row">
              <span>{index + 1}. {item.name}</span>
              <strong>{item.value}</strong>
            </div>
            <div className="progress-track">
              <span className="progress-fill" style={{ width: `${item.percent}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
