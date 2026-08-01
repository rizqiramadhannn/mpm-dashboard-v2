import Link from "next/link";
import { AppShell } from "../components/AppShell";
import { ConfirmForm } from "../components/ConfirmForm";
import { getCurrentPage, paginateRows, Pagination } from "../components/Pagination";
import {
  createPaymentRequestAction,
  listPaymentRequests,
  updatePaymentRequestStatusAction,
} from "./data";

export const dynamic = "force-dynamic";

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

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value);
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(new Date());
}

export default async function PaymentRequestPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = getSearchParam(params, "q").trim().toLowerCase();
  const sourceFilter = getSearchParam(params, "source");
  const statusFilter = getSearchParam(params, "status");
  const rows = await listPaymentRequests();
  const sourceOptions = [...new Set(rows.map((row) => row.sourceFund))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const statusOptions = [...new Set(rows.map((row) => row.status))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const filteredRows = rows.filter((row) => {
    const matchesQuery =
      !query ||
      [
        row.sourceFund,
        row.destinationAccount,
        row.description,
        row.transactionPurpose,
        row.status,
      ].some((value) => textMatches(value, query));
    const matchesSource = !sourceFilter || row.sourceFund === sourceFilter;
    const matchesStatus = !statusFilter || row.status === statusFilter;

    return matchesQuery && matchesSource && matchesStatus;
  });
  const { pageRows, safePage } = paginateRows(filteredRows, getCurrentPage(params));

  return (
    <AppShell>
      <section className="sph-list-page">
        <div className="dashboard-header">
          <div>
            <p className="page-kicker">Finance</p>
            <h1>Payment Request</h1>
          </div>
          <a className="primary-button" href="/payment-request/download">
            Download Excel
          </a>
        </div>

        <ConfirmForm
          action={createPaymentRequestAction}
          className="payment-request-form"
          confirmMessage="Tambah payment request dengan data ini?"
        >
          <label>
            <span>Tanggal</span>
            <input name="requestDate" required type="date" defaultValue={todayKey()} />
          </label>
          <label>
            <span>Sumber Dana</span>
            <input name="sourceFund" required placeholder="BCA MPM" />
          </label>
          <label>
            <span>Nominal</span>
            <input inputMode="numeric" name="amount" required placeholder="1431200" />
          </label>
          <label>
            <span>Rek Tujuan</span>
            <input name="destinationAccount" required placeholder="Nama / bank tujuan" />
          </label>
          <label>
            <span>Deskripsi</span>
            <input name="description" required placeholder="Bagi Hasil Net Profit 50%" />
          </label>
          <label>
            <span>Tujuan Transaksi</span>
            <input name="transactionPurpose" required placeholder="Bagi hasil AJB 136" />
          </label>
          <label>
            <span>Status</span>
            <input name="status" placeholder="Optional" />
          </label>
          <button type="submit">Tambah Item</button>
        </ConfirmForm>

        <form className="table-filter-bar">
          <label>
            <span>Search</span>
            <input
              name="q"
              placeholder="Sumber dana, rekening, deskripsi"
              defaultValue={getSearchParam(params, "q")}
            />
          </label>
          <label>
            <span>Sumber Dana</span>
            <select name="source" defaultValue={sourceFilter}>
              <option value="">Semua Sumber</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select name="status" defaultValue={statusFilter}>
              <option value="">Semua Status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <div className="table-filter-actions">
            <button type="submit">Filter</button>
            <Link href="/payment-request">Reset</Link>
          </div>
        </form>

        <div className="customer-table-wrap">
          <table className="customer-table payment-request-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Tanggal</th>
                <th>Sumber Dana</th>
                <th>Nominal</th>
                <th>Rek Tujuan</th>
                <th>Deskripsi</th>
                <th>Tujuan Transaksi</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length > 0 ? (
                pageRows.map((row, index) => (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>{formatDate(row.requestDate)}</td>
                    <td>{row.sourceFund}</td>
                    <td className="numeric-cell">{formatRupiah(row.amount)}</td>
                    <td>{row.destinationAccount}</td>
                    <td>{row.description}</td>
                    <td>{row.transactionPurpose}</td>
                    <td>
                      <ConfirmForm
                        action={updatePaymentRequestStatusAction}
                        confirmMessage={`Simpan status payment request ${row.description}?`}
                      >
                        <input name="id" type="hidden" value={row.id} />
                        <input
                          aria-label={`Status ${row.description}`}
                          className="inline-status-input"
                          name="status"
                          placeholder="-"
                          defaultValue={row.status}
                        />
                        <button className="inline-save-button" type="submit">
                          Save
                        </button>
                      </ConfirmForm>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>Belum ada payment request sesuai filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={safePage}
          params={params}
          totalItems={filteredRows.length}
        />
      </section>
    </AppShell>
  );
}
