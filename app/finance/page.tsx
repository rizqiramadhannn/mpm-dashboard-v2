import { and, asc, desc, gte, lte } from "drizzle-orm";
import Link from "next/link";
import { requireUser } from "../auth";
import { AppShell } from "../components/AppShell";
import { Pagination } from "../components/Pagination";
import { getDb } from "../../db";
import { financeRecords } from "../../db/schema";
import { FINANCE_TABS, FinanceTab, SGA_CATEGORIES } from "./constants";
import { FinanceExcelDownload } from "./FinanceExcelDownload";

const PAGE_SIZE = 25;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser("/finance");
  const params = await searchParams;
  const view = normalizeView(single(params.view));
  const month = normalizeMonth(single(params.month));
  const page = Math.max(1, Number.parseInt(single(params.page) || "1", 10) || 1);
  const db = await getDb();
  const where = month
    ? and(gte(financeRecords.transactionDate, `${month}-01`), lte(financeRecords.transactionDate, `${month}-31`))
    : undefined;
  const allRows = await db.select().from(financeRecords).where(where).orderBy(desc(financeRecords.transactionDate), desc(financeRecords.transactionTime), asc(financeRecords.sourceSheet));

  const incomeRows = allRows.filter((row) => row.direction === "income");
  const outcomeRows = allRows.filter((row) => row.direction === "outcome");
  const totalIncome = sum(incomeRows);
  const totalOutcome = sum(outcomeRows);
  const filteredRows = view === "income" ? incomeRows : view === "stock"
    ? outcomeRows.filter((row) => row.financeCategory === "Stock & Penjualan")
    : view === "sga" ? outcomeRows.filter((row) => SGA_CATEGORIES.includes(row.financeCategory as never)) : [];
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <AppShell>
      <section className="finance-page">
        <header className="finance-header">
          <div><p className="eyebrow">Financial ledger</p><h1>Finance</h1><p>Ringkasan arus kas dari transaksi yang telah direkonsiliasi.</p></div>
          <form className="finance-period" method="get">
            <input name="view" type="hidden" value={view} />
            <label htmlFor="finance-month">Periode</label>
            <input defaultValue={month} id="finance-month" name="month" type="month" />
            <button type="submit">Terapkan</button>
          </form>
        </header>

        <nav aria-label="Finance views" className="finance-tabs">
          {FINANCE_TABS.map((tab) => <Link className={view === tab.key ? "active" : ""} href={tabHref(tab.key, month)} key={tab.key}>{tab.label}</Link>)}
        </nav>

        {view === "summary" ? (
          <FinanceSummary income={totalIncome} outcome={totalOutcome} rows={allRows} />
        ) : (
          <LedgerView allRows={filteredRows} rows={pageRows} currentPage={safePage} params={params} totalItems={filteredRows.length} view={view} />
        )}
      </section>
    </AppShell>
  );
}

function FinanceSummary({ income, outcome, rows }: { income: number; outcome: number; rows: Array<typeof financeRecords.$inferSelect> }) {
  const net = income - outcome;
  const outcomes = rows.filter((row) => row.direction === "outcome");
  const byCategory = Array.from(outcomes.reduce((map, row) => map.set(row.financeCategory, (map.get(row.financeCategory) || 0) + row.amount), new Map<string, number>()))
    .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const maxCategory = Math.max(...byCategory.map((item) => item.value), 1);
  const byDay = Array.from(rows.reduce((map, row) => {
    const item = map.get(row.transactionDate) || { income: 0, outcome: 0 };
    item[row.direction] += row.amount; map.set(row.transactionDate, item); return map;
  }, new Map<string, { income: number; outcome: number }>())).sort(([a], [b]) => a.localeCompare(b));
  const maxDay = Math.max(...byDay.flatMap(([, item]) => [item.income, item.outcome]), 1);

  return <>
    <div className="finance-metrics">
      <Metric label="Total Income" tone="income" value={income} />
      <Metric label="Total Outcome" tone="outcome" value={outcome} />
      <Metric label="Net Cash Flow" tone={net >= 0 ? "income" : "outcome"} value={net} />
      <Metric label="Transaksi" tone="neutral" value={rows.length} numeric />
    </div>
    <div className="finance-visual-grid">
      <article className="finance-panel finance-cashflow"><div className="finance-panel-heading"><div><h2>Arus Kas Harian</h2><p>Perbandingan income dan outcome per tanggal</p></div><span className="chart-legend"><i className="income" /> Income <i className="outcome" /> Outcome</span></div>
        <div className="cashflow-chart">{byDay.length ? byDay.map(([date, item]) => <div className="cashflow-day" key={date} title={`${date}: masuk ${money(item.income)}, keluar ${money(item.outcome)}`}><div className="cashflow-bars"><i className="income" style={{ height: `${Math.max(2, item.income / maxDay * 100)}%` }} /><i className="outcome" style={{ height: `${Math.max(2, item.outcome / maxDay * 100)}%` }} /></div><span>{date.slice(-2)}</span></div>) : <p className="finance-empty">Belum ada data pada periode ini.</p>}</div>
      </article>
      <article className="finance-panel"><div className="finance-panel-heading"><div><h2>Komposisi Outcome</h2><p>Pengeluaran berdasarkan kategori</p></div></div>
        <div className="finance-ranking">{byCategory.length ? byCategory.map((item) => <div key={item.name}><div><span>{item.name}</span><strong>{money(item.value)}</strong></div><i><b style={{ width: `${item.value / maxCategory * 100}%` }} /></i></div>) : <p className="finance-empty">Belum ada outcome.</p>}</div>
      </article>
    </div>
  </>;
}

function Metric({ label, tone, value, numeric = false }: { label: string; tone: string; value: number; numeric?: boolean }) {
  return <article className={`finance-metric ${tone}`}><span>{label}</span><strong>{numeric ? value.toLocaleString("id-ID") : money(value)}</strong></article>;
}

function LedgerView({ allRows, rows, currentPage, params, totalItems, view }: { allRows: Array<typeof financeRecords.$inferSelect>; rows: Array<typeof financeRecords.$inferSelect>; currentPage: number; params: Record<string, string | string[] | undefined>; totalItems: number; view: FinanceTab }) {
  const title = FINANCE_TABS.find((tab) => tab.key === view)?.label || "Finance";
  return <article className="finance-panel ledger-panel"><div className="finance-panel-heading"><div><h2>{title}</h2><p>{totalItems.toLocaleString("id-ID")} transaksi · {money(sum(allRows))} total ledger</p></div>{view === "sga" ? <FinanceExcelDownload rows={allRows} /> : null}</div>
    <div className="customer-table-wrap"><table className="customer-table finance-table"><thead><tr><th>Tanggal</th><th>Sumber</th><th>Keterangan</th><th>Tujuan</th><th>Kategori</th><th>Nominal</th></tr></thead>
      <tbody>{rows.length ? rows.map((row) => <tr key={row.id}><td><strong>{dateLabel(row.transactionDate)}</strong><small>{row.transactionTime}</small></td><td>{row.sourceSheet}<small>{row.sourceDocument || `Baris ${row.sourceRow}`}</small></td><td>{row.description || "-"}</td><td>{row.counterparty || "-"}</td><td><span className={`finance-badge ${row.direction}`}>{row.financeCategory}</span></td><td className="numeric-cell"><strong>{row.direction === "income" ? "+" : "−"}{money(row.amount)}</strong></td></tr>) : <tr><td colSpan={6}>Belum ada transaksi pada periode ini.</td></tr>}</tbody></table>
      <Pagination currentPage={currentPage} params={params} totalItems={totalItems} />
    </div>
  </article>;
}

function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
function normalizeView(value: string): FinanceTab { return FINANCE_TABS.some((tab) => tab.key === value) ? value as FinanceTab : "summary"; }
function normalizeMonth(value: string) { return /^\d{4}-\d{2}$/.test(value) ? value : ""; }
function sum(rows: Array<{ amount: number }>) { return rows.reduce((total, row) => total + row.amount, 0); }
function money(value: number) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value); }
function dateLabel(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function tabHref(view: FinanceTab, month: string) { const query = new URLSearchParams({ view }); if (month) query.set("month", month); return `/finance?${query}`; }
