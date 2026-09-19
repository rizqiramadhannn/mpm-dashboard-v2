import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ConfigurableTable, TableColumnPicker, TableHeader, TableCell, TableSpanCell, TablePreferencesProvider } from "../app/components/ConfigurableTable";
import { parseHiddenColumns, TABLE_COOKIE_PREFIX } from "../app/components/tablePreferences";
import type { TablePreferences } from "../app/components/tablePreferences";
import { TableSorter } from "../app/components/TableSorter";
import { ItemListModal } from "../app/sph/list/ItemListModal";
import { InvoiceLedgerTable } from "../app/invoice/InvoiceLedgerTable";
import type { LedgerRow } from "../app/invoice/InvoiceLedgerTable";

const account = new URLSearchParams(location.search).get("account") ?? "accountA";
const initialPreferences: TablePreferences = {};
for (const pair of document.cookie.split("; ")) {
  const [name, value] = pair.split("=");
  const prefix = `${TABLE_COOKIE_PREFIX}${account}_`;
  if (name.startsWith(prefix)) initialPreferences[name.slice(prefix.length)] = parseHiddenColumns(value ?? "");
}
const columns = [{ id: "c0", label: "Nama" }, { id: "c1", label: "Input" }, { id: "c2", label: "Qty" }];
if (new URLSearchParams(location.search).has("new")) columns.push({ id: "c3", label: "Baru" });
const items = [{ id: "one", lineNo: 1, partNumber: "PN1", partName: "Pompa", quantity: 2, unitPrice: 100, totalPrice: 200 }];
const row: LedgerRow = { aging: "-", customerName: "Customer", feeAmount: 0, gpAmount: 100, gpPercent: "50%", hppAmount: 100, invoiceDate: "14/09/2026", invoiceDateRaw: "2026-09-14", invoiceId: "inv1", invoiceNo: "INV001", kodAmount: 0, modalAmount: 100, ongkirAmount: 0, paidAmount: 0, paymentDate: "-", paymentDueDate: "-", paymentProofFiles: [], paymentTerm: "CBD", sphId: "sph1", sphNo: "SPH001", items, status: "BELUM BAYAR", statusClassName: "belum-bayar", ttdMateraiFile: null, totalAmount: 200 };
function Fixture() {
  const [modal, setModal] = useState(false);
  return <TablePreferencesProvider scope={account} initialPreferences={initialPreferences}>
    <div className="main-content-body"><TableSorter />
      <form onSubmit={event => event.preventDefault()}>
        <TableColumnPicker tableId="test-main" columns={columns} />
        <ConfigurableTable tableId="test-main" columns={columns} className="customer-table" data-sortable-table>
          <thead><tr>{columns.map(column => <TableHeader key={column.id} columnId={column.id}>{column.label}</TableHeader>)}</tr></thead>
          <tbody>{["Zulu", "Alpha"].map((name, index) => <tr key={name}>
            <TableCell columnId="c0">{name}</TableCell>
            <TableCell columnId="c1"><input required={index === 0} aria-label={`Input ${name}`} /></TableCell>
            <TableCell columnId="c2"><input required={index === 0} aria-label={`Qty ${name}`} /></TableCell>
            {columns.length === 4 && <TableCell columnId="c3">Baru</TableCell>}
          </tr>)}</tbody>
        </ConfigurableTable>
        <button type="submit">Validate</button>
      </form>
      <TableColumnPicker tableId="test-empty" columns={columns} />
      <ConfigurableTable tableId="test-empty" columns={columns} className="customer-table"><thead><tr>{columns.map(column => <TableHeader key={column.id} columnId={column.id}>{column.label}</TableHeader>)}</tr></thead><tbody><tr><TableSpanCell>Empty</TableSpanCell></tr></tbody></ConfigurableTable>
      <button type="button" onClick={() => setModal(true)}>Open shared table</button>
      {modal && <div role="dialog"><button type="button" onClick={() => setModal(false)}>Close shared</button><ConfigurableTable tableId="test-main" columns={columns}><thead><tr>{columns.map(column => <TableHeader key={column.id} columnId={column.id}>{column.label}</TableHeader>)}</tr></thead><tbody><tr><TableSpanCell>Shared</TableSpanCell></tr></tbody></ConfigurableTable></div>}
      <ItemListModal items={items} sphNo="SPH001" />
      <InvoiceLedgerTable
        rows={[row]}
        filteredInvoices={[{
          customerName: row.customerName,
          hasTtdMaterai: Boolean(row.ttdMateraiFile),
          invoiceId: row.invoiceId,
          invoiceNo: row.invoiceNo,
          sphNo: row.sphNo,
        }]}
        canUpdatePaidAmount={false}
        updateLedgerAmountAction={async () => {}}
      />
    </div>
  </TablePreferencesProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
