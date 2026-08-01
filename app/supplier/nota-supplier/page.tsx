import Link from "next/link";
import { AppShell } from "../../components/AppShell";
import { DateRangeFilter } from "../../components/DateRangeFilter";
import { getCurrentPage, paginateRows, Pagination } from "../../components/Pagination";
import { listSupplierNotes } from "../notes/data";
import { SupplierNotesTable } from "./SupplierNotesTable";

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

function isWithinDateRange(value: string | null, from: string, to: string) {
  if (!value) {
    return !from && !to;
  }

  const dateValue = value.slice(0, 10);
  return (!from || dateValue >= from) && (!to || dateValue <= to);
}

export default async function SupplierNotesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = getSearchParam(params, "q").trim().toLowerCase();
  const paymentFilter = getSearchParam(params, "payment");
  const flagFilter = getSearchParam(params, "flag");
  const categoryFilter = getSearchParam(params, "category");
  const fromDate = getSearchParam(params, "from");
  const toDate = getSearchParam(params, "to");
  const notes = await listSupplierNotes();
  const paymentOptions = [...new Set(notes.map((note) => note.paymentStatus))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const flagOptions = [...new Set(notes.map((note) => note.flag))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const categoryOptions = [...new Set(notes.map((note) => note.category))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const filteredNotes = notes.filter((note) => {
    const matchesQuery =
      !query ||
      [
        note.noteNo,
        note.supplierName,
        note.category,
        note.flag,
        note.paymentStatus,
        note.paymentTerm,
        note.purchasePurpose,
        note.customerName,
        note.sourceFileName,
        note.invoiceFileName,
        note.invoiceFileUrl,
        note.paymentProofFileName,
        note.paymentProofFileUrl,
        ...note.paymentProofFiles.flatMap((file) => [file.name, file.url]),
        ...note.items.flatMap((item) => [item.partNumber, item.description]),
      ].some((value) => textMatches(value, query));
    const matchesPayment =
      !paymentFilter ||
      (paymentFilter === "OUTSTANDING"
        ? note.paymentStatus === "BELUM BAYAR" || note.paymentStatus === "DP"
        : note.paymentStatus === paymentFilter);
    const matchesFlag = !flagFilter || note.flag === flagFilter;
    const matchesCategory = !categoryFilter || note.category === categoryFilter;
    const matchesDate = isWithinDateRange(note.noteDate, fromDate, toDate);

    return matchesQuery && matchesPayment && matchesFlag && matchesCategory && matchesDate;
  });
  const { pageRows, safePage } = paginateRows(filteredNotes, getCurrentPage(params));

  return (
    <AppShell>
      <section className="sph-list-page">
        <div className="dashboard-header">
          <div>
            <p className="page-kicker">Supplier</p>
            <h1>List Nota Supplier</h1>
          </div>
        </div>

        <form className="table-filter-bar">
          <label>
            <span>Search</span>
            <input
              name="q"
              placeholder="No nota, supplier, item, file"
              defaultValue={getSearchParam(params, "q")}
            />
          </label>
          <label>
            <span>Payment</span>
            <select name="payment" defaultValue={paymentFilter}>
              <option value="">Semua Payment</option>
              <option value="OUTSTANDING">Belum Terbayar</option>
              {paymentOptions.map((payment) => (
                <option key={payment} value={payment}>
                  {payment}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Flag</span>
            <select name="flag" defaultValue={flagFilter}>
              <option value="">Semua Flag</option>
              {flagOptions.map((flag) => (
                <option key={flag} value={flag}>
                  {flag}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Category</span>
            <select name="category" defaultValue={categoryFilter}>
              <option value="">Semua Category</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <DateRangeFilter from={fromDate} to={toDate} />
          <div className="table-filter-actions">
            <button type="submit">Filter</button>
            <Link href="/supplier/nota-supplier">Reset</Link>
          </div>
        </form>

        <SupplierNotesTable
          key={[
            query,
            paymentFilter,
            flagFilter,
            categoryFilter,
            fromDate,
            toDate,
            safePage,
          ].join("|")}
          notes={pageRows}
        />
        <Pagination
          currentPage={safePage}
          params={params}
          totalItems={filteredNotes.length}
        />
      </section>
    </AppShell>
  );
}
