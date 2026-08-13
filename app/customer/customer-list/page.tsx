import { AppShell } from "../../components/AppShell";
import { getCurrentPage, paginateRows, Pagination } from "../../components/Pagination";
import { CustomerForm } from "../components/CustomerForm";
import { listCustomers } from "../data";
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

export default async function CustomerListPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = getSearchParam(params, "q").trim().toLowerCase();
  const provinceFilter = getSearchParam(params, "province");
  const customerRows = await listCustomers();
  const provinceOptions = [...new Set(customerRows.map((customer) => customer.detailLine2))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const filteredRows = customerRows.filter((customer) => {
    const matchesQuery =
      !query ||
      [
        customer.code,
        customer.name,
        customer.detailLine1,
        customer.detailLine2,
        customer.detailLine3,
        customer.contactName,
        customer.phone,
      ].some((value) => textMatches(value, query));
    const matchesProvince = !provinceFilter || customer.detailLine2 === provinceFilter;

    return matchesQuery && matchesProvince;
  });
  const { pageRows, safePage } = paginateRows(filteredRows, getCurrentPage(params));

  return (
    <AppShell>
      <CustomerForm
        customers={pageRows}
        listControls={
          <form className="table-filter-bar">
            <label>
              <span>Search</span>
              <input
                name="q"
                placeholder="Kode, nama, lokasi, kontak, nomor HP"
                defaultValue={getSearchParam(params, "q")}
              />
            </label>
            <label>
              <span>Detail 2</span>
              <select name="province" defaultValue={provinceFilter}>
                <option value="">Semua Detail 2</option>
                {provinceOptions.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </label>
            <div className="table-filter-actions">
              <button type="submit">Filter</button>
              <Link href="/customer/customer-list">Reset</Link>
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
        showForm={false}
      />
    </AppShell>
  );
}
