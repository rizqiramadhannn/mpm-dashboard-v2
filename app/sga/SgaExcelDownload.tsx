"use client";

import { downloadExcelWorkbook } from "../components/excelExport";

export type SgaExportRow = {
  amount: number;
  description: string;
  destinationAccount: string;
  id: string;
  requestDate: string;
  requestedByUsername: string;
  sourceFund: string;
  transactionPurpose: string;
};

type SummaryRow = {
  amount: number | null;
  count: number | null;
  label: string;
  notes: string;
  section: string;
  share: number | null;
};

function currentDateFileSuffix() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function buildBreakdown(
  rows: SgaExportRow[],
  section: string,
  labelForRow: (row: SgaExportRow) => string,
  totalAmount: number
) {
  const totals = new Map<string, { amount: number; count: number }>();

  for (const row of rows) {
    const label = labelForRow(row).trim() || "Tidak tercatat";
    const current = totals.get(label) ?? { amount: 0, count: 0 };
    totals.set(label, {
      amount: current.amount + row.amount,
      count: current.count + 1,
    });
  }

  return [...totals.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .map<SummaryRow>(([label, value]) => ({
      amount: value.amount,
      count: value.count,
      label,
      notes: "",
      section,
      share: totalAmount > 0 ? value.amount / totalAmount : 0,
    }));
}

export function SgaExcelDownload({ rows }: { rows: SgaExportRow[] }) {
  function downloadReport() {
    const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
    const sortedDates = rows.map((row) => row.requestDate.slice(0, 10)).filter(Boolean).sort();
    const startDate = sortedDates.at(0) ?? "-";
    const endDate = sortedDates.at(-1) ?? "-";
    const period = startDate === endDate ? startDate : `${startDate} s.d. ${endDate}`;
    const summaryRows: SummaryRow[] = [
      {
        amount: totalAmount,
        count: rows.length,
        label: "Total SGA",
        notes: `Periode transaksi: ${period}`,
        section: "Ringkasan Utama",
        share: rows.length > 0 ? 1 : 0,
      },
      {
        amount: rows.length > 0 ? totalAmount / rows.length : 0,
        count: null,
        label: "Rata-rata per request",
        notes: "Total nominal dibagi jumlah request DONE",
        section: "Ringkasan Utama",
        share: null,
      },
      ...buildBreakdown(
        rows,
        "Ringkasan Bulanan",
        (row) => row.requestDate.slice(0, 7),
        totalAmount
      ).sort((a, b) => a.label.localeCompare(b.label)),
      ...buildBreakdown(rows, "Sumber Dana", (row) => row.sourceFund, totalAmount),
      ...buildBreakdown(
        rows,
        "Tujuan Transaksi",
        (row) => row.transactionPurpose,
        totalAmount
      ),
      ...buildBreakdown(
        rows,
        "Diajukan Oleh",
        (row) => row.requestedByUsername,
        totalAmount
      ),
    ];
    const subtitle = `Basis laporan: payment request berstatus DONE | Periode: ${period} | Dibuat: ${new Intl.DateTimeFormat(
      "id-ID",
      { dateStyle: "long", timeStyle: "short" }
    ).format(new Date())}`;

    downloadExcelWorkbook({
      fileName: `Laporan SGA - ${currentDateFileSuffix()}`,
      sheets: [
        {
          columns: [
            { header: "Bagian", value: (row: SummaryRow) => row.section, width: 24 },
            { header: "Metrik / Kategori", value: (row: SummaryRow) => row.label, width: 32 },
            {
              format: "number",
              header: "Jumlah Request",
              value: (row: SummaryRow) => row.count,
              width: 16,
            },
            {
              format: "currency",
              header: "Nominal",
              value: (row: SummaryRow) => row.amount,
              width: 20,
            },
            {
              format: "percent",
              header: "% dari Total",
              value: (row: SummaryRow) => row.share,
              width: 16,
            },
            { header: "Catatan", value: (row: SummaryRow) => row.notes, width: 46 },
          ],
          rows: summaryRows,
          sheetName: "Ringkasan",
          subtitle,
          title: "Laporan Ringkasan SGA",
        },
        {
          columns: [
            { format: "number", header: "No", value: (_row: SgaExportRow, index: number) => index + 1, width: 8 },
            { header: "ID Request", value: (row: SgaExportRow) => row.id, width: 38 },
            { header: "Tanggal Request", value: (row: SgaExportRow) => row.requestDate.slice(0, 10), width: 17 },
            { header: "Diajukan Oleh", value: (row: SgaExportRow) => row.requestedByUsername || "-", width: 22 },
            { header: "Sumber Dana", value: (row: SgaExportRow) => row.sourceFund || "-", width: 24 },
            { format: "currency", header: "Nominal", value: (row: SgaExportRow) => row.amount, width: 20 },
            { header: "Rekening Tujuan", value: (row: SgaExportRow) => row.destinationAccount || "-", width: 28 },
            { header: "Deskripsi", value: (row: SgaExportRow) => row.description || "-", width: 42 },
            { header: "Tujuan Transaksi", value: (row: SgaExportRow) => row.transactionPurpose || "-", width: 32 },
            { header: "Status", value: () => "DONE", width: 12 },
          ],
          rows,
          sheetName: "Detail SGA",
          subtitle,
          title: "Buku Besar SGA",
        },
      ],
    });
  }

  return (
    <div className="table-export-bar">
      <button
        className="secondary-button"
        disabled={rows.length === 0}
        onClick={downloadReport}
        type="button"
      >
        Download Excel
      </button>
    </div>
  );
}
