import Link from "next/link";
import { requireSuperadmin } from "../../auth";
import { AppShell } from "../../components/AppShell";
import { ConfirmForm } from "../../components/ConfirmForm";
import { getCurrentPage, paginateRows, Pagination } from "../../components/Pagination";
import {
  createSalaryPaymentAction,
  deleteEmployeeAction,
  getCurrentSalaryMonth,
  getJakartaDateKey,
  getReminderSalaryMonth,
  getSalaryDueDate,
  getBonusOmsetForSalaryMonth,
  isSalaryDue,
  listEmployeesWithSalaryStatus,
  listSalaryPayments,
} from "../data";

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
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
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
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function EmployeeListPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperadmin("/employee/employee-list");

  const params = (await searchParams) ?? {};
  const currentSalaryMonth = getCurrentSalaryMonth();
  const reminderSalaryMonth = getReminderSalaryMonth();
  const selectedMonth = getSearchParam(params, "month") || reminderSalaryMonth;
  const query = getSearchParam(params, "q").trim().toLowerCase();
  const statusFilter = getSearchParam(params, "status");
  const today = getJakartaDateKey();
  const dueDate = getSalaryDueDate(selectedMonth);
  const dueNow = selectedMonth < currentSalaryMonth || isSalaryDue(selectedMonth, today);
  const [employeeRows, recentPayments, bonusContext] = await Promise.all([
    listEmployeesWithSalaryStatus(selectedMonth),
    listSalaryPayments(),
    getBonusOmsetForSalaryMonth(selectedMonth),
  ]);
  const statusOptions = [...new Set(employeeRows.map((row) => row.status))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const activeRows = employeeRows.filter((row) => row.status !== "Nonaktif");
  const unpaidCount = activeRows.filter((row) => !row.salaryPayment).length;
  const totalDue = activeRows
    .filter((row) => !row.salaryPayment)
    .reduce((sum, row) => sum + row.salary, 0);
  const filteredRows = employeeRows.filter((row) => {
    const matchesQuery =
      !query ||
      [
        row.name,
        row.title,
        row.jobdesk,
        row.accountNumber,
        row.status,
      ].some((value) => textMatches(value, query));
    const matchesStatus = !statusFilter || row.status === statusFilter;

    return matchesQuery && matchesStatus;
  });
  const { pageRows, safePage } = paginateRows(filteredRows, getCurrentPage(params));

  return (
    <AppShell>
      <section className="sph-list-page">
        <div className="dashboard-header">
          <div>
            <p className="page-kicker">Employee</p>
            <h1>Employee</h1>
          </div>
          <Link className="primary-button" href="/employee/add-new-employee">
            Add new employee
          </Link>
        </div>

        <div className="asset-summary employee-summary">
          <div>
            <span>Reminder Penggajian</span>
            <strong>{formatDate(dueDate)}</strong>
          </div>
          <div>
            <span>Status Reminder</span>
            <strong>{dueNow && unpaidCount > 0 ? `${unpaidCount} belum dibayar` : "Aman"}</strong>
          </div>
          <div>
            <span>Estimasi Gaji Belum Dibayar</span>
            <strong>{formatRupiah(totalDue)}</strong>
          </div>
        </div>

        <form className="table-filter-bar">
          <label>
            <span>Search</span>
            <input
              name="q"
              placeholder="Nama, title, jobdesk, rekening"
              defaultValue={getSearchParam(params, "q")}
            />
          </label>
          <label>
            <span>Bulan Gaji</span>
            <input name="month" type="month" defaultValue={selectedMonth} />
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
            <Link href="/employee/employee-list">Reset</Link>
          </div>
        </form>

        <div className="customer-table-wrap">
          <table className="customer-table employee-table" data-sortable-table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Title</th>
                <th>Jobdesk</th>
                <th>Gaji</th>
                <th>Nomor Rekening</th>
                <th>Status Gaji</th>
                <th>Tanggal Bayar</th>
                <th>Bonus Omset</th>
                <th>Bonus Lain</th>
                <th>Potongan</th>
                <th>Catatan</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length > 0 ? (
                pageRows.map((employee) => {
                  const salaryFormId = `salary-payment-${employee.id}`;
                  const bonusOmset =
                    employee.salaryPayment?.commissionAmount ?? bonusContext.bonusOmset;

                  return (
                    <tr key={employee.id}>
                      <td>
                        <strong className="table-primary">{employee.name}</strong>
                      </td>
                      <td>{employee.title}</td>
                      <td>{employee.jobdesk}</td>
                      <td className="numeric-cell">{formatRupiah(employee.salary)}</td>
                      <td>{employee.accountNumber}</td>
                      <td>
                        {employee.salaryPayment ? (
                          <span className="supplier-payment-status lunas">Lunas</span>
                        ) : dueNow && employee.status !== "Nonaktif" ? (
                          <span className="supplier-payment-status belum-bayar">Due</span>
                        ) : (
                          <span className="supplier-payment-status neutral">Belum due</span>
                        )}
                      </td>
                      <td>
                        <input
                          aria-label={`Tanggal bayar ${employee.name}`}
                          className="employee-inline-input date"
                          defaultValue={employee.salaryPayment?.paymentDate ?? today}
                          form={salaryFormId}
                          name="paymentDate"
                          required
                          type="date"
                        />
                      </td>
                      <td className="numeric-cell">
                        <strong>{formatRupiah(bonusOmset)}</strong>
                      </td>
                      <td>
                        <input
                          aria-label={`Bonus tambahan ${employee.name}`}
                          className="employee-inline-input money"
                          defaultValue={employee.salaryPayment?.additionalBonus ?? 0}
                          form={salaryFormId}
                          inputMode="numeric"
                          name="additionalBonus"
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Potongan ${employee.name}`}
                          className="employee-inline-input money"
                          defaultValue={employee.salaryPayment?.deduction ?? 0}
                          form={salaryFormId}
                          inputMode="numeric"
                          name="deduction"
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Catatan ${employee.name}`}
                          className="employee-inline-input note"
                          defaultValue={employee.salaryPayment?.notes ?? ""}
                          form={salaryFormId}
                          name="notes"
                          placeholder="Optional"
                        />
                      </td>
                      <td>
                        <div className="table-actions employee-actions">
                          <ConfirmForm
                            action={createSalaryPaymentAction}
                            confirmMessage={`Catat pembayaran gaji ${employee.name} untuk ${selectedMonth}?`}
                            id={salaryFormId}
                          >
                            <input name="employeeId" type="hidden" value={employee.id} />
                            <input name="salaryMonth" type="hidden" value={selectedMonth} />
                            <input name="baseSalary" type="hidden" value={employee.salary} />
                            <button type="submit">Bayar Gaji</button>
                          </ConfirmForm>
                          <Link href={`/employee/edit-employee/${employee.id}`}>Edit</Link>
                          <ConfirmForm
                            action={deleteEmployeeAction}
                            confirmMessage={`Hapus employee ${employee.name}? Riwayat gajinya juga ikut terhapus.`}
                          >
                            <input name="id" type="hidden" value={employee.id} />
                            <button type="submit">Hapus</button>
                          </ConfirmForm>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12}>Tidak ada employee sesuai filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={safePage} params={params} totalItems={filteredRows.length} />

        <section className="shipment-batch-section">
          <div className="section-heading compact">
            <div>
              <h2>Riwayat Pembayaran Gaji</h2>
              <p>Menampilkan 20 pembayaran terbaru.</p>
            </div>
          </div>
          <div className="customer-table-wrap">
            <table className="customer-table employee-history-table" data-sortable-table>
              <thead>
                <tr>
                  <th>Bulan</th>
                  <th>Tanggal Bayar</th>
                  <th>Nama</th>
                  <th>Gaji</th>
                  <th>Bonus Omset</th>
                  <th>Bonus Lain</th>
                  <th>Potongan</th>
                  <th>Total Dibayar</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.slice(0, 20).map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.salaryMonth}</td>
                    <td>{formatDate(payment.paymentDate)}</td>
                    <td>{payment.employeeName ?? "-"}</td>
                    <td className="numeric-cell">{formatRupiah(payment.baseSalary)}</td>
                    <td className="numeric-cell">
                      {formatRupiah(payment.commissionAmount)}
                    </td>
                    <td className="numeric-cell">{formatRupiah(payment.additionalBonus)}</td>
                    <td className="numeric-cell">{formatRupiah(payment.deduction)}</td>
                    <td className="numeric-cell">{formatRupiah(payment.totalPaid)}</td>
                    <td>{payment.notes || "-"}</td>
                  </tr>
                ))}
                {recentPayments.length === 0 ? (
                  <tr>
                    <td colSpan={9}>Belum ada riwayat pembayaran gaji.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </AppShell>
  );
}
