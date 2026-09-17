import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { AppShell } from "../../components/AppShell";
import {
  ConfigurableTable,
  TableCell,
  TableColumnPicker,
  TableHeader,
  TableSpanCell,
} from "../../components/ConfigurableTable";
import { getCurrentPage, paginateRows, Pagination } from "../../components/Pagination";
import { TABLE_COLUMNS } from "../../components/tableDefinitions";
import { getDb } from "../../../db";
import {
  sphDocuments,
  sphImportedItemHistory,
  sphItems,
} from "../../../db/schema";
import {
  itemHistoryMatchesQuery,
  itemHistoryStatus,
  itemHistoryStatusLabel,
} from "./itemHistory";

export const dynamic = "force-dynamic";

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

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
  return `Rp${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

export default async function SphItemHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = getSearchParam(params, "q");
  const db = await getDb();
  const [dashboardRows, importedRows] = await Promise.all([
    db
      .select({
        customerName: sphDocuments.customerName,
        itemId: sphItems.id,
        lineNo: sphItems.lineNo,
        partName: sphItems.partName,
        partNumber: sphItems.partNumber,
        sphDate: sphDocuments.sphDate,
        sphId: sphDocuments.id,
        sphNo: sphDocuments.sphNo,
        status: sphDocuments.status,
        unitPrice: sphItems.unitPrice,
      })
      .from(sphItems)
      .innerJoin(sphDocuments, eq(sphItems.sphId, sphDocuments.id))
      .orderBy(
        desc(sphDocuments.sphDate),
        desc(sphDocuments.sphNo),
        asc(sphItems.lineNo),
        asc(sphItems.id)
      ),
    db
      .select({
        customerName: sphImportedItemHistory.customerName,
        itemId: sphImportedItemHistory.id,
        lineNo: sphImportedItemHistory.sourceRow,
        partName: sphImportedItemHistory.partName,
        partNumber: sphImportedItemHistory.partNumber,
        sphDate: sphImportedItemHistory.sphDate,
        sphNo: sphImportedItemHistory.sphNo,
        status: sphImportedItemHistory.status,
        unitPrice: sphImportedItemHistory.unitPrice,
      })
      .from(sphImportedItemHistory)
      .orderBy(
        desc(sphImportedItemHistory.sphDate),
        desc(sphImportedItemHistory.sphNo),
        asc(sphImportedItemHistory.sourceRow)
      ),
  ]);
  const rows = [
    ...dashboardRows.map((row) => ({ ...row, source: "dashboard" as const })),
    ...importedRows.map((row) => ({ ...row, source: "imported" as const, sphId: null })),
  ].sort(
    (left, right) =>
      right.sphDate.localeCompare(left.sphDate) ||
      right.sphNo.localeCompare(left.sphNo) ||
      left.lineNo - right.lineNo ||
      left.itemId.localeCompare(right.itemId)
  );
  const filteredRows = rows.filter((row) => itemHistoryMatchesQuery(row, query));
  const { pageRows, safePage } = paginateRows(filteredRows, getCurrentPage(params));

  return (
    <AppShell>
      <section className="sph-list-page">
        <div className="dashboard-header">
          <div>
            <p className="page-kicker">Surat Penawaran Harga</p>
            <h1>Item History</h1>
          </div>
        </div>

        <form className="table-filter-bar">
          <label>
            <span>Search</span>
            <input
              defaultValue={query}
              name="q"
              placeholder="Part number, nama item, customer, No. SPH, status"
            />
          </label>
          <div className="table-filter-actions">
            <button type="submit">Search</button>
            <Link href="/sph/item-history">Reset</Link>
          </div>
        </form>

        <TableColumnPicker
          columns={TABLE_COLUMNS.sph_item_history}
          tableId="sph-item-history"
        />
        <div className="customer-table-wrap">
          <ConfigurableTable tableId="sph-item-history"
            className="customer-table sph-item-history-table"
            columns={TABLE_COLUMNS.sph_item_history}
            data-sortable-table
          >
            <thead>
              <tr>
                <TableHeader columnId="c3">Tanggal SPH</TableHeader>
                <TableHeader columnId="c0">Part Number</TableHeader>
                <TableHeader columnId="c1">Nama Item</TableHeader>
                <TableHeader columnId="c6">Harga/pcs</TableHeader>
                <TableHeader columnId="c2">Customer</TableHeader>
                <TableHeader columnId="c4">No. SPH</TableHeader>
                <TableHeader columnId="c5">Status</TableHeader>
              </tr>
            </thead>
            <tbody>
              {pageRows.length > 0 ? (
                pageRows.map((row) => {
                  const status = itemHistoryStatus(row.status);

                  return (
                    <tr key={`${row.source}-${row.itemId}`}>
                      <TableCell columnId="c3">{formatDate(row.sphDate)}</TableCell>
                      <TableCell columnId="c0">{row.partNumber || "-"}</TableCell>
                      <TableCell columnId="c1">
                        <strong className="table-primary">{row.partName}</strong>
                      </TableCell>
                      <TableCell columnId="c6" className="numeric-cell">
                        {formatRupiah(row.unitPrice)}
                      </TableCell>
                      <TableCell columnId="c2">{row.customerName}</TableCell>
                      <TableCell columnId="c4">
                        {row.source === "dashboard" ? (
                          <Link className="table-primary" href={`/sph/edit/${row.sphId}`}>
                            {row.sphNo}
                          </Link>
                        ) : (
                          <strong className="table-primary">{row.sphNo}</strong>
                        )}
                      </TableCell>
                      <TableCell columnId="c5">
                        {row.source === "dashboard" ? (
                          <span className={`status-badge ${status}`}>
                            {itemHistoryStatusLabel(row.status)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <TableSpanCell>Tidak ada item SPH sesuai pencarian.</TableSpanCell>
                </tr>
              )}
            </tbody>
          </ConfigurableTable>
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
