import { desc } from "drizzle-orm";
import { AppShell } from "../components/AppShell";
import {
  DEFAULT_PAGE_SIZE,
  getCurrentPage,
  paginateRows,
  Pagination,
} from "../components/Pagination";
import { getDb } from "../../db";
import { paymentRequests } from "../../db/schema";

export const dynamic = "force-dynamic";

type SgaRow = {
  amount: number;
  description: string;
  destinationAccount: string;
  id: string;
  requestDate: string;
  requestedByUsername: string;
  sourceFund: string;
  transactionPurpose: string;
};

function isDoneStatus(status: string) {
  return status.trim().toUpperCase() === "DONE";
}

function formatDate(value: string | null) {
  if (!value) return "-";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
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

function monthLabel(value: string) {
  const date = new Date(`${value.slice(0, 7)}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function rankRows(values: Map<string, number>) {
  const maxValue = Math.max(0, ...values.values());

  return [...values.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({
      name: name || "-",
      percent: maxValue > 0 ? Math.max(4, Math.round((value / maxValue) * 100)) : 0,
      value,
    }));
}

async function getSgaData() {
  const db = await getDb();
  const rows = await db
    .select({
      amount: paymentRequests.amount,
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
    .orderBy(desc(paymentRequests.requestDate), desc(paymentRequests.createdAt));

  const doneRows: SgaRow[] = rows.filter((row) => isDoneStatus(row.status));
  const totalAmount = doneRows.reduce((sum, row) => sum + row.amount, 0);
  const sourceTotals = new Map<string, number>();
  const purposeTotals = new Map<string, number>();
  const monthlyTotals = new Map<string, number>();

  for (const row of doneRows) {
    sourceTotals.set(row.sourceFund, (sourceTotals.get(row.sourceFund) ?? 0) + row.amount);
    purposeTotals.set(
      row.transactionPurpose,
      (purposeTotals.get(row.transactionPurpose) ?? 0) + row.amount
    );

    const key = row.requestDate.slice(0, 7);
    if (key) {
      monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + row.amount);
    }
  }

  const latestMonthKey = [...monthlyTotals.keys()].sort().at(-1) ?? "";
  const latestMonthAmount = latestMonthKey ? monthlyTotals.get(latestMonthKey) ?? 0 : 0;

  return {
    doneRows,
    latestMonth: latestMonthKey ? monthLabel(latestMonthKey) : "-",
    latestMonthAmount,
    sourceRankings: rankRows(sourceTotals),
    totalAmount,
    totalRequests: doneRows.length,
    transactionRankings: rankRows(purposeTotals),
  };
}

export default async function SgaPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const data = await getSgaData();
  const { pageRows, safePage } = paginateRows(data.doneRows, getCurrentPage(params));

  return (
    <AppShell>
      <section className="sph-list-page sga-page">
        <div className="dashboard-header">
          <div>
            <p className="page-kicker">Finance</p>
            <h1>SGA</h1>
          </div>
          <div className="dashboard-period">Status DONE</div>
        </div>

        <div className="stats-grid">
          <article className="metric-card">
            <p>Total SGA</p>
            <strong>{formatCompactMoney(data.totalAmount)}</strong>
            <span className="metric-change neutral">{data.totalRequests} payment request</span>
          </article>
          <article className="metric-card">
            <p>Bulan Terakhir</p>
            <strong>{formatCompactMoney(data.latestMonthAmount)}</strong>
            <span className="metric-change neutral">{data.latestMonth}</span>
          </article>
          <article className="metric-card">
            <p>Rata-rata Request</p>
            <strong>
              {formatCompactMoney(
                data.totalRequests > 0 ? Math.round(data.totalAmount / data.totalRequests) : 0
              )}
            </strong>
            <span className="metric-change neutral">Dari request DONE</span>
          </article>
        </div>

        <div className="dashboard-grid sga-summary-grid">
          <RankingCard
            emptyText="Belum ada payment request DONE."
            items={data.sourceRankings}
            title="Sumber Dana"
          />
          <RankingCard
            emptyText="Belum ada payment request DONE."
            items={data.transactionRankings}
            title="Tujuan Transaksi"
          />
        </div>

        <div className="customer-table-wrap">
          <table className="customer-table sga-table" data-sortable-table>
            <thead>
              <tr>
                <th>No</th>
                <th>Tanggal</th>
                <th>Diajukan Oleh</th>
                <th>Sumber Dana</th>
                <th>Nominal</th>
                <th>Rek Tujuan</th>
                <th>Deskripsi</th>
                <th>Tujuan Transaksi</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length > 0 ? (
                pageRows.map((row, index) => (
                  <tr key={row.id}>
                    <td>{(safePage - 1) * DEFAULT_PAGE_SIZE + index + 1}</td>
                    <td>{formatDate(row.requestDate)}</td>
                    <td>{row.requestedByUsername || "-"}</td>
                    <td>{row.sourceFund || "-"}</td>
                    <td className="numeric-cell">{formatMoney(row.amount)}</td>
                    <td>{row.destinationAccount || "-"}</td>
                    <td>{row.description || "-"}</td>
                    <td>{row.transactionPurpose || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>Belum ada payment request dengan status DONE.</td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination
            currentPage={safePage}
            params={params}
            totalItems={data.doneRows.length}
          />
        </div>
      </section>
    </AppShell>
  );
}

function RankingCard({
  emptyText,
  items,
  title,
}: {
  emptyText: string;
  items: Array<{ name: string; percent: number; value: number }>;
  title: string;
}) {
  return (
    <article className="dashboard-card">
      <div className="card-heading">
        <div>
          <h2>{title}</h2>
          <p>Berdasarkan payment request DONE</p>
        </div>
      </div>
      <div className="ranking-list">
        {items.length > 0 ? (
          items.map((item, index) => (
            <div className="ranking-item" key={`${item.name}-${index}`}>
              <div className="ranking-row">
                <span>
                  {index + 1}. {item.name}
                </span>
                <strong>{formatCompactMoney(item.value)}</strong>
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
