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
  paymentProofCount: number;
  shipmentId: string | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
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
  paymentProofCount,
  shipmentId,
}: ShipmentProofUploadProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);

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

  return (
    <div className="shipment-proof-upload">
      <label className="file-upload-button">
        <input
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
      <span className="file-meta">{paymentProofCount} file</span>
    </div>
  );
}
