import { and, asc, desc, gte, lte } from "drizzle-orm";
import Link from "next/link";
import { requireUser } from "../auth";
import { AppShell } from "../components/AppShell";
import { Pagination } from "../components/Pagination";
import { getDb } from "../../db";
import { financeRecords } from "../../db/schema";
import { FINANCE_CATEGORIES, FINANCE_TABS, FinanceTab, SGA_CATEGORIES } from "./constants";
import { FinanceExcelDownload } from "./FinanceExcelDownload";
import { moveFinanceRecordAction } from "./data";

const PAGE_SIZE = 25;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser("/finance");
  const params = await searchParams;
  const view = normalizeView(single(params.view));
  const month = normalizeMonth(single(params.month));
  const page = Math.max(1, Number.parseInt(single(params.page) || "1", 10) || 1);
  const query = single(params.q).trim();
  const source = single(params.source).trim();
  const category = single(params.category).trim();
  const db = await getDb();
  const where = month
    ? and(gte(financeRecords.transactionDate, `${month}-01`), lte(financeRecords.transactionDate, `${month}-31`))
    : undefined;
  const allRows = await db.select().from(financeRecords).where(where).orderBy(desc(financeRecords.transactionDate), desc(financeRecords.transactionTime), asc(financeRecords.sourceSheet));
  const previousRange = month ? previousMonthRange(month) : null;
  const previousRows = previousRange
    ? await db.select().from(financeRecords).where(and(
      gte(financeRecords.transactionDate, previousRange.start),
      lte(financeRecords.transactionDate, previousRange.end)
    ))
    : [];

  const incomeRows = allRows.filter((row) => row.direction === "income");
  const outcomeRows = allRows.filter((row) => row.direction === "outcome");
  const totalIncome = sum(incomeRows);
  const totalOutcome = sum(outcomeRows);
  const groupedRows = view === "income" ? incomeRows : view === "stock"
    ? outcomeRows.filter((row) => row.financeCategory === "Stock & Penjualan")
    : view === "sga" ? outcomeRows.filter((row) => SGA_CATEGORIES.includes(row.financeCategory as never)) : [];
  const sources = [...new Set(groupedRows.map((row) => row.sourceSheet))].sort((a, b) => a.localeCompare(b));
  const filteredRows = groupedRows.filter((row) => {
    const matchesQuery = !query || [row.description, row.counterparty, row.sourceSheet, row.sourceDocument, row.financeCategory, row.notes]
      .some((value) => value.toLocaleLowerCase("id-ID").includes(query.toLocaleLowerCase("id-ID")));
    return matchesQuery && (!source || row.sourceSheet === source) && (!category || row.financeCategory === category);
  });
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
          <FinanceSummary income={totalIncome} month={month} outcome={totalOutcome} previousRows={previousRows} rows={allRows} />
        ) : (
          <LedgerView allRows={filteredRows} category={category} currentPage={safePage} params={params} query={query} rows={pageRows} source={source} sources={sources} totalItems={filteredRows.length} view={view} />
        )}
      </section>
    </AppShell>
  );
}

function FinanceSummary({ income, month, outcome, previousRows, rows }: { income: number; month: string; outcome: number; previousRows: Array<typeof financeRecords.$inferSelect>; rows: Array<typeof financeRecords.$inferSelect> }) {
  const net = income - outcome;
  const outcomes = rows.filter((row) => row.direction === "outcome");
  const incomes = rows.filter((row) => row.direction === "income");
  const byCategory = Array.from(outcomes.reduce((map, row) => map.set(row.financeCategory, (map.get(row.financeCategory) || 0) + row.amount), new Map<string, number>()))
    .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const palette = ["#1f806d", "#48b792", "#e6b453", "#e87b6c", "#8e78c7", "#4d82bd", "#bf739b", "#83998f"];
  let donutOffset = 0;
  const donutGradient = byCategory.length ? `conic-gradient(${byCategory.map((item, index) => {
    const start = donutOffset;
    donutOffset += outcome ? item.value / outcome * 100 : 0;
    return `${palette[index % palette.length]} ${start}% ${donutOffset}%`;
  }).join(",")})` : "#e8efed";
  const byDay = Array.from(rows.reduce((map, row) => {
    const item = map.get(row.transactionDate) || { income: 0, outcome: 0 };
    item[row.direction] += row.amount; map.set(row.transactionDate, item); return map;
  }, new Map<string, { income: number; outcome: number }>())).sort(([a], [b]) => a.localeCompare(b));
  const maxDay = Math.max(...byDay.flatMap(([, item]) => [item.income, item.outcome]), 1);
  const incomeSources = ranked(incomes, (row) => row.sourceSheet);
  const maxIncomeSource = incomeSources[0]?.value || 1;
  const sgaRows = outcomes.filter((row) => SGA_CATEGORIES.includes(row.financeCategory as never));
  const sgaTotal = sum(sgaRows);
  const sgaCategories = ranked(sgaRows, (row) => row.financeCategory);
  const topTransactions = [...rows].sort((a, b) => b.amount - a.amount).slice(0, 8);
  const cumulative = cumulativeSeries(rows);
  const cumulativePath = svgPath(cumulative.map((item) => item.value));
  const previousIncome = sum(previousRows.filter((row) => row.direction === "income"));
  const previousOutcome = sum(previousRows.filter((row) => row.direction === "outcome"));
  const previousNet = previousIncome - previousOutcome;
  const ratios = [
    { label: "Net margin", value: income ? net / income : 0, detail: "Net terhadap income" },
    { label: "SGA ratio", value: income ? sgaTotal / income : 0, detail: "SGA terhadap income" },
    { label: "Stock ratio", value: income ? (byCategory.find((item) => item.name === "Stock & Penjualan")?.value || 0) / income : 0, detail: "Stock terhadap income" },
  ];

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
        <div className="outcome-donut-wrap"><div className="outcome-donut" style={{ background: donutGradient }}><div><strong>{percent(outcome && sgaTotal / outcome)}</strong><span>SGA</span></div></div><div className="donut-legend">{byCategory.map((item, index) => <div key={item.name}><i style={{ background: palette[index % palette.length] }} /><span>{item.name}</span><strong>{percent(outcome ? item.value / outcome : 0)}</strong></div>)}</div></div>
      </article>
    </div>

    <div className="finance-visual-grid equal">
      <article className="finance-panel"><div className="finance-panel-heading"><div><h2>Saldo Kumulatif</h2><p>Akumulasi net cash flow selama periode</p></div><strong className={net >= 0 ? "positive-text" : "negative-text"}>{money(net)}</strong></div>
        {cumulative.length ? <div className="cumulative-chart"><svg aria-label="Grafik saldo kumulatif" preserveAspectRatio="none" role="img" viewBox="0 0 600 180"><defs><linearGradient id="financeArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#38a98a" stopOpacity=".38"/><stop offset="1" stopColor="#38a98a" stopOpacity=".03"/></linearGradient></defs><path d={`${cumulativePath} L600 180 L0 180 Z`} fill="url(#financeArea)"/><path d={cumulativePath} fill="none" stroke="#16856c" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"/></svg><div><span>{cumulative[0].date.slice(-2)}</span><span>{cumulative.at(-1)?.date.slice(-2)}</span></div></div> : <p className="finance-empty">Belum ada data.</p>}
      </article>
      <article className="finance-panel"><div className="finance-panel-heading"><div><h2>Sumber Income</h2><p>Rekening atau sheet penerima income</p></div></div><div className="finance-ranking compact">{incomeSources.map((item) => <div key={item.name}><div><span>{item.name}</span><strong>{money(item.value)}</strong></div><i><b className="income-fill" style={{ width: `${item.value / maxIncomeSource * 100}%` }} /></i></div>)}</div></article>
    </div>

    <div className="finance-visual-grid equal">
      <article className="finance-panel"><div className="finance-panel-heading"><div><h2>Breakdown SGA</h2><p>{money(sgaTotal)} · {sgaRows.length} transaksi</p></div></div><div className="sga-stack">{sgaCategories.map((item, index) => <i key={item.name} style={{ background: palette[(index + 2) % palette.length], width: `${sgaTotal ? item.value / sgaTotal * 100 : 0}%` }} title={`${item.name}: ${money(item.value)}`} />)}</div><div className="sga-category-grid">{sgaCategories.map((item, index) => <div key={item.name}><i style={{ background: palette[(index + 2) % palette.length] }} /><span>{item.name}</span><strong>{money(item.value)}</strong></div>)}</div></article>
      <article className="finance-panel"><div className="finance-panel-heading"><div><h2>Rasio Keuangan</h2><p>Proporsi utama terhadap income</p></div></div><div className="ratio-grid">{ratios.map((item) => <div key={item.label}><div><strong>{percent(item.value)}</strong><span>{item.label}</span></div><i><b style={{ width: `${Math.min(Math.abs(item.value) * 100, 100)}%` }} /></i><small>{item.detail}</small></div>)}</div></article>
    </div>

    <div className="finance-visual-grid equal">
      <article className="finance-panel"><div className="finance-panel-heading"><div><h2>Transaksi Terbesar</h2><p>Delapan transaksi dengan nominal tertinggi</p></div></div><div className="top-transactions">{topTransactions.map((row, index) => <div key={row.id}><span className="top-rank">{index + 1}</span><div><strong>{row.description || row.counterparty || "Transaksi"}</strong><small>{dateLabel(row.transactionDate)} · {row.financeCategory}</small></div><b className={row.direction}>{row.direction === "income" ? "+" : "−"}{money(row.amount)}</b></div>)}</div></article>
      <article className="finance-panel"><div className="finance-panel-heading"><div><h2>Perbandingan Periode</h2><p>{month ? "Dibanding bulan sebelumnya" : "Pilih satu bulan untuk membandingkan"}</p></div></div><div className="period-comparison"><Comparison label="Income" current={income} previous={previousIncome} /><Comparison inverse label="Outcome" current={outcome} previous={previousOutcome} /><Comparison label="Net Cash Flow" current={net} previous={previousNet} /></div></article>
    </div>
  </>;
}

function Comparison({ current, inverse = false, label, previous }: { current: number; inverse?: boolean; label: string; previous: number }) {
  const change = previous ? (current - previous) / Math.abs(previous) : null;
  const favorable = change === null ? null : inverse ? change <= 0 : change >= 0;
  return <div><span>{label}</span><strong>{money(current)}</strong><small className={favorable === null ? "neutral-text" : favorable ? "positive-text" : "negative-text"}>{change === null ? "Belum ada data pembanding" : `${change >= 0 ? "↑" : "↓"} ${percent(Math.abs(change))} dari periode lalu`}</small></div>;
}

function Metric({ label, tone, value, numeric = false }: { label: string; tone: string; value: number; numeric?: boolean }) {
  return <article className={`finance-metric ${tone}`}><span>{label}</span><strong>{numeric ? value.toLocaleString("id-ID") : money(value)}</strong></article>;
}

function LedgerView({ allRows, category, rows, currentPage, params, query, source, sources, totalItems, view }: { allRows: Array<typeof financeRecords.$inferSelect>; category: string; rows: Array<typeof financeRecords.$inferSelect>; currentPage: number; params: Record<string, string | string[] | undefined>; query: string; source: string; sources: string[]; totalItems: number; view: FinanceTab }) {
  const title = FINANCE_TABS.find((tab) => tab.key === view)?.label || "Finance";
  const returnTo = `/finance?${new URLSearchParams(Object.entries(params).flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value[0] || "" : value]])).toString()}`;
  return <article className="finance-panel ledger-panel"><div className="finance-panel-heading"><div><h2>{title}</h2><p>{totalItems.toLocaleString("id-ID")} transaksi · {money(sum(allRows))} total ledger</p></div>{view === "sga" ? <FinanceExcelDownload rows={allRows} /> : null}</div>
    <form className="finance-ledger-filters" method="get"><input name="view" type="hidden" value={view} />{single(params.month) ? <input name="month" type="hidden" value={single(params.month)} /> : null}<label><span>Cari transaksi</span><input defaultValue={query} name="q" placeholder="Keterangan, tujuan, sumber..." type="search" /></label><label><span>Sumber</span><select defaultValue={source} name="source"><option value="">Semua sumber</option>{sources.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>{view === "sga" ? <label><span>Kategori</span><select defaultValue={category} name="category"><option value="">Semua kategori SGA</option>{SGA_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label> : null}<button type="submit">Filter</button>{query || source || category ? <Link className="finance-filter-reset" href={tabHref(view, single(params.month))}>Reset</Link> : null}</form>
    <div className="customer-table-wrap"><table className="customer-table finance-table"><thead><tr><th>Tanggal</th><th>Sumber</th><th>Keterangan</th><th>Tujuan</th><th>Kategori / Pindahkan</th><th>Nominal</th></tr></thead>
      <tbody>{rows.length ? rows.map((row) => <tr key={row.id}><td><strong>{dateLabel(row.transactionDate)}</strong><small>{row.transactionTime}</small></td><td>{row.sourceSheet}<small>{row.sourceDocument || `Baris ${row.sourceRow}`}</small></td><td>{row.description || "-"}</td><td>{row.counterparty || "-"}</td><td><form action={moveFinanceRecordAction} className="finance-move-form"><input name="recordId" type="hidden" value={row.id} /><input name="returnTo" type="hidden" value={returnTo} /><select aria-label={`Pindahkan kategori transaksi ${row.description || row.id}`} defaultValue={row.financeCategory} name="financeCategory">{FINANCE_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select><button type="submit">Pindahkan</button></form></td><td className="numeric-cell"><strong>{row.direction === "income" ? "+" : "−"}{money(row.amount)}</strong></td></tr>) : <tr><td colSpan={6}>Tidak ada transaksi yang cocok dengan filter.</td></tr>}</tbody></table>
      <Pagination currentPage={currentPage} params={params} totalItems={totalItems} />
    </div>
  </article>;
}

function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
function normalizeView(value: string): FinanceTab { return FINANCE_TABS.some((tab) => tab.key === value) ? value as FinanceTab : "summary"; }
function normalizeMonth(value: string) { return /^\d{4}-\d{2}$/.test(value) ? value : ""; }
function sum(rows: Array<{ amount: number }>) { return rows.reduce((total, row) => total + row.amount, 0); }
function ranked(rows: Array<typeof financeRecords.$inferSelect>, label: (row: typeof financeRecords.$inferSelect) => string) {
  return Array.from(rows.reduce((map, row) => {
    const name = label(row) || "Tidak tercatat";
    return map.set(name, (map.get(name) || 0) + row.amount);
  }, new Map<string, number>())).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
function cumulativeSeries(rows: Array<typeof financeRecords.$inferSelect>) {
  const days = Array.from(rows.reduce((map, row) => map.set(row.transactionDate, (map.get(row.transactionDate) || 0) + (row.direction === "income" ? row.amount : -row.amount)), new Map<string, number>())).sort(([a], [b]) => a.localeCompare(b));
  let running = 0;
  return days.map(([date, value]) => ({ date, value: running += value }));
}
function svgPath(values: number[]) {
  if (!values.length) return "";
  const min = Math.min(0, ...values); const max = Math.max(0, ...values); const span = Math.max(1, max - min);
  return values.map((value, index) => {
    const x = values.length === 1 ? 300 : index / (values.length - 1) * 600;
    const y = 170 - ((value - min) / span * 150);
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}
function previousMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 2, 1));
  const end = new Date(Date.UTC(year, monthNumber - 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
function percent(value: number) { return new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1 }).format(value); }
function money(value: number) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value); }
function dateLabel(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function tabHref(view: FinanceTab, month: string) { const query = new URLSearchParams({ view }); if (month) query.set("month", month); return `/finance?${query}`; }
