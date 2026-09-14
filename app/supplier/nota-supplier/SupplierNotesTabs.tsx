"use client";
import { ConfigurableTable, TableColumnPicker, TableHeader, TableCell, TableSpanCell } from "../../components/ConfigurableTable";
import { TABLE_COLUMNS } from "../../components/tableDefinitions";

import { useState } from "react";
import { SupplierNotesTable } from "./SupplierNotesTable";

type SupplierNoteFile = {
  name: string;
  mimeType: string;
  size: number;
  url: string;
};

type SupplierNote = {
  id: string;
  noteNo: string;
  noteDate: string | null;
  supplierName: string;
  customerName: string;
  category: string;
  amount: number;
  paidAmount: number;
  paymentStatus: string;
  remainingPayment: number;
  paymentDeadline: string | null;
  flag: string;
  invoiceFileName: string;
  invoiceFileMimeType: string;
  invoiceFileSize: number;
  invoiceFileUrl: string;
  paymentProofFileName: string;
  paymentProofFileMimeType: string;
  paymentProofFileSize: number;
  paymentProofFileUrl: string;
  paymentProofFiles: SupplierNoteFile[];
  items: {
    id: string;
    lineNo: number;
    partNumber: string;
    description: string;
    quantity: number;
    uom: string;
    unitPrice: number;
    totalPrice: number;
  }[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

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
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export function SupplierNotesTabs({ notes }: { notes: SupplierNote[] }) {
  const [activeTab, setActiveTab] = useState<"invoice" | "item">("invoice");
  const itemRows = notes.flatMap((note) =>
    note.items.map((item) => ({
      ...item,
      flag: note.flag,
      customerName: note.customerName,
      noteDate: note.noteDate,
      noteNo: note.noteNo,
      supplierName: note.supplierName,
    }))
  );

  return (
    <div className="supplier-note-tabs">
      <div className="table-tabs" role="tablist" aria-label="Nota supplier views">
        <button
          className={activeTab === "invoice" ? "active" : ""}
          onClick={() => setActiveTab("invoice")}
          type="button"
        >
          Per Invoice/Nota
        </button>
        <button
          className={activeTab === "item" ? "active" : ""}
          onClick={() => setActiveTab("item")}
          type="button"
        >
          Per Item
        </button>
      </div>

      {activeTab === "invoice" ? (
        <SupplierNotesTable notes={notes} />
      ) : (
        <>
        <div className="table-export-bar"><TableColumnPicker tableId="supplier-items" columns={TABLE_COLUMNS.supplier_items} /></div>
        <div className="customer-table-wrap">
          <ConfigurableTable tableId="supplier-items" columns={TABLE_COLUMNS.supplier_items}
            className="customer-table supplier-note-item-table"
            data-sortable-table
            data-sort-column="0"
            data-sort-direction="desc"
          >
            <thead>
              <tr>
                <TableHeader columnId="c0">Tanggal</TableHeader>
                <TableHeader columnId="c1">No Nota</TableHeader>
                <TableHeader columnId="c2">Supplier</TableHeader>
                <TableHeader columnId="c3">Customer</TableHeader>
                <TableHeader columnId="c4">Flag</TableHeader>
                <TableHeader columnId="c5">PN</TableHeader>
                <TableHeader columnId="c6">Deskripsi</TableHeader>
                <TableHeader columnId="c7">Qty</TableHeader>
                <TableHeader columnId="c8">Harga</TableHeader>
                <TableHeader columnId="c9">Total</TableHeader>
              </tr>
            </thead>
            <tbody>
              {itemRows.length > 0 ? (
                itemRows.map((item) => (
                  <tr key={item.id}>
                    <TableCell columnId="c0" data-sort-value={item.noteDate ?? ""}>{formatDate(item.noteDate)}</TableCell>
                    <TableCell columnId="c1">
                      <strong className="table-primary">{item.noteNo}</strong>
                    </TableCell>
                    <TableCell columnId="c2">{item.supplierName}</TableCell>
                    <TableCell columnId="c3">{item.customerName || "-"}</TableCell>
                    <TableCell columnId="c4">{item.flag}</TableCell>
                    <TableCell columnId="c5">{item.partNumber || "-"}</TableCell>
                    <TableCell columnId="c6">{item.description}</TableCell>
                    <TableCell columnId="c7">
                      {item.quantity} {item.uom}
                    </TableCell>
                    <TableCell columnId="c8">{formatRupiah(item.unitPrice)}</TableCell>
                    <TableCell columnId="c9">{formatRupiah(item.totalPrice)}</TableCell>
                  </tr>
                ))
              ) : (
                <tr>
                  <TableSpanCell >Tidak ada item nota supplier sesuai filter.</TableSpanCell>
                </tr>
              )}
            </tbody>
          </ConfigurableTable>
        </div>
        </>
      )}
    </div>
  );
}
