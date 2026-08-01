import Link from "next/link";
import { AppShell } from "../../components/AppShell";
import { ConfirmForm } from "../../components/ConfirmForm";
import { getCurrentPage, paginateRows, Pagination } from "../../components/Pagination";
import { listAssets, updateAssetTrackingAction } from "../data";

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
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export default async function AssetListPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = getSearchParam(params, "q").trim().toLowerCase();
  const categoryFilter = getSearchParam(params, "category");
  const statusFilter = getSearchParam(params, "status");
  const rows = await listAssets();
  const categoryOptions = [...new Set(rows.map((row) => row.category))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const statusOptions = [...new Set(rows.map((row) => row.status))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const filteredRows = rows.filter((row) => {
    const matchesQuery =
      !query ||
      [
        row.assetCode,
        row.itemName,
        row.category,
        row.currentOrLastPic,
        row.location,
        row.condition,
        row.status,
        row.notes,
      ].some((value) => textMatches(value, query));
    const matchesCategory = !categoryFilter || row.category === categoryFilter;
    const matchesStatus = !statusFilter || row.status === statusFilter;

    return matchesQuery && matchesCategory && matchesStatus;
  });
  const { pageRows, safePage } = paginateRows(filteredRows, getCurrentPage(params));

  return (
    <AppShell>
      <section className="sph-list-page">
        <div className="dashboard-header">
          <div>
            <p className="page-kicker">Operasional</p>
            <h1>List Asset</h1>
          </div>
          <Link className="primary-button" href="/asset/add-new-asset">
            Add new asset
          </Link>
        </div>

        <form className="table-filter-bar">
          <label>
            <span>Search</span>
            <input
              name="q"
              placeholder="Kode, barang, PIC, lokasi"
              defaultValue={getSearchParam(params, "q")}
            />
          </label>
          <label>
            <span>Kategori</span>
            <select name="category" defaultValue={categoryFilter}>
              <option value="">Semua Kategori</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
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
            <Link href="/asset/asset-list">Reset</Link>
          </div>
        </form>

        <div className="customer-table-wrap">
          <table className="customer-table asset-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Barang</th>
                <th>Kategori</th>
                <th>Nilai</th>
                <th>PIC / Lokasi</th>
                <th>Kondisi</th>
                <th>Status</th>
                <th>Tanggal Perolehan</th>
                <th>Catatan</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length > 0 ? (
                pageRows.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <strong className="table-primary">{asset.assetCode}</strong>
                    </td>
                    <td>{asset.itemName}</td>
                    <td>{asset.category || "-"}</td>
                    <td>{formatRupiah(asset.assetValue)}</td>
                    <td>
                      <div className="stacked-cell">
                        <strong>{asset.currentOrLastPic || "-"}</strong>
                        <span>{asset.location}</span>
                      </div>
                    </td>
                    <td>{asset.condition}</td>
                    <td>{asset.status}</td>
                    <td>{formatDate(asset.acquisitionDate)}</td>
                    <td>{asset.notes || "-"}</td>
                    <td>
                      <ConfirmForm
                        action={updateAssetTrackingAction}
                        className="asset-inline-form"
                        confirmMessage={`Simpan perubahan tracking asset ${asset.assetCode}?`}
                      >
                        <input name="id" type="hidden" value={asset.id} />
                        <input
                          aria-label={`PIC ${asset.assetCode}`}
                          name="currentOrLastPic"
                          placeholder="PIC"
                          defaultValue={asset.currentOrLastPic}
                        />
                        <input
                          aria-label={`Lokasi ${asset.assetCode}`}
                          name="location"
                          placeholder="Lokasi"
                          defaultValue={asset.location}
                        />
                        <input
                          aria-label={`Kondisi ${asset.assetCode}`}
                          name="condition"
                          placeholder="Kondisi"
                          defaultValue={asset.condition}
                        />
                        <input
                          aria-label={`Status ${asset.assetCode}`}
                          name="status"
                          placeholder="Status"
                          defaultValue={asset.status}
                        />
                        <input
                          aria-label={`Catatan ${asset.assetCode}`}
                          name="notes"
                          placeholder="Catatan"
                          defaultValue={asset.notes}
                        />
                        <button type="submit">Save</button>
                      </ConfirmForm>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10}>Tidak ada asset sesuai filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={safePage} params={params} totalItems={filteredRows.length} />
      </section>
    </AppShell>
  );
}
