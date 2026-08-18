"use client";

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
  function downloadRows() {
    downloadExcel({
      columns: [
        { header: "No SPH", value: (row) => row.sphNo, width: 20 },
        { header: "Tanggal SPH", value: (row) => row.sphDate, width: 14 },
        { header: "Customer", value: (row) => row.customerName, width: 26 },
        { header: "Customer Code", value: (row) => row.customerCode, width: 16 },
        { header: "Franco", value: (row) => row.franco, width: 20 },
        { header: "Delivery Date", value: (row) => row.deliveryDate ?? "", width: 14 },
        { header: "ETA", value: (row) => row.etaDate ?? "", width: 14 },
        { header: "Payment", value: (row) => row.paymentTerm, width: 16 },
        { header: "Status SPH", value: (row) => row.sphStatus, width: 20 },
        { header: "No Invoice", value: (row) => row.invoiceNo, width: 20 },
        {
          header: "Status Pembayaran Invoice",
          value: (row) => row.invoicePaymentStatus,
          width: 26,
        },
        { header: "Total Invoice", value: (row) => row.invoiceTotalAmount, width: 16 },
        { header: "Terbayar Invoice", value: (row) => row.invoicePaidAmount, width: 18 },
        { header: "Sisa Invoice", value: (row) => row.invoiceRemainingAmount, width: 16 },
        { header: "Line", value: (row) => row.lineNo, width: 8 },
        { header: "Part Number", value: (row) => row.partNumber, width: 20 },
        { header: "Part Name", value: (row) => row.partName, width: 34 },
        { header: "Qty SPH", value: (row) => row.quantity, width: 10 },
        { header: "Qty Masuk Pengiriman", value: (row) => row.shippedQty, width: 20 },
        { header: "Qty Terkirim", value: (row) => row.receivedQty, width: 14 },
        { header: "Status Per Item", value: (row) => row.itemDeliveryStatus, width: 20 },
        { header: "Status Terakhir Pengiriman", value: (row) => row.latestShipmentStatus, width: 24 },
        { header: "No TTB", value: (row) => row.shipmentNos, width: 24 },
        { header: "Vendor Pengiriman", value: (row) => row.shippingVendors, width: 24 },
        { header: "Harga", value: (row) => row.unitPrice, width: 16 },
        { header: "Total", value: (row) => row.totalPrice, width: 16 },
      ],
      fileName: "list-sph-peritem",
      rows,
      sheetName: "SPH Per Item",
    });
  }

  return (
    <div className="table-export-bar">
      <button
        className="secondary-button"
        disabled={rows.length === 0}
        onClick={downloadRows}
        type="button"
      >
        Download Excel
      </button>
    </div>
  );
}
