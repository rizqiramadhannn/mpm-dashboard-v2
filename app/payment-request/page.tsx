import Link from "next/link";
import { AppShell } from "../components/AppShell";
import { ConfirmForm } from "../components/ConfirmForm";
import { getCurrentPage, paginateRows, Pagination } from "../components/Pagination";
import { requireUser } from "../auth";
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

        <div className="customer-table-wrap">
          <table className="customer-table payment-request-table">
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
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length > 0 ? (
                pageRows.map((row, index) => {
                  const formId = `payment-request-${row.id}`;

                  return (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>
                        <input
                          className="inline-date-input"
                          form={formId}
                          name="requestDate"
                          required
                          type="date"
                          defaultValue={row.requestDate}
                        />
                      </td>
                      <td>{row.requestedByUsername || "-"}</td>
                      <td>
                        <input
                          className="inline-text-input"
                          form={formId}
                          name="sourceFund"
                          required
                          defaultValue={row.sourceFund}
                        />
                      </td>
                      <td>
                        <input
                          className="inline-money-input"
                          form={formId}
                          inputMode="numeric"
                          name="amount"
                          required
                          defaultValue={formatRupiah(row.amount)}
                        />
                      </td>
                      <td>
                        <input
                          className="inline-text-input"
                          form={formId}
                          name="destinationAccount"
                          required
                          defaultValue={row.destinationAccount}
                        />
                      </td>
                      <td>
                        <input
                          className="inline-text-input wide"
                          form={formId}
                          name="description"
                          required
                          defaultValue={row.description}
                        />
                      </td>
                      <td>
                        <input
                          className="inline-text-input wide"
                          form={formId}
                          name="transactionPurpose"
                          required
                          defaultValue={row.transactionPurpose}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Status ${row.description}`}
                          className="inline-status-input"
                          form={formId}
                          name="status"
                          placeholder="-"
                          defaultValue={row.status}
                        />
                      </td>
                      <td>
                        <div className="table-actions">
                          <ConfirmForm
                            action={updatePaymentRequestAction}
                            confirmMessage={`Simpan perubahan payment request ${row.description}?`}
                            id={formId}
                          >
                            <input name="id" type="hidden" value={row.id} />
                            <button className="inline-save-button" type="submit">
                              Save
                            </button>
                          </ConfirmForm>
                          {canDelete ? (
                            <ConfirmForm
                              action={deletePaymentRequestAction}
                              confirmMessage={`Hapus payment request ${row.description}?`}
                            >
                              <input name="id" type="hidden" value={row.id} />
                              <button className="danger" type="submit">
                                Delete
                              </button>
                            </ConfirmForm>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10}>Belum ada payment request sesuai filter.</td>
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
