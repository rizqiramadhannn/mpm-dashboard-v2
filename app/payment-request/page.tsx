import Link from "next/link";
import { AppShell } from "../components/AppShell";
import { ConfirmForm } from "../components/ConfirmForm";
import { getCurrentPage, paginateRows, Pagination } from "../components/Pagination";
import { requireUser } from "../auth";
import { PaymentRequestTable } from "./PaymentRequestTable";
import {
  createPaymentRequestAction,
  deletePaymentRequestAction,
  listPaymentRequests,
  updatePaymentRequestAction,
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
  const [currentUser, rows] = await Promise.all([
    requireUser("/payment-request"),
    listPaymentRequests(),
  ]);
  const canDelete = currentUser.role === "superadmin";
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
        row.requestedByUsername,
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

        <PaymentRequestTable
          canDelete={canDelete}
          deleteAction={deletePaymentRequestAction}
          rows={pageRows}
          updateAction={updatePaymentRequestAction}
        />
        <Pagination
          currentPage={safePage}
          params={params}
          totalItems={filteredRows.length}
        />
      </section>
    </AppShell>
  );
}
