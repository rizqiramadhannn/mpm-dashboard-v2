"use client";

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
        <div className="customer-table-wrap">
          <table
            className="customer-table supplier-note-item-table"
            data-sortable-table
            data-sort-column="0"
            data-sort-direction="desc"
          >
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>No Nota</th>
                <th>Supplier</th>
                <th>Flag</th>
                <th>PN</th>
                <th>Deskripsi</th>
                <th>Qty</th>
                <th>Harga</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {itemRows.length > 0 ? (
                itemRows.map((item) => (
                  <tr key={item.id}>
                    <td data-sort-value={item.noteDate ?? ""}>{formatDate(item.noteDate)}</td>
                    <td>
                      <strong className="table-primary">{item.noteNo}</strong>
                    </td>
                    <td>{item.supplierName}</td>
                    <td>{item.flag}</td>
                    <td>{item.partNumber || "-"}</td>
                    <td>{item.description}</td>
                    <td>
                      {item.quantity} {item.uom}
                    </td>
                    <td>{formatRupiah(item.unitPrice)}</td>
                    <td>{formatRupiah(item.totalPrice)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>Tidak ada item nota supplier sesuai filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
