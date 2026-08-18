"use client";

import { useMemo, useState, useTransition } from "react";
import { downloadExcel } from "../components/excelExport";

type InvoiceFile = {
  mimeType: string;
  name: string;
  size: number;
};

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
  paidAmount: number;
  paymentDate: string;
  paymentDueDate: string;
  paymentProofFiles: InvoiceFile[];
  paymentTerm: string;
  sphId: string;
  sphNo: string;
  status: string;
  statusClassName: string;
  ttdMateraiFile: InvoiceFile | null;
  totalAmount: number;
};

type EditableField = "modalAmount" | "feeAmount" | "kodAmount" | "paidAmount";

type PreviewState = {
  files: InvoiceFile[];
  invoiceId: string;
  selectedIndex: number;
  title: string;
  type: "ttd" | "paymentProof";
} | null;

type InvoiceLedgerTableProps = {
  rows: LedgerRow[];
  updateLedgerAmountAction: (formData: FormData) => Promise<void>;
};

function formatMoney(value: number) {
  return `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function formatFileSize(value: number) {
  if (!value) {
    return "";
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function fileLabel(fileName: string, fileSize: number) {
  const size = formatFileSize(fileSize);
  return size ? `${fileName} (${size})` : fileName;
}

function FileIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M14 2v6h6M8 13h8M8 17h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
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
  const [preview, setPreview] = useState<PreviewState>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const rowById = useMemo(
    () => new Map(localRows.map((row) => [row.sphId, row])),
    [localRows]
  );

  function downloadRows() {
    downloadExcel({
      columns: [
        { header: "NO", value: (_row, index) => index + 1, width: 8 },
        { header: "TANGGAL", value: (row) => row.invoiceDateRaw || row.invoiceDate, width: 14 },
        { header: "CUSTOMER", value: (row) => row.customerName, width: 26 },
        { header: "NO SPH", value: (row) => row.sphNo, width: 20 },
        { header: "NO INVOICE", value: (row) => row.invoiceNo, width: 20 },
        { header: "CATEGORY", value: () => "SPARE PARTS", width: 16 },
        { header: "OMSET", value: (row) => row.totalAmount, width: 16 },
        { header: "TERBAYAR", value: (row) => row.paidAmount, width: 16 },
        { header: "MODAL", value: (row) => row.modalAmount, width: 16 },
        { header: "FEE", value: (row) => row.feeAmount, width: 16 },
        { header: "ONGKIR", value: (row) => row.ongkirAmount, width: 16 },
        { header: "KOD", value: (row) => row.kodAmount, width: 16 },
        { header: "HPP", value: (row) => row.hppAmount, width: 16 },
        { header: "GP", value: (row) => row.gpAmount, width: 16 },
        { header: "%GP", value: (row) => row.gpPercent, width: 12 },
        { header: "PEMBAYARAN", value: (row) => row.paymentTerm, width: 16 },
        { header: "STATUS", value: (row) => row.status, width: 16 },
        { header: "JADWAL PEMBAYARAN", value: (row) => row.paymentDueDate, width: 20 },
        { header: "TANGGAL BAYAR", value: (row) => row.paymentDate, width: 16 },
        { header: "AGING", value: (row) => row.aging, width: 10 },
        { header: "TTD MATERAI", value: (row) => row.ttdMateraiFile?.name ?? "", width: 24 },
        {
          header: "BUKTI BAYAR",
          value: (row) => row.paymentProofFiles.map((file) => file.name).join(", "),
          width: 32,
        },
      ],
      fileName: "list-invoice",
      rows: localRows,
      sheetName: "List Invoice",
    });
  }

  function beginEdit(row: LedgerRow, field: EditableField) {
    setEditing({ rowId: row.sphId, field });
    setDraftValue(String(row[field] || ""));
  }

  function closeEdit() {
    setEditing(null);
    setDraftValue("");
  }

  async function updatePaidAmount(row: LedgerRow, amount: number) {
    const response = await fetch("/api/invoices", {
      body: JSON.stringify({ id: row.invoiceId, paidAmount: amount }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? "Gagal mengubah terbayar.");
    }

    const status = result.data.status === "done" ? "LUNAS" : "BELUM BAYAR";

    setLocalRows((current) =>
      current.map((currentRow) =>
        currentRow.sphId === row.sphId
          ? {
              ...currentRow,
              paidAmount: result.data.paidAmount,
              paymentDate: result.data.processedAt
                ? new Intl.DateTimeFormat("id-ID", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  }).format(new Date(result.data.processedAt))
                : "-",
              status,
              statusClassName: status.toLowerCase().replace(/\s+/g, "-"),
            }
          : currentRow
      )
    );
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

    const label = editing.field === "paidAmount" ? "Terbayar" : editing.field;

    if (!window.confirm(`Simpan perubahan ${label} untuk ${row.invoiceNo}?`)) {
      closeEdit();
      return;
    }

    if (editing.field === "paidAmount") {
      void updatePaidAmount(row, amount).catch((error) => {
        window.alert(error instanceof Error ? error.message : "Gagal mengubah terbayar.");
      });
      closeEdit();
      return;
    }

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

  function fileCell(row: LedgerRow, type: "ttd" | "paymentProof") {
    const files =
      type === "ttd" ? (row.ttdMateraiFile ? [row.ttdMateraiFile] : []) : row.paymentProofFiles;
    const uploadKey = `${row.invoiceId}:${type}`;
    const label = type === "ttd" ? "TTD Materai" : "Bukti Bayar";

    async function uploadFiles(filesToUpload: FileList | null) {
      if (!row.invoiceId || !filesToUpload || filesToUpload.length === 0) {
        return;
      }

      if (!window.confirm(`Upload ${label} untuk ${row.invoiceNo}?`)) {
        return;
      }

      const formData = new FormData();
      formData.set("id", row.invoiceId);

      if (type === "ttd") {
        formData.set("ttdMateraiFile", filesToUpload[0]);
      } else {
        Array.from(filesToUpload).forEach((file) => {
          formData.append("paymentProofFiles", file);
        });
      }

      setUploading(uploadKey);

      try {
        const response = await fetch("/api/invoices", {
          body: formData,
          method: "PATCH",
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? "Gagal upload file.");
        }

        setLocalRows((current) =>
          current.map((currentRow) =>
            currentRow.sphId === row.sphId
              ? {
                  ...currentRow,
                  paymentProofFiles:
                    result.data.paymentProofFiles?.map((file: InvoiceFile) => ({
                      mimeType: file.mimeType,
                      name: file.name,
                      size: file.size,
                    })) ?? currentRow.paymentProofFiles,
                  ttdMateraiFile: result.data.ttdMateraiFileName
                    ? {
                        mimeType: result.data.ttdMateraiFileMimeType,
                        name: result.data.ttdMateraiFileName,
                        size: result.data.ttdMateraiFileSize,
                      }
                    : currentRow.ttdMateraiFile,
                }
              : currentRow
          )
        );
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Gagal upload file.");
      } finally {
        setUploading(null);
      }
    }

    return (
      <div className="file-action-cell">
        {files.length > 0 && row.invoiceId ? (
          <button
            className="file-preview-button"
            onClick={() =>
              setPreview({
                files,
                invoiceId: row.invoiceId ?? "",
                selectedIndex: 0,
                title: `${label} - ${row.invoiceNo}`,
                type,
              })
            }
            title={fileLabel(files[0]?.name || label, files[0]?.size || 0)}
            type="button"
          >
            <FileIcon />
            <span>{type === "paymentProof" && files.length > 1 ? `${label} (${files.length})` : label}</span>
          </button>
        ) : null}
        <label className="file-upload-button">
          <input
            accept="application/pdf,image/*"
            disabled={!row.invoiceId}
            multiple={type === "paymentProof"}
            onChange={(event) => {
              void uploadFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
            type="file"
          />
          {uploading === uploadKey ? "Uploading..." : "Upload"}
        </label>
      </div>
    );
  }

  const previewFile = preview?.files[preview.selectedIndex];
  const previewUrl = preview
    ? `/invoice/file/${preview.invoiceId}?type=${preview.type}&index=${preview.selectedIndex}&inline=1`
    : "";

  return (
    <>
      <div className="table-export-bar">
        <button
          className="secondary-button"
          disabled={localRows.length === 0}
          onClick={downloadRows}
          type="button"
        >
          Download Excel
        </button>
      </div>
      <div className="customer-table-wrap invoice-ledger-wrap">
        <table className="customer-table invoice-ledger-table" data-sortable-table>
        <thead>
          <tr>
            <th>NO</th>
            <th>TANGGAL</th>
            <th>CUSTOMER</th>
            <th>NO INVOICE</th>
            <th>CATEGORY</th>
            <th>OMSET</th>
            <th>TERBAYAR</th>
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
            <th>TTD MATERAI</th>
            <th>BUKTI BAYAR</th>
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
                <td>{editableCell(row, "paidAmount")}</td>
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
                <td>{fileCell(row, "ttd")}</td>
                <td>{fileCell(row, "paymentProof")}</td>
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
              <td colSpan={22}>Belum ada SPH untuk invoice.</td>
            </tr>
          )}
        </tbody>
        </table>
      </div>

      {preview ? (
        <div className="preview-modal-backdrop" role="presentation">
          <div aria-modal="true" className="preview-modal" role="dialog">
            <div className="preview-modal-header">
              <div className="preview-modal-title">
                <strong>{preview.title}</strong>
                {previewFile ? <span>{fileLabel(previewFile.name, previewFile.size)}</span> : null}
              </div>
              <button onClick={() => setPreview(null)} type="button">
                Tutup
              </button>
            </div>
            {preview.files.length > 1 ? (
              <div className="preview-file-tabs">
                {preview.files.map((file, index) => (
                  <button
                    className={index === preview.selectedIndex ? "active" : ""}
                    key={`${file.name}-${index}`}
                    onClick={() =>
                      setPreview((currentPreview) =>
                        currentPreview
                          ? { ...currentPreview, selectedIndex: index }
                          : currentPreview
                      )
                    }
                    type="button"
                  >
                    {file.name || `Bukti Bayar ${index + 1}`}
                  </button>
                ))}
              </div>
            ) : null}
            <iframe className="preview-modal-frame" src={previewUrl} title={preview.title} />
          </div>
        </div>
      ) : null}
    </>
  );
}
