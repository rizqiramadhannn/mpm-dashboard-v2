"use client";

import { downloadExcelWorkbook } from "../components/excelExport";

export type FinanceExportRow = {
  amount: number; counterparty: string; description: string; financeCategory: string;
  id: string; notes: string; sourceCategory: string; sourceDocument: string;
  sourceRow: number; sourceSheet: string; transactionDate: string; transactionTime: string;
};

type FinanceSummaryRow = { amount: number; category: string; count: number; share: number };

export function FinanceExcelDownload({ rows }: { rows: FinanceExportRow[] }) {
  function download() {
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    const categories = Array.from(rows.reduce((map, row) => map.set(row.financeCategory, (map.get(row.financeCategory) || 0) + row.amount), new Map<string, number>()))
      .map(([category, amount]) => ({ amount, category, count: rows.filter((row) => row.financeCategory === category).length, share: total ? amount / total : 0 }))
      .sort((a, b) => b.amount - a.amount);
    const dates = rows.map((row) => row.transactionDate).sort();
    const period = dates.length ? `${dates[0]} s.d. ${dates.at(-1)}` : "-";
    const summary: FinanceSummaryRow[] = [{ amount: total, category: "Total SGA", count: rows.length, share: total ? 1 : 0 }, ...categories];
    downloadExcelWorkbook({
      fileName: `Laporan Finance SGA ${new Date().toISOString().slice(0, 10)}`,
      sheets: [
        { sheetName: "Ringkasan", title: "Ringkasan Finance SGA", subtitle: `Periode ${period} · Ledger outcome hasil rekonsiliasi`, rows: summary, columns: [
          { header: "Kategori", value: (row: FinanceSummaryRow) => row.category, width: 30 },
          { header: "Jumlah Transaksi", format: "number", value: (row: FinanceSummaryRow) => row.count, width: 18 },
          { header: "Nominal", format: "currency", value: (row: FinanceSummaryRow) => row.amount, width: 22 },
          { header: "% dari Total", format: "percent", value: (row: FinanceSummaryRow) => row.share, width: 16 },
        ] },
        { sheetName: "Detail SGA", title: "Buku Besar Finance SGA", subtitle: `Periode ${period} · Dapat ditelusuri ke sheet dan baris sumber`, rows, columns: [
          { header: "No", format: "number", value: (_row: FinanceExportRow, index: number) => index + 1, width: 8 },
          { header: "ID Ledger", value: (row: FinanceExportRow) => row.id, width: 36 },
          { header: "Tanggal", value: (row: FinanceExportRow) => row.transactionDate, width: 15 },
          { header: "Waktu", value: (row: FinanceExportRow) => row.transactionTime, width: 10 },
          { header: "Sheet Sumber", value: (row: FinanceExportRow) => row.sourceSheet, width: 22 },
          { header: "Baris Sumber", format: "number", value: (row: FinanceExportRow) => row.sourceRow, width: 13 },
          { header: "Dokumen Sumber", value: (row: FinanceExportRow) => row.sourceDocument, width: 40 },
          { header: "Deskripsi", value: (row: FinanceExportRow) => row.description, width: 55 },
          { header: "Tujuan/Pihak Lawan", value: (row: FinanceExportRow) => row.counterparty, width: 40 },
          { header: "Kategori Finance", value: (row: FinanceExportRow) => row.financeCategory, width: 30 },
          { header: "Kategori Sumber", value: (row: FinanceExportRow) => row.sourceCategory, width: 25 },
          { header: "Nominal", format: "currency", value: (row: FinanceExportRow) => row.amount, width: 22 },
          { header: "Catatan Rekonsiliasi", value: (row: FinanceExportRow) => row.notes, width: 45 },
        ] },
      ],
    });
  }

  return <button className="secondary-button" disabled={!rows.length} onClick={download} type="button">Download Excel</button>;
}
