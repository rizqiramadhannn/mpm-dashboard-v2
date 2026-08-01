"use client";

import { useState } from "react";

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
  }[];
};

type PreviewState = {
  files: SupplierNoteFile[];
  noteId: string;
  selectedIndex: number;
  title: string;
  type: "invoice" | "paymentProof";
} | null;

type EditingState = {
  id: string;
  value: string;
} | null;

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

function formatFileSize(value: number) {
  if (!value) {
    return "";
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
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

function fileLabel(fileName: string, fileSize: number) {
  const size = formatFileSize(fileSize);
  return size ? `${fileName} (${size})` : fileName;
}

function invoiceFiles(note: SupplierNote): SupplierNoteFile[] {
  if (!note.invoiceFileName && !note.invoiceFileUrl) {
    return [];
  }

  return [
    {
      mimeType: note.invoiceFileMimeType,
      name: note.invoiceFileName || "Invoice",
      size: note.invoiceFileSize,
      url: note.invoiceFileUrl,
    },
  ];
}

export function SupplierNotesTable({ notes }: { notes: SupplierNote[] }) {
  const [rows, setRows] = useState(notes);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [editing, setEditing] = useState<EditingState>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  function openPreview(
    note: SupplierNote,
    type: "invoice" | "paymentProof",
    label: string
  ) {
    const files = type === "invoice" ? invoiceFiles(note) : note.paymentProofFiles;

    if (files.length === 0) {
      return;
    }

    setPreview({
      files,
      noteId: note.id,
      selectedIndex: 0,
      title: `${label} - ${note.noteNo}`,
      type,
    });
  }

  async function savePaidAmount(note: SupplierNote) {
    if (!editing || editing.id !== note.id) {
      return;
    }

    const paidAmount = Number(editing.value);

    if (!Number.isFinite(paidAmount)) {
      setEditing(null);
      return;
    }

    if (!window.confirm(`Simpan nominal terbayar untuk ${note.noteNo}?`)) {
      setEditing(null);
      return;
    }

    setSavingId(note.id);

    try {
      const response = await fetch("/api/supplier-notes", {
        body: JSON.stringify({ id: note.id, paidAmount }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Gagal mengubah terbayar.");
      }

      setRows((currentRows) =>
        currentRows.map((row) =>
          row.id === note.id
            ? {
                ...row,
                paidAmount: result.data.paidAmount,
                paymentStatus: result.data.paymentStatus,
                remainingPayment: result.data.remainingPayment,
              }
            : row
        )
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Gagal mengubah terbayar.");
    } finally {
      setEditing(null);
      setSavingId(null);
    }
  }

  async function uploadFiles(
    note: SupplierNote,
    type: "invoice" | "paymentProof",
    files: FileList | null
  ) {
    if (!files || files.length === 0) {
      return;
    }

    if (
      !window.confirm(
        type === "invoice"
          ? `Upload invoice untuk ${note.noteNo}?`
          : `Upload bukti bayar untuk ${note.noteNo}?`
      )
    ) {
      return;
    }

    const uploadKey = `${note.id}:${type}`;
    const formData = new FormData();
    formData.set("id", note.id);

    if (type === "invoice") {
      formData.set("invoiceFile", files[0]);
    } else {
      Array.from(files).forEach((file) => {
        formData.append("paymentProofFiles", file);
      });
    }

    setUploading(uploadKey);

    try {
      const response = await fetch("/api/supplier-notes", {
        body: formData,
        method: "PATCH",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Gagal upload file.");
      }

      setRows((currentRows) =>
        currentRows.map((row) =>
          row.id === note.id
            ? {
                ...row,
                ...result.data,
              }
            : row
        )
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Gagal upload file.");
    } finally {
      setUploading(null);
    }
  }

  const previewFile = preview?.files[preview.selectedIndex];
  const previewUrl = preview
    ? `/supplier/nota-supplier/download/${preview.noteId}?type=${preview.type}&index=${preview.selectedIndex}&inline=1`
    : "";

  return (
    <>
      <div className="customer-table-wrap">
        <table className="customer-table supplier-note-table">
          <thead>
            <tr>
              <th>No Nota</th>
              <th>Tanggal</th>
              <th>Supplier</th>
              <th>Flag</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Item</th>
              <th>Invoice</th>
              <th>Bukti Bayar</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((note) => {
                const proofs = note.paymentProofFiles;

                return (
                  <tr key={note.id}>
                    <td>
                      <strong className="table-primary">{note.noteNo}</strong>
                    </td>
                    <td>{formatDate(note.noteDate)}</td>
                    <td>
                      <div className="stacked-cell">
                        <strong>{note.supplierName}</strong>
                        <span>{note.category}</span>
                      </div>
                    </td>
                    <td>{note.flag}</td>
                    <td>{formatRupiah(note.amount)}</td>
                    <td>
                      <div className="stacked-cell">
                        <strong>{note.paymentStatus}</strong>
                        <button
                          className="paid-amount-display"
                          disabled={savingId === note.id}
                          onDoubleClick={() =>
                            setEditing({
                              id: note.id,
                              value: String(note.paidAmount),
                            })
                          }
                          title="Double click untuk ubah terbayar"
                          type="button"
                        >
                          Terbayar {formatRupiah(note.paidAmount)}
                        </button>
                        {editing?.id === note.id ? (
                          <input
                            autoFocus
                            className="paid-amount-input"
                            inputMode="numeric"
                            min="0"
                            onBlur={() => savePaidAmount(note)}
                            onChange={(event) =>
                              setEditing({ id: note.id, value: event.target.value })
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.currentTarget.blur();
                              }

                              if (event.key === "Escape") {
                                setEditing(null);
                              }
                            }}
                            type="number"
                            value={editing.value}
                          />
                        ) : null}
                        <span>
                          Sisa {formatRupiah(note.remainingPayment)}
                          {note.paymentDeadline
                            ? ` / Jatuh tempo ${formatDate(note.paymentDeadline)}`
                            : ""}
                        </span>
                      </div>
                    </td>
                    <td>
                      <details className="item-preview">
                        <summary>{note.items.length} item</summary>
                        <div>
                          {note.items.map((item) => (
                            <p key={item.id}>
                              <span>{item.lineNo}.</span> {item.partNumber || "-"} -{" "}
                              {item.description} ({item.quantity} {item.uom} x{" "}
                              {formatRupiah(item.unitPrice)})
                            </p>
                          ))}
                        </div>
                      </details>
                    </td>
                    <td>
                      <div className="file-action-cell">
                        {note.invoiceFileName || note.invoiceFileUrl ? (
                          <button
                            className="file-preview-button"
                            onClick={() => openPreview(note, "invoice", "Invoice")}
                            title={fileLabel(
                              note.invoiceFileName || "Invoice",
                              note.invoiceFileSize
                            )}
                            type="button"
                          >
                            <FileIcon />
                            <span>Invoice</span>
                          </button>
                        ) : null}
                        <label className="file-upload-button">
                          <input
                            accept="application/pdf,image/*"
                            onChange={(event) => {
                              uploadFiles(note, "invoice", event.currentTarget.files);
                              event.currentTarget.value = "";
                            }}
                            type="file"
                          />
                          {uploading === `${note.id}:invoice` ? "Uploading..." : "Upload"}
                        </label>
                      </div>
                    </td>
                    <td>
                      <div className="file-action-cell">
                        {proofs.length > 0 ? (
                          <button
                            className="file-preview-button"
                            onClick={() =>
                              openPreview(note, "paymentProof", "Bukti Bayar")
                            }
                            title={fileLabel(
                              proofs[0]?.name || "Bukti Bayar",
                              proofs[0]?.size || 0
                            )}
                            type="button"
                          >
                            <FileIcon />
                            <span>
                              Bukti Bayar{proofs.length > 1 ? ` (${proofs.length})` : ""}
                            </span>
                          </button>
                        ) : null}
                        <label className="file-upload-button">
                          <input
                            accept="application/pdf,image/*"
                            multiple
                            onChange={(event) => {
                              uploadFiles(note, "paymentProof", event.currentTarget.files);
                              event.currentTarget.value = "";
                            }}
                            type="file"
                          />
                          {uploading === `${note.id}:paymentProof`
                            ? "Uploading..."
                            : "Upload"}
                        </label>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9}>Tidak ada nota supplier sesuai filter.</td>
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
