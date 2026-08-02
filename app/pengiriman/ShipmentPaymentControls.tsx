"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ShipmentMoneyControlProps = {
  amount: number;
  disabled?: boolean;
  field: "paidAmount" | "shippingCost";
  label: string;
  shipmentId: string | null;
};

type ShipmentProofUploadProps = {
  disabled?: boolean;
  paymentProofFiles: ShipmentPaymentProofFile[];
  shipmentId: string | null;
  ttbNo: string;
};

type ShipmentPaymentProofFile = {
  mimeType: string;
  name: string;
  size: number;
};

type PreviewState = {
  selectedIndex: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function fileLabel(name: string, size: number) {
  const sizeKb = size ? `${Math.ceil(size / 1024).toLocaleString("id-ID")} KB` : "";

  return [name, sizeKb].filter(Boolean).join(" - ");
}

function FileIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M14 2v6h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

async function postShipmentPayment(
  shipmentId: string,
  formData: FormData
) {
  const response = await fetch(`/api/shipments/${shipmentId}/payment`, {
    body: formData,
    method: "POST",
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Gagal update pembayaran pengiriman.");
  }

  return result;
}

export function ShipmentMoneyControl({
  amount,
  disabled = false,
  field,
  label,
  shipmentId,
}: ShipmentMoneyControlProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState(String(amount || ""));

  async function save() {
    if (!shipmentId || disabled) {
      return;
    }

    const formData = new FormData();
    formData.append(field, value || "0");
    setSaving(true);

    try {
      await postShipmentPayment(shipmentId, formData);
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!shipmentId) {
    return <span className="file-meta">Belum ada batch</span>;
  }

  if (editing) {
    return (
      <form
        className="shipment-money-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <input
          className="paid-amount-input"
          disabled={saving}
          min="0"
          onChange={(event) => setValue(event.target.value)}
          type="number"
          value={value}
        />
        <button className="inline-save-button" disabled={saving} type="submit">
          Save
        </button>
      </form>
    );
  }

  return (
    <button
      className="paid-amount-display"
      disabled={disabled || saving}
      onClick={() => setEditing(true)}
      type="button"
    >
      {label} {formatMoney(amount)}
    </button>
  );
}

export function ShipmentProofUpload({
  disabled = false,
  paymentProofFiles,
  shipmentId,
  ttbNo,
}: ShipmentProofUploadProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  async function upload(files: FileList | null) {
    if (!shipmentId || disabled || !files?.length) {
      return;
    }

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("paymentProofFiles", file);
    });
    setUploading(true);

    try {
      await postShipmentPayment(shipmentId, formData);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  if (!shipmentId) {
    return <span className="file-meta">-</span>;
  }

  const previewFile = preview ? paymentProofFiles[preview.selectedIndex] : null;
  const previewUrl =
    preview && previewFile
      ? `/pengiriman/payment-proof/${shipmentId}/download?index=${preview.selectedIndex}&inline=1`
      : "";

  return (
    <>
      <div className="file-action-cell shipment-proof-upload">
        {paymentProofFiles.length > 0 ? (
          <button
            className="file-preview-button"
            onClick={() => setPreview({ selectedIndex: 0 })}
            title={fileLabel(paymentProofFiles[0]?.name || "Bukti Bayar", paymentProofFiles[0]?.size || 0)}
            type="button"
          >
            <FileIcon />
            <span>
              Bukti Bayar{paymentProofFiles.length > 1 ? ` (${paymentProofFiles.length})` : ""}
            </span>
          </button>
        ) : null}
        <label className="file-upload-button">
          <input
            accept="application/pdf,image/*"
            disabled={disabled || uploading}
            multiple
            onChange={(event) => {
              void upload(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
            type="file"
          />
          {uploading ? "Uploading..." : "Upload"}
        </label>
      </div>

      {preview && previewFile ? (
        <div className="preview-modal-backdrop" role="presentation">
          <div aria-modal="true" className="preview-modal" role="dialog">
            <div className="preview-modal-header">
              <div className="preview-modal-title">
                <strong>Bukti Bayar - {ttbNo}</strong>
                <span>{fileLabel(previewFile.name, previewFile.size)}</span>
              </div>
              <button onClick={() => setPreview(null)} type="button">
                Tutup
              </button>
            </div>
            {paymentProofFiles.length > 1 ? (
              <div className="preview-file-tabs">
                {paymentProofFiles.map((file, index) => (
                  <button
                    className={index === preview.selectedIndex ? "active" : ""}
                    key={`${file.name}-${index}`}
                    onClick={() => setPreview({ selectedIndex: index })}
                    type="button"
                  >
                    {file.name || `Bukti Bayar ${index + 1}`}
                  </button>
                ))}
              </div>
            ) : null}
            <iframe className="preview-modal-frame" src={previewUrl} title={`Bukti Bayar ${ttbNo}`} />
          </div>
        </div>
      ) : null}
    </>
  );
}
