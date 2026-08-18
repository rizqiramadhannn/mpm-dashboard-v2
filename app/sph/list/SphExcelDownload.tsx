"use client";

import { useState } from "react";
import { downloadExcel } from "../../components/excelExport";

export type SphExportRow = {
  customerCode: string;
  customerName: string;
  deliveryDate: string | null;
  etaDate: string | null;
  franco: string;
  itemDeliveryStatus: string;
  latestShipmentStatus: string;
  lineNo: number;
  partName: string;
  partNumber: string;
  invoiceNo: string;
  invoicePaidAmount: number;
  invoicePaymentStatus: string;
  invoiceRemainingAmount: number;
  invoiceTotalAmount: number;
  paymentTerm: string;
  quantity: number;
  receivedQty: number;
  shippedQty: number;
  shipmentNos: string;
  shippingVendors: string;
  sphDate: string;
  sphNo: string;
  sphStatus: string;
  totalPrice: number;
  unitPrice: number;
};

export function SphExcelDownload({ rows }: { rows: SphExportRow[] }) {
  const [open, setOpen] = useState(false);
  const internalColumns = [
    { header: "No SPH", value: (row: SphExportRow) => row.sphNo, width: 20 },
    { header: "Tanggal SPH", value: (row: SphExportRow) => row.sphDate, width: 14 },
    { header: "Customer", value: (row: SphExportRow) => row.customerName, width: 26 },
    { header: "Customer Code", value: (row: SphExportRow) => row.customerCode, width: 16 },
    { header: "Franco", value: (row: SphExportRow) => row.franco, width: 20 },
    { header: "Delivery Date", value: (row: SphExportRow) => row.deliveryDate ?? "", width: 14 },
    { header: "ETA", value: (row: SphExportRow) => row.etaDate ?? "", width: 14 },
    { header: "Payment", value: (row: SphExportRow) => row.paymentTerm, width: 16 },
    { header: "Status SPH", value: (row: SphExportRow) => row.sphStatus, width: 20 },
    { header: "No Invoice", value: (row: SphExportRow) => row.invoiceNo, width: 20 },
    {
      header: "Status Pembayaran Invoice",
      value: (row: SphExportRow) => row.invoicePaymentStatus,
      width: 26,
    },
    { header: "Total Invoice", value: (row: SphExportRow) => row.invoiceTotalAmount, width: 16 },
    { header: "Terbayar Invoice", value: (row: SphExportRow) => row.invoicePaidAmount, width: 18 },
    { header: "Sisa Invoice", value: (row: SphExportRow) => row.invoiceRemainingAmount, width: 16 },
    { header: "Line", value: (row: SphExportRow) => row.lineNo, width: 8 },
    { header: "Part Number", value: (row: SphExportRow) => row.partNumber, width: 20 },
    { header: "Part Name", value: (row: SphExportRow) => row.partName, width: 34 },
    { header: "Qty SPH", value: (row: SphExportRow) => row.quantity, width: 10 },
    { header: "Qty Masuk Pengiriman", value: (row: SphExportRow) => row.shippedQty, width: 20 },
    { header: "Qty Terkirim", value: (row: SphExportRow) => row.receivedQty, width: 14 },
    { header: "Status Per Item", value: (row: SphExportRow) => row.itemDeliveryStatus, width: 20 },
    {
      header: "Status Terakhir Pengiriman",
      value: (row: SphExportRow) => row.latestShipmentStatus,
      width: 24,
    },
    { header: "No TTB", value: (row: SphExportRow) => row.shipmentNos, width: 24 },
    { header: "Vendor Pengiriman", value: (row: SphExportRow) => row.shippingVendors, width: 24 },
    { header: "Harga", value: (row: SphExportRow) => row.unitPrice, width: 16 },
    { header: "Total", value: (row: SphExportRow) => row.totalPrice, width: 16 },
  ];
  const customerColumns = [
    { header: "No SPH", value: (row: SphExportRow) => row.sphNo, width: 20 },
    { header: "Tanggal SPH", value: (row: SphExportRow) => row.sphDate, width: 14 },
    { header: "Customer", value: (row: SphExportRow) => row.customerName, width: 26 },
    { header: "Franco", value: (row: SphExportRow) => row.franco, width: 20 },
    { header: "Delivery Date", value: (row: SphExportRow) => row.deliveryDate ?? "", width: 14 },
    { header: "ETA", value: (row: SphExportRow) => row.etaDate ?? "", width: 14 },
    { header: "Payment", value: (row: SphExportRow) => row.paymentTerm, width: 16 },
    { header: "No Invoice", value: (row: SphExportRow) => row.invoiceNo, width: 20 },
    {
      header: "Status Pembayaran Invoice",
      value: (row: SphExportRow) => row.invoicePaymentStatus,
      width: 26,
    },
    { header: "Line", value: (row: SphExportRow) => row.lineNo, width: 8 },
    { header: "Part Number", value: (row: SphExportRow) => row.partNumber, width: 20 },
    { header: "Part Name", value: (row: SphExportRow) => row.partName, width: 34 },
    { header: "Qty", value: (row: SphExportRow) => row.quantity, width: 10 },
    { header: "Status Per Item", value: (row: SphExportRow) => row.itemDeliveryStatus, width: 20 },
    { header: "Harga", value: (row: SphExportRow) => row.unitPrice, width: 16 },
    { header: "Total", value: (row: SphExportRow) => row.totalPrice, width: 16 },
  ];

  function currentDateFileSuffix() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function downloadRows(type: "customer" | "internal") {
    const audience = type === "internal" ? "Internal" : "Customer";

    downloadExcel({
      columns: type === "internal" ? internalColumns : customerColumns,
      fileName: `Rekap SPH Per Item - ${audience} - ${currentDateFileSuffix()}`,
      rows,
      sheetName: type === "internal" ? "SPH Internal" : "SPH Customer",
    });
    setOpen(false);
  }

  return (
    <div className="table-export-bar">
      <div className="download-menu">
        <button
          aria-expanded={open}
          className="secondary-button"
          disabled={rows.length === 0}
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          Download Excel
        </button>
        {open ? (
          <div className="download-menu-options">
            <button onClick={() => downloadRows("internal")} type="button">
              Download for Internal
            </button>
            <button onClick={() => downloadRows("customer")} type="button">
              Download for Cust
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
