import { AppShell } from "../../components/AppShell";
import { getCurrentPage, paginateRows, Pagination } from "../../components/Pagination";
import { SupplierList } from "../components/SupplierForm";
import { deleteSupplierAction, listSuppliers } from "../data";
import Link from "next/link";

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

export default async function SupplierListPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = getSearchParam(params, "q").trim().toLowerCase();
  const typeFilter = getSearchParam(params, "type");
  const accountFilter = getSearchParam(params, "account");
  const termFilter = getSearchParam(params, "term");
  const supplierRows = await listSuppliers();
  const typeOptions = [...new Set(supplierRows.map((supplier) => supplier.supplierType))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const accountOptions = [...new Set(supplierRows.map((supplier) => supplier.accountType))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const termOptions = [...new Set(supplierRows.map((supplier) => supplier.defaultPaymentTerm))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const filteredRows = supplierRows.filter((supplier) => {
    const matchesQuery =
      !query ||
      [
        supplier.name,
        supplier.supplierType,
        supplier.suppliedItems,
        supplier.contactPerson,
        supplier.phone,
        supplier.address,
        supplier.accountType,
        supplier.accountNumber,
        supplier.accountName,
        supplier.defaultPaymentTerm,
      ].some((value) => textMatches(value, query));
    const matchesType = !typeFilter || supplier.supplierType === typeFilter;
    const matchesAccount = !accountFilter || supplier.accountType === accountFilter;
    const matchesTerm = !termFilter || supplier.defaultPaymentTerm === termFilter;

    return matchesQuery && matchesType && matchesAccount && matchesTerm;
  });
  const { pageRows, safePage } = paginateRows(filteredRows, getCurrentPage(params));

  return (
    <AppShell>
      <SupplierList
        deleteAction={deleteSupplierAction}
        listControls={
          <form className="table-filter-bar">
            <label>
              <span>Search</span>
              <input
                name="q"
                placeholder="Supplier, jenis, item, PIC, alamat"
                defaultValue={getSearchParam(params, "q")}
              />
            </label>
            <label>
              <span>Jenis</span>
              <select name="type" defaultValue={typeFilter}>
                <option value="">Semua Jenis</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Tipe Rekening</span>
              <select name="account" defaultValue={accountFilter}>
                <option value="">Semua Rekening</option>
                {accountOptions.map((account) => (
                  <option key={account} value={account}>
                    {account}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>TOP</span>
              <select name="term" defaultValue={termFilter}>
                <option value="">Semua TOP</option>
                {termOptions.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </label>
            <div className="table-filter-actions">
              <button type="submit">Filter</button>
              <Link href="/supplier/supplier-list">Reset</Link>
            </div>
          </form>
        }
        pagination={
          <Pagination
            currentPage={safePage}
            params={params}
            totalItems={filteredRows.length}
          />
        }
        suppliers={pageRows}
      />
    </AppShell>
  );
}
