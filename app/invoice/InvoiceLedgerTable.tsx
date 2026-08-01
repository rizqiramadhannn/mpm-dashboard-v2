"use client";

import { useMemo, useState, useTransition } from "react";

export type LedgerRow = {
  aging: string;
  customerName: string;
  feeAmount: number;
  gpAmount: number;
  gpPercent: string;
  hppAmount: number;
  invoiceDate: string;
  invoiceDateRaw: string;
  invoiceId: string | null;
  invoiceNo: string;
  kodAmount: number;
  modalAmount: number;
  ongkirAmount: number;
  paymentDate: string;
  paymentDueDate: string;
  paymentTerm: string;
  sphId: string;
  sphNo: string;
  status: string;
  statusClassName: string;
  totalAmount: number;
};

type EditableField = "modalAmount" | "feeAmount" | "kodAmount";

type InvoiceLedgerTableProps = {
  rows: LedgerRow[];
  updateLedgerAmountAction: (formData: FormData) => Promise<void>;
};

function formatMoney(value: number) {
  return `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function parseAmount(value: string) {
  const normalized = value.replace(/[^\d]/g, "");
  return normalized ? Number(normalized) : 0;
}

function formatPercent(value: number, total: number) {
  if (total <= 0) {
    return "-";
  }

  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format((value / total) * 100)}%`;
}

export function InvoiceLedgerTable({
  rows,
  updateLedgerAmountAction,
}: InvoiceLedgerTableProps) {
  const [localRows, setLocalRows] = useState(rows);
  const [editing, setEditing] = useState<{ rowId: string; field: EditableField } | null>(
    null
  );
  const [draftValue, setDraftValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const rowById = useMemo(
    () => new Map(localRows.map((row) => [row.sphId, row])),
    [localRows]
  );

  function beginEdit(row: LedgerRow, field: EditableField) {
    setEditing({ rowId: row.sphId, field });
    setDraftValue(String(row[field] || ""));
  }

  function closeEdit() {
    setEditing(null);
    setDraftValue("");
  }

  function commitEdit() {
    if (!editing) {
      return;
    }

    const row = rowById.get(editing.rowId);

    if (!row?.invoiceId) {
      closeEdit();
      return;
    }

    const amount = parseAmount(draftValue);
    setLocalRows((current) =>
      current.map((currentRow) =>
        currentRow.sphId === editing.rowId
          ? (() => {
              const nextModal =
                editing.field === "modalAmount" ? amount : currentRow.modalAmount;
              const nextFee = editing.field === "feeAmount" ? amount : currentRow.feeAmount;
              const nextKod = editing.field === "kodAmount" ? amount : currentRow.kodAmount;
              const nextHpp = nextModal + nextFee + currentRow.ongkirAmount + nextKod;
              const nextGp = currentRow.totalAmount - nextHpp;

              return {
                ...currentRow,
                [editing.field]: amount,
                gpAmount: nextGp,
                gpPercent: formatPercent(nextGp, currentRow.totalAmount),
                hppAmount: nextHpp,
              };
            })()
          : currentRow
      )
    );

    const formData = new FormData();
    formData.set("invoiceId", row.invoiceId);
    formData.set("field", editing.field);
    formData.set("amount", String(amount));

    startTransition(() => {
      void updateLedgerAmountAction(formData);
    });
    closeEdit();
  }

  function editableCell(row: LedgerRow, field: EditableField) {
    const isEditing = editing?.rowId === row.sphId && editing.field === field;

    if (isEditing) {
      return (
        <input
          autoFocus
          className="ledger-edit-input"
          disabled={isPending}
          inputMode="numeric"
          onBlur={commitEdit}
          onChange={(event) => setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitEdit();
            }

            if (event.key === "Escape") {
              closeEdit();
            }
          }}
          value={draftValue}
        />
      );
    }

    return (
      <button
        className="ledger-edit-button"
        disabled={!row.invoiceId}
        onDoubleClick={() => beginEdit(row, field)}
        title="Double click untuk edit"
        type="button"
      >
        {formatMoney(row[field])}
      </button>
    );
  }

  return (
    <div className="customer-table-wrap invoice-ledger-wrap">
      <table className="customer-table invoice-ledger-table">
        <thead>
          <tr>
            <th>NO</th>
            <th>TANGGAL</th>
            <th>CUSTOMER</th>
            <th>NO INVOICE</th>
            <th>CATEGORY</th>
            <th>OMSET</th>
            <th>MODAL</th>
            <th>FEE</th>
            <th>ONGKIR</th>
            <th>KOD</th>
            <th>HPP</th>
            <th>GP</th>
            <th>%GP</th>
            <th>PEMBAYARAN</th>
            <th>STATUS</th>
            <th>JADWAL PEMBAYARAN</th>
            <th>TANGGAL BAYAR</th>
            <th>AGING</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          {localRows.length > 0 ? (
            localRows.map((row, index) => (
              <tr key={row.sphId}>
                <td>{index + 1}</td>
                <td>{row.invoiceDate}</td>
                <td>
                  <div className="stacked-cell">
                    <strong>{row.customerName}</strong>
                    <span>{row.sphNo}</span>
                  </div>
                </td>
                <td>{row.invoiceNo}</td>
                <td>SPARE PARTS</td>
                <td>{formatMoney(row.totalAmount)}</td>
                <td>{editableCell(row, "modalAmount")}</td>
                <td>{editableCell(row, "feeAmount")}</td>
                <td>{formatMoney(row.ongkirAmount)}</td>
                <td>{editableCell(row, "kodAmount")}</td>
                <td>{formatMoney(row.hppAmount)}</td>
                <td>{formatMoney(row.gpAmount)}</td>
                <td>{row.gpPercent}</td>
                <td>{row.paymentTerm}</td>
                <td>
                  <span className={`ledger-status ${row.statusClassName}`}>
                    {row.status}
                  </span>
                </td>
                <td>{row.paymentDueDate}</td>
                <td>{row.paymentDate}</td>
                <td>{row.aging}</td>
                <td>
                  {row.invoiceId ? (
                    <div className="table-actions">
                      <a href={`/invoice/download/${row.invoiceId}`}>Download Invoice</a>
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={19}>Belum ada SPH untuk invoice.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
