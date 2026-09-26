"use client";
import { ConfigurableTable, TableColumnPicker, TableHeader, TableCell, TableSpanCell } from "../components/ConfigurableTable";
import { TABLE_COLUMNS } from "../components/tableDefinitions";
import { ModalBackdrop } from "../components/ModalBackdrop";

import { useMemo, useState, useTransition } from "react";
import { createBinaryZip } from "../components/binaryZip";
import { downloadExcel } from "../components/excelExport";
import { ItemListModal, type SphItem } from "../sph/list/ItemListModal";

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
  items: SphItem[];
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
  canUpdatePaidAmount: boolean;
  filteredInvoices: {
    customerName: string;
    hasTtdMaterai: boolean;
    invoiceId: string | null;
    invoiceNo: string;
    sphNo: string;
    ttdMateraiFileName: string;
  }[];
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
  canUpdatePaidAmount,
  filteredInvoices,
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
  const [showDownloadConfirmation, setShowDownloadConfirmation] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
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
        { header: "ONGKIR", value: (row) => row.ongkirAmount, width: 16 },
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

  async function downloadAllInvoices() {
    const availableInvoices = filteredInvoices.filter(
      (invoice): invoice is typeof invoice & { invoiceId: string } =>
        Boolean(invoice.invoiceId && invoice.hasTtdMaterai)
    );

    if (availableInvoices.length === 0) {
      return;
    }

    setDownloadProgress({ current: 0, total: availableInvoices.length });

    try {
      const zipFiles: { content: Uint8Array; name: string }[] = [];
      const usedNames = new Set<string>();

      for (let index = 0; index < availableInvoices.length; index += 1) {
        const invoice = availableInvoices[index];
        const response = await fetch(`/invoice/file/${invoice.invoiceId}?type=ttd`);

        if (!response.ok) {
          throw new Error(`Gagal mengambil invoice TTD Materai ${invoice.invoiceNo}.`);
        }

        const contentType = response.headers.get("content-type") ?? "";
        const fallbackExtension = contentType.includes("png")
          ? ".png"
          : contentType.includes("jpeg") || contentType.includes("jpg")
            ? ".jpg"
            : contentType.includes("webp")
              ? ".webp"
              : ".pdf";
        const fallbackName = `${invoice.invoiceNo}-ttd-materai${fallbackExtension}`;
        const safeName = (invoice.ttdMateraiFileName || fallbackName)
          .replace(/[\\/:*?"<>|\x00-\x1f]+/g, "-")
          .trim();
        const extensionIndex = safeName.lastIndexOf(".");
        const baseName = extensionIndex > 0 ? safeName.slice(0, extensionIndex) : safeName;
        const extension = extensionIndex > 0 ? safeName.slice(extensionIndex) : fallbackExtension;
        let fileName = `${baseName}${extension}`;
        let suffix = 2;

        while (usedNames.has(fileName.toLocaleLowerCase("id-ID"))) {
          fileName = `${baseName} (${suffix})${extension}`;
          suffix += 1;
        }

        usedNames.add(fileName.toLocaleLowerCase("id-ID"));
        zipFiles.push({
          content: new Uint8Array(await response.arrayBuffer()),
          name: fileName,
        });
        setDownloadProgress({ current: index + 1, total: availableInvoices.length });
      }

      const zip = createBinaryZip(zipFiles);
      const blob = new Blob([zip], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `invoice-ttd-materai-terfilter-${date}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setShowDownloadConfirmation(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Gagal download invoice.");
    } finally {
      setDownloadProgress(null);
    }
  }

  function beginEdit(row: LedgerRow, field: EditableField) {
    if (field === "paidAmount" && !canUpdatePaidAmount) {
      return;
    }

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

    if (editing.field === "paidAmount" && !canUpdatePaidAmount) {
      closeEdit();
      return;
    }

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
    const disabled =
      !row.invoiceId || (field === "paidAmount" && !canUpdatePaidAmount);

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
        disabled={disabled}
        onDoubleClick={() => beginEdit(row, field)}
        title={
          field === "paidAmount" && !canUpdatePaidAmount
            ? "Hanya user superadmin yang dapat mengubah terbayar"
            : "Double click untuk edit"
        }
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
  const missingTtdMaterai = filteredInvoices.filter(
    (invoice) => !invoice.hasTtdMaterai
  );

  return (
    <>
      <div className="table-export-bar">
        <TableColumnPicker tableId="invoices" columns={TABLE_COLUMNS.invoices} />
        <button
          className="secondary-button"
          disabled={filteredInvoices.length === 0}
          onClick={() => setShowDownloadConfirmation(true)}
          type="button"
        >
          Download Invoice TTD Materai
        </button>
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
        <ConfigurableTable tableId="invoices" columns={TABLE_COLUMNS.invoices} className="customer-table invoice-ledger-table" data-sortable-table>
        <thead>
          <tr>
            <TableHeader columnId="c0">NO</TableHeader>
            <TableHeader columnId="c1">TANGGAL</TableHeader>
            <TableHeader columnId="c2">CUSTOMER</TableHeader>
            <TableHeader columnId="c3">NO INVOICE</TableHeader>
            <TableHeader columnId="c4">CATEGORY</TableHeader>
            <TableHeader columnId="c5">OMSET</TableHeader>
            <TableHeader columnId="c6">TERBAYAR</TableHeader>
            <TableHeader columnId="c7">MODAL</TableHeader>
            <TableHeader columnId="c8">ONGKIR</TableHeader>
            <TableHeader columnId="c9">HPP</TableHeader>
            <TableHeader columnId="c10">GP</TableHeader>
            <TableHeader columnId="c11">%GP</TableHeader>
            <TableHeader columnId="c12">PEMBAYARAN</TableHeader>
            <TableHeader columnId="c13">STATUS</TableHeader>
            <TableHeader columnId="c14">JADWAL PEMBAYARAN</TableHeader>
            <TableHeader columnId="c15">TANGGAL BAYAR</TableHeader>
            <TableHeader columnId="c16">AGING</TableHeader>
            <TableHeader columnId="c17">TTD MATERAI</TableHeader>
            <TableHeader columnId="c18">BUKTI BAYAR</TableHeader>
            <TableHeader columnId="c19">ACTION</TableHeader>
          </tr>
        </thead>
        <tbody>
          {localRows.length > 0 ? (
            localRows.map((row, index) => (
              <tr key={row.sphId}>
                <TableCell columnId="c0">{index + 1}</TableCell>
                <TableCell columnId="c1">{row.invoiceDate}</TableCell>
                <TableCell columnId="c2">
                  <div className="stacked-cell">
                    <strong>{row.customerName}</strong>
                    <ItemListModal items={row.items} sphNo={row.sphNo} triggerLabel={row.sphNo} triggerClassName="invoice-sph-link" />
                  </div>
                </TableCell>
                <TableCell columnId="c3">{row.invoiceNo}</TableCell>
                <TableCell columnId="c4">SPARE PARTS</TableCell>
                <TableCell columnId="c5">{formatMoney(row.totalAmount)}</TableCell>
                <TableCell columnId="c6">{editableCell(row, "paidAmount")}</TableCell>
                <TableCell columnId="c7">{editableCell(row, "modalAmount")}</TableCell>
                <TableCell columnId="c8">{formatMoney(row.ongkirAmount)}</TableCell>
                <TableCell columnId="c9">{formatMoney(row.hppAmount)}</TableCell>
                <TableCell columnId="c10">{formatMoney(row.gpAmount)}</TableCell>
                <TableCell columnId="c11">{row.gpPercent}</TableCell>
                <TableCell columnId="c12">{row.paymentTerm}</TableCell>
                <TableCell columnId="c13">
                  <span className={`ledger-status ${row.statusClassName}`}>
                    {row.status}
                  </span>
                </TableCell>
                <TableCell columnId="c14">{row.paymentDueDate}</TableCell>
                <TableCell columnId="c15">{row.paymentDate}</TableCell>
                <TableCell columnId="c16">{row.aging}</TableCell>
                <TableCell columnId="c17">{fileCell(row, "ttd")}</TableCell>
                <TableCell columnId="c18">{fileCell(row, "paymentProof")}</TableCell>
                <TableCell columnId="c19">
                  {row.invoiceId ? (
                    <div className="table-actions">
                      <a href={`/invoice/download/${row.invoiceId}`}>Download Invoice</a>
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
              </tr>
            ))
          ) : (
            <tr>
              <TableSpanCell >Belum ada SPH untuk invoice.</TableSpanCell>
            </tr>
          )}
        </tbody>
        </ConfigurableTable>
      </div>

      {showDownloadConfirmation ? (
        <ModalBackdrop onClose={() => { if (!downloadProgress) setShowDownloadConfirmation(false); }}>
          <div
            aria-labelledby="download-all-invoices-title"
            aria-modal="true"
            className="download-confirmation-modal"
            role="dialog"
          >
            <div>
              <h2 id="download-all-invoices-title">
                Download invoice TTD Materai terfilter?
              </h2>
              <p>
                {filteredInvoices.length - missingTtdMaterai.length} dari{" "}
                {filteredInvoices.length} invoice sesuai filter akan dimasukkan ke dalam satu
                file ZIP.
              </p>
              {missingTtdMaterai.length > 0 ? (
                <div className="download-missing-ttd">
                  <strong>
                    {missingTtdMaterai.length} SPH belum memiliki TTD Materai:
                  </strong>
                  <ul>
                    {missingTtdMaterai.map((invoice) => (
                      <li key={invoice.sphNo}>
                        {invoice.sphNo} — {invoice.customerName}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="download-confirmation-actions">
              <button
                className="secondary-button"
                disabled={Boolean(downloadProgress)}
                onClick={() => setShowDownloadConfirmation(false)}
                type="button"
              >
                Batal
              </button>
              <button
                className="primary-button"
                disabled={
                  Boolean(downloadProgress) ||
                  !filteredInvoices.some(
                    (invoice) => invoice.invoiceId && invoice.hasTtdMaterai
                  )
                }
                onClick={() => void downloadAllInvoices()}
                type="button"
              >
                {downloadProgress
                  ? `Menyiapkan ${downloadProgress.current}/${downloadProgress.total}...`
                  : "Download ZIP"}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      ) : null}

      {preview ? (
        <ModalBackdrop onClose={() => setPreview(null)}>
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
        </ModalBackdrop>
      ) : null}
    </>
  );
}
