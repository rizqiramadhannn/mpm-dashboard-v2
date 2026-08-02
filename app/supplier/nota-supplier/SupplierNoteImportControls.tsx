"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { defaultPaymentTerm, paymentTermOptions } from "../../components/paymentTerms";

type PendingImport = {
  createdAt: string;
  customerId: string | null;
  customerName: string;
  fileMimeType: string;
  fileName: string;
  fileSize: number;
  flag: string;
  id: string;
  paymentTerm: string;
  purchasePurpose: string;
  status: string;
};

type CustomerOption = {
  code: string;
  defaultPaymentTerm: string;
  id: string | number;
  name: string;
};

type SupplierOption = {
  defaultPaymentTerm: string;
  id: string;
  name: string;
};

type ImportItem = {
  description: string;
  partNumber: string;
  quantity: number;
  totalPrice: number;
  unitPrice: number;
  uom: string;
};

type ImportPayload = {
  customerName: string;
  flag: string;
  items: ImportItem[];
  noteDate: string;
  noteNo: string;
  paidAmount: number;
  paymentDeadline: string;
  paymentTerm: string;
  purchasePurpose: string;
  supplierName: string;
};

type EditableItemField = keyof ImportItem;

type EditingItemCell = {
  field: EditableItemField;
  index: number;
  value: string;
} | null;

const emptyPayload: ImportPayload = {
  customerName: "",
  flag: "MPM",
  items: [],
  noteDate: new Date().toISOString().slice(0, 10),
  noteNo: "",
  paidAmount: 0,
  paymentDeadline: "",
  paymentTerm: defaultPaymentTerm,
  purchasePurpose: "Pembelian Langsung",
  supplierName: "",
};

const purposeOptions = ["Pembelian Langsung", "Stock"] as const;

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatFileSize(value: number) {
  if (!value) {
    return "-";
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function paymentDeadlineFromTerm(noteDate: string, paymentTerm: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate)) {
    return "";
  }

  const normalizedTerm = paymentTerm.trim().toUpperCase();

  if (normalizedTerm === "CBD" || normalizedTerm === "COD") {
    return noteDate;
  }

  const topMatch = normalizedTerm.match(/^TOP\s+(\d+)\s+HARI$/);

  if (!topMatch) {
    return "";
  }

  const days = Number(topMatch[1]);
  const [year, month, day] = noteDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function normalizePayload(
  value: unknown,
  pendingImport: PendingImport,
  customerDefaultTerm: string
): ImportPayload {
  const raw = (value ?? {}) as Partial<ImportPayload>;
  const rawItems = Array.isArray(raw.items) ? raw.items : [];

  return {
    ...emptyPayload,
    ...raw,
    customerName: pendingImport.customerName,
    flag: pendingImport.flag || "MPM",
    items: rawItems.map((item) => {
      const row = item as Partial<ImportItem>;
      const quantity = Number(row.quantity ?? 0);
      const unitPrice = Number(row.unitPrice ?? 0);
      const totalPrice = Number(row.totalPrice ?? quantity * unitPrice);

      return {
        description: String(row.description ?? ""),
        partNumber: String(row.partNumber ?? ""),
        quantity: Number.isFinite(quantity) ? quantity : 0,
        totalPrice: Number.isFinite(totalPrice) ? totalPrice : 0,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
        uom: String(row.uom ?? "Pcs") || "Pcs",
      };
    }),
    noteDate: String(raw.noteDate ?? emptyPayload.noteDate),
    noteNo: String(raw.noteNo ?? ""),
    paidAmount: Number(raw.paidAmount ?? 0) || 0,
    paymentDeadline:
      String(raw.paymentDeadline ?? "") ||
      paymentDeadlineFromTerm(
        String(raw.noteDate ?? emptyPayload.noteDate),
        customerDefaultTerm
      ),
    paymentTerm: customerDefaultTerm,
    purchasePurpose: pendingImport.purchasePurpose || "Pembelian Langsung",
    supplierName: "",
  };
}

export function SupplierNoteImportControls({
  customers,
  suppliers,
}: {
  customers: CustomerOption[];
  suppliers: SupplierOption[];
}) {
  const router = useRouter();
  const firstCustomer = customers[0] ?? null;
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);
  const [savingImport, setSavingImport] = useState(false);
  const [pendingImports, setPendingImports] = useState<PendingImport[]>([]);
  const [selectedImport, setSelectedImport] = useState<PendingImport | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [uploadCustomerId, setUploadCustomerId] = useState(
    firstCustomer ? String(firstCustomer.id) : ""
  );
  const [uploadFlag, setUploadFlag] = useState("MPM");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPurchasePurpose, setUploadPurchasePurpose] = useState("Pembelian Langsung");
  const [editingItemCell, setEditingItemCell] = useState<EditingItemCell>(null);
  const [reviewPayload, setReviewPayload] = useState<ImportPayload>(emptyPayload);

  function selectedUploadCustomer() {
    return customers.find((customer) => String(customer.id) === uploadCustomerId) ?? null;
  }

  function updateUploadCustomer(customerId: string) {
    setUploadCustomerId(customerId);
  }

  function updateReviewCustomer(customerName: string) {
    const customer = customers.find((row) => row.name === customerName) ?? null;
    setReviewPayload((current) => ({
      ...current,
      customerName,
      paymentDeadline: paymentDeadlineFromTerm(
        current.noteDate,
        customer?.defaultPaymentTerm || current.paymentTerm || defaultPaymentTerm
      ),
      paymentTerm: customer?.defaultPaymentTerm || current.paymentTerm || defaultPaymentTerm,
    }));
  }

  async function loadPending() {
    setLoadingPending(true);

    try {
      const response = await fetch("/api/supplier-note-imports");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Gagal memuat pending nota.");
      }

      setPendingImports(result.data ?? []);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Gagal memuat pending nota.");
    } finally {
      setLoadingPending(false);
    }
  }

  async function uploadNota() {
    if (!uploadFile) {
      window.alert("Pilih file nota dulu.");
      return;
    }

    const customer = selectedUploadCustomer();

    if (!customer) {
      window.alert("Pilih customer dulu.");
      return;
    }

    const formData = new FormData();
    formData.set("customerId", String(customer.id));
    formData.set("customerName", customer.name);
    formData.set("file", uploadFile);
    formData.set("flag", uploadFlag);
    formData.set("purchasePurpose", uploadPurchasePurpose);
    setUploading(true);

    try {
      const response = await fetch("/api/supplier-note-imports", {
        body: formData,
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Gagal upload nota.");
      }

      setUploadFile(null);
      setUploadFlag("MPM");
      setUploadCustomerId(firstCustomer ? String(firstCustomer.id) : "");
      setUploadPurchasePurpose("Pembelian Langsung");
      setUploadOpen(false);
      await loadPending();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Gagal upload nota.");
    } finally {
      setUploading(false);
    }
  }

  function openJsonImport(pendingImport: PendingImport) {
    setSelectedImport(pendingImport);
    setJsonText("");
    setJsonOpen(true);
  }

  function parseJsonForReview() {
    if (!selectedImport) {
      return;
    }

    try {
      const customerDefaultTerm =
        customers.find((customer) => customer.name === selectedImport.customerName)
          ?.defaultPaymentTerm || defaultPaymentTerm;

      setReviewPayload(
        normalizePayload(JSON.parse(jsonText), selectedImport, customerDefaultTerm)
      );
      setJsonOpen(false);
      setReviewOpen(true);
    } catch {
      window.alert("JSON tidak valid.");
    }
  }

  function updateReviewField(field: keyof ImportPayload, value: string) {
    setReviewPayload((current) => ({
      ...current,
      [field]: field === "paidAmount" ? Number(value) || 0 : value,
      ...(field === "noteDate"
        ? { paymentDeadline: paymentDeadlineFromTerm(value, current.paymentTerm) }
        : {}),
      ...(field === "paymentTerm"
        ? { paymentDeadline: paymentDeadlineFromTerm(current.noteDate, value) }
        : {}),
    }));
  }

  function updateReviewItem(index: number, patch: Partial<ImportItem>) {
    setReviewPayload((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
              totalPrice:
                patch.quantity !== undefined || patch.unitPrice !== undefined
                  ? (patch.quantity ?? item.quantity) * (patch.unitPrice ?? item.unitPrice)
                  : (patch.totalPrice ?? item.totalPrice),
            }
          : item
      ),
    }));
  }

  function startEditingItemCell(
    index: number,
    field: EditableItemField,
    value: string | number
  ) {
    setEditingItemCell({
      field,
      index,
      value: String(value ?? ""),
    });
  }

  function commitEditingItemCell() {
    if (!editingItemCell) {
      return;
    }

    const { field, index, value } = editingItemCell;
    const numericFields: EditableItemField[] = ["quantity", "unitPrice", "totalPrice"];
    const patch = numericFields.includes(field)
      ? { [field]: Number(value) || 0 }
      : { [field]: value };

    updateReviewItem(index, patch);
    setEditingItemCell(null);
  }

  function itemCellDisplayValue(item: ImportItem, field: EditableItemField) {
    const value = item[field];
    return value === "" ? "-" : String(value);
  }

  function renderEditableItemCell(
    item: ImportItem,
    index: number,
    field: EditableItemField,
    inputType: "number" | "text" = "text"
  ) {
    const isEditing =
      editingItemCell?.index === index && editingItemCell.field === field;

    if (isEditing) {
      return (
        <input
          autoFocus
          className="supplier-review-cell-input"
          min={inputType === "number" ? "0" : undefined}
          onBlur={commitEditingItemCell}
          onChange={(event) =>
            setEditingItemCell((current) =>
              current ? { ...current, value: event.target.value } : current
            )
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }

            if (event.key === "Escape") {
              setEditingItemCell(null);
            }
          }}
          type={inputType}
          value={editingItemCell.value}
        />
      );
    }

    return (
      <button
        className="supplier-review-cell-display"
        onDoubleClick={() => startEditingItemCell(index, field, item[field])}
        title="Double click untuk edit, Enter untuk simpan"
        type="button"
      >
        {itemCellDisplayValue(item, field)}
      </button>
    );
  }

  function addReviewItem() {
    setReviewPayload((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          description: "",
          partNumber: "",
          quantity: 1,
          totalPrice: 0,
          unitPrice: 0,
          uom: "Pcs",
        },
      ],
    }));
  }

  function removeReviewItem(index: number) {
    setReviewPayload((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function saveImport() {
    if (!selectedImport) {
      return;
    }

    if (!reviewPayload.supplierName.trim()) {
      window.alert("Pilih supplier dulu.");
      return;
    }

    if (!reviewPayload.customerName.trim()) {
      window.alert("Pilih customer dulu.");
      return;
    }

    if (!window.confirm(`Simpan hasil import untuk ${selectedImport.fileName}?`)) {
      return;
    }

    setSavingImport(true);

    try {
      const response = await fetch(`/api/supplier-note-imports/${selectedImport.id}/import`, {
        body: JSON.stringify({
          ...reviewPayload,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Gagal simpan hasil import.");
      }

      setPendingImports((current) =>
        current.filter((pendingImport) => pendingImport.id !== selectedImport.id)
      );
      setReviewOpen(false);
      setSelectedImport(null);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Gagal simpan hasil import.");
    } finally {
      setSavingImport(false);
    }
  }

  return (
    <>
      <div className="supplier-note-header-actions">
        <button className="secondary-button" onClick={() => setUploadOpen(true)} type="button">
          Upload Nota
        </button>
        <button
          className="secondary-button"
          onClick={async () => {
            setPendingOpen(true);
            await loadPending();
          }}
          type="button"
        >
          Check Pending Nota
        </button>
      </div>

      {uploadOpen ? (
        <div className="preview-modal-backdrop" role="presentation">
          <div aria-modal="true" className="preview-modal supplier-import-modal" role="dialog">
            <div className="preview-modal-header">
              <div className="preview-modal-title">
                <strong>Upload Nota</strong>
                <span>Upload PDF atau image sebagai base nota.</span>
              </div>
              <button onClick={() => setUploadOpen(false)} type="button">
                Tutup
              </button>
            </div>
            <div className="supplier-import-form">
              <label>
                <span>Customer</span>
                <select
                  onChange={(event) => updateUploadCustomer(event.target.value)}
                  value={uploadCustomerId}
                >
                  {customers.length > 0 ? (
                    customers.map((customer) => (
                      <option key={customer.id} value={String(customer.id)}>
                        {customer.code} - {customer.name}
                      </option>
                    ))
                  ) : (
                    <option value="">Belum ada customer</option>
                  )}
                </select>
              </label>
              <label>
                <span>File Nota</span>
                <input
                  accept="application/pdf,image/*"
                  onChange={(event) => setUploadFile(event.currentTarget.files?.[0] ?? null)}
                  type="file"
                />
              </label>
              <label>
                <span>Flag</span>
                <select onChange={(event) => setUploadFlag(event.target.value)} value={uploadFlag}>
                  <option value="MPM">MPM</option>
                  <option value="BBR">BBR</option>
                </select>
              </label>
              <label>
                <span>Purpose</span>
                <select
                  onChange={(event) => setUploadPurchasePurpose(event.target.value)}
                  value={uploadPurchasePurpose}
                >
                  {purposeOptions.map((purpose) => (
                    <option key={purpose} value={purpose}>
                      {purpose}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary-button" disabled={uploading} onClick={uploadNota} type="button">
                {uploading ? "Uploading..." : "Simpan Pending"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingOpen ? (
        <div className="preview-modal-backdrop" role="presentation">
          <div aria-modal="true" className="preview-modal supplier-pending-modal" role="dialog">
            <div className="preview-modal-header">
              <div className="preview-modal-title">
                <strong>Pending Nota</strong>
                <span>Nota yang sudah diupload dan belum diimport.</span>
              </div>
              <button onClick={() => setPendingOpen(false)} type="button">
                Tutup
              </button>
            </div>
            <div className="item-list-modal-body">
              <table className="customer-table supplier-pending-table">
                <thead>
                  <tr>
                    <th>Tanggal Upload</th>
                    <th>File</th>
                    <th>Customer</th>
                    <th>Flag</th>
                    <th>Purpose</th>
                    <th>Size</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingPending ? (
                    <tr>
                      <td colSpan={7}>Loading pending nota...</td>
                    </tr>
                  ) : pendingImports.length > 0 ? (
                    pendingImports.map((pendingImport) => (
                      <tr key={pendingImport.id}>
                        <td>{formatDateTime(pendingImport.createdAt)}</td>
                        <td>
                          <strong className="table-primary">{pendingImport.fileName}</strong>
                        </td>
                        <td>{pendingImport.customerName}</td>
                        <td>{pendingImport.flag}</td>
                        <td>{pendingImport.purchasePurpose}</td>
                        <td>{formatFileSize(pendingImport.fileSize)}</td>
                        <td>
                          <div className="table-actions">
                            <a
                              href={`/supplier/nota-supplier/imports/${pendingImport.id}/download`}
                            >
                              Download
                            </a>
                            <button onClick={() => openJsonImport(pendingImport)} type="button">
                              Import JSON
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>Tidak ada pending nota.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {jsonOpen ? (
        <div className="preview-modal-backdrop" role="presentation">
          <div aria-modal="true" className="preview-modal supplier-import-json-modal" role="dialog">
            <div className="preview-modal-header">
              <div className="preview-modal-title">
                <strong>Import JSON</strong>
                <span>{selectedImport?.fileName}</span>
              </div>
              <button onClick={() => setJsonOpen(false)} type="button">
                Tutup
              </button>
            </div>
            <div className="supplier-import-form">
              <label className="full-width">
                <span>JSON Hasil Analisa</span>
                <textarea
                  onChange={(event) => setJsonText(event.target.value)}
                  placeholder='{"noteNo":"...","noteDate":"...","items":[...]}'
                  value={jsonText}
                />
              </label>
              <button className="primary-button" onClick={parseJsonForReview} type="button">
                Review Import
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reviewOpen ? (
        <div className="preview-modal-backdrop" role="presentation">
          <div aria-modal="true" className="preview-modal supplier-review-modal" role="dialog">
            <div className="preview-modal-header">
              <div className="preview-modal-title">
                <strong>Review Import Nota</strong>
                <span>{selectedImport?.fileName}</span>
              </div>
              <button onClick={() => setReviewOpen(false)} type="button">
                Tutup
              </button>
            </div>
            <div className="supplier-review-body">
              <div className="supplier-review-grid">
                <label>
                  <span>Supplier</span>
                  <select
                    onChange={(event) => updateReviewField("supplierName", event.target.value)}
                    value={reviewPayload.supplierName}
                  >
                    <option value="">Pilih supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.name}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>No Nota</span>
                  <input
                    onChange={(event) => updateReviewField("noteNo", event.target.value)}
                    value={reviewPayload.noteNo}
                  />
                </label>
                <label>
                  <span>Tanggal</span>
                  <input
                    onChange={(event) => updateReviewField("noteDate", event.target.value)}
                    type="date"
                    value={reviewPayload.noteDate}
                  />
                </label>
                <label>
                  <span>Flag</span>
                  <select
                    onChange={(event) => updateReviewField("flag", event.target.value)}
                    value={reviewPayload.flag}
                  >
                    <option value="MPM">MPM</option>
                    <option value="BBR">BBR</option>
                  </select>
                </label>
                <label>
                  <span>Payment Term</span>
                  <select
                    onChange={(event) => updateReviewField("paymentTerm", event.target.value)}
                    value={reviewPayload.paymentTerm}
                  >
                    {paymentTermOptions.map((term) => (
                      <option key={term} value={term}>
                        {term}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Payment Deadline</span>
                  <input
                    onChange={(event) => updateReviewField("paymentDeadline", event.target.value)}
                    type="date"
                    value={reviewPayload.paymentDeadline}
                  />
                </label>
                <label>
                  <span>Terbayar</span>
                  <input
                    min="0"
                    onChange={(event) => updateReviewField("paidAmount", event.target.value)}
                    type="number"
                    value={reviewPayload.paidAmount || ""}
                  />
                </label>
                <label>
                  <span>Purpose</span>
                  <select
                    onChange={(event) => updateReviewField("purchasePurpose", event.target.value)}
                    value={reviewPayload.purchasePurpose}
                  >
                    {purposeOptions.map((purpose) => (
                      <option key={purpose} value={purpose}>
                        {purpose}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Customer</span>
                  <select
                    onChange={(event) => updateReviewCustomer(event.target.value)}
                    value={reviewPayload.customerName}
                  >
                    <option value="">Pilih customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.name}>
                        {customer.code} - {customer.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="supplier-review-items-heading">
                <strong>Item</strong>
                <button className="secondary-button" onClick={addReviewItem} type="button">
                  Tambah Item
                </button>
              </div>
              <div className="customer-table-wrap">
                <table className="customer-table supplier-review-items-table">
                  <thead>
                    <tr>
                      <th>PN</th>
                      <th>Deskripsi</th>
                      <th>Qty</th>
                      <th>UoM</th>
                      <th>Harga</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewPayload.items.map((item, index) => (
                      <tr key={`${item.partNumber}-${index}`}>
                        <td>
                          {renderEditableItemCell(item, index, "partNumber")}
                        </td>
                        <td>
                          {renderEditableItemCell(item, index, "description")}
                        </td>
                        <td>
                          {renderEditableItemCell(item, index, "quantity", "number")}
                        </td>
                        <td>
                          {renderEditableItemCell(item, index, "uom")}
                        </td>
                        <td>
                          {renderEditableItemCell(item, index, "unitPrice", "number")}
                        </td>
                        <td>
                          {renderEditableItemCell(item, index, "totalPrice", "number")}
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            onClick={() => removeReviewItem(index)}
                            type="button"
                            aria-label={`Hapus item ${index + 1}`}
                          >
                            x
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="supplier-review-actions">
                <button
                  className="primary-button"
                  disabled={savingImport}
                  onClick={saveImport}
                  type="button"
                >
                  {savingImport ? "Menyimpan..." : "Simpan Nota"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
