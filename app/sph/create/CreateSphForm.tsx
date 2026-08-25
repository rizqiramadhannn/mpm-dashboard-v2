"use client";

import { useActionState, useMemo, useState, type FormEvent } from "react";
import { ConfirmForm } from "../../components/ConfirmForm";

type CustomerOption = {
  id: string;
  code: string;
  name: string;
  detailLine1: string;
  detailLine2: string;
  detailLine3: string;
  monthlyCreditLimit: number;
  sphCreditLimit: number;
  monthlyOutstandingInvoiceAmount?: number;
};

type CreateSphFormProps = {
  action: (state: SphFormState, formData: FormData) => Promise<SphFormState>;
  canEditStatus?: boolean;
  customers: CustomerOption[];
  initialValues?: {
    additionalInfo: string;
    customerId: string | null;
    deliveryDate: string;
    etaDate: string;
    franco: string;
    items: {
      id: string;
      partName: string;
      partNumber: string;
      quantity: number;
      unitPrice: number;
    }[];
    paymentTerm: string;
    sphDate: string;
    sphId?: string;
    sphNo?: string;
    status?: SphStatus;
  };
  submitLabel?: string;
  title?: string;
};

export type SphFormState = {
  error: string;
};

type SphStatus =
  | "cek_harga"
  | "menunggu_pengiriman"
  | "proses_pengiriman"
  | "selesai"
  | "cancel";

const sphStatusOptions: { label: string; value: SphStatus }[] = [
  { label: "Cek Harga", value: "cek_harga" },
  { label: "Menunggu Pengiriman", value: "menunggu_pengiriman" },
  { label: "Proses Pengiriman", value: "proses_pengiriman" },
  { label: "Selesai", value: "selesai" },
  { label: "Cancel", value: "cancel" },
];

function calculateSphTotal(formData: FormData) {
  const quantities = formData.getAll("quantity");
  const unitPrices = formData.getAll("unitPrice");

  return quantities.reduce((sum, quantityValue, index) => {
    const quantity = Number(quantityValue);
    const unitPrice = Number(unitPrices[index] ?? 0);

    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
      return sum;
    }

    return sum + quantity * unitPrice;
  }, 0);
}

type ItemRow = {
  id: string | number;
  partName?: string;
  partNumber?: string;
  quantity?: number;
  unitPrice?: number;
};

export function CreateSphForm({
  action,
  canEditStatus = true,
  customers,
  initialValues,
  submitLabel = "Simpan SPH",
  title = "Create SPH",
}: CreateSphFormProps) {
  const [state, formAction, isPending] = useActionState(action, { error: "" });
  const [rows, setRows] = useState<ItemRow[]>(
    initialValues?.items.length ? initialValues.items : [{ id: 1 }]
  );
  const [formTotal, setFormTotal] = useState(
    initialValues?.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    ) ?? 0
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    initialValues?.customerId?.toString() ?? customers[0]?.id.toString() ?? ""
  );

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id.toString() === selectedCustomerId),
    [customers, selectedCustomerId]
  );
  const selectedCustomerOutstanding =
    selectedCustomer?.monthlyOutstandingInvoiceAmount ?? 0;
  const selectedCustomerOverLimit = selectedCustomer
    ? selectedCustomer.monthlyCreditLimit > 0 &&
      selectedCustomerOutstanding > selectedCustomer.monthlyCreditLimit
    : false;
  const selectedCustomerSphOverLimit = selectedCustomer
    ? selectedCustomer.sphCreditLimit > 0 && formTotal > selectedCustomer.sphCreditLimit
    : false;

  function formatMoney(value: number) {
    return `Rp ${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 0,
    }).format(value)}`;
  }

  function addRow() {
    setRows((current) => [...current, { id: Date.now() }]);
  }

  function refreshFormTotal(form: HTMLFormElement) {
    setFormTotal(calculateSphTotal(new FormData(form)));
  }

  function handleFormInput(event: FormEvent<HTMLFormElement>) {
    refreshFormTotal(event.currentTarget);
  }

  function removeRow(id: string | number, form: HTMLFormElement | null) {
    setRows((current) =>
      current.length === 1 ? current : current.filter((row) => row.id !== id)
    );
    if (form) {
      requestAnimationFrame(() => refreshFormTotal(form));
    }
  }

  return (
    <ConfirmForm
      action={formAction}
      className="sph-form"
      confirmMessage={
        initialValues ? "Simpan perubahan SPH ini?" : "Buat SPH baru dengan data ini?"
      }
      onInput={handleFormInput}
    >
      {initialValues ? <input name="sphId" type="hidden" value={initialValues.sphId ?? ""} /> : null}
      <section className="form-section">
        <div className="section-heading">
          <div>
            <p className="page-kicker">Surat Penawaran Harga</p>
            <h1>{title}</h1>
            {initialValues?.sphNo ? <p className="form-subtitle">{initialValues.sphNo}</p> : null}
          </div>
          <button
            className="primary-button"
            disabled={
              customers.length === 0 ||
              selectedCustomerOverLimit ||
              selectedCustomerSphOverLimit ||
              isPending
            }
            type="submit"
          >
            {isPending ? "Menyimpan..." : submitLabel}
          </button>
        </div>

        {state.error ? <div className="empty-state">{state.error}</div> : null}

        {customers.length === 0 ? (
          <div className="empty-state">
            Tambahkan customer terlebih dahulu sebelum membuat SPH.
          </div>
        ) : null}

        <div className="form-grid">
          <label>
            <span>Customer</span>
            <select
              name="customerId"
              onChange={(event) => setSelectedCustomerId(event.target.value)}
              required
              value={selectedCustomerId}
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.code} - {customer.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Tgl. SPH</span>
            <input name="sphDate" required type="date" defaultValue={initialValues?.sphDate} />
          </label>

          <label>
            <span>Pembayaran</span>
            <input name="paymentTerm" required defaultValue={initialValues?.paymentTerm ?? "CBD"} />
          </label>

          <label>
            <span>Franco</span>
            <input
              name="franco"
              required
              defaultValue={initialValues?.franco ?? selectedCustomer?.detailLine1 ?? ""}
            />
          </label>

          <label>
            <span>Tgl Pengiriman</span>
            <input
              name="deliveryDate"
              type="date"
              defaultValue={initialValues?.deliveryDate}
            />
          </label>

          <label>
            <span>ETA</span>
            <input name="etaDate" type="date" defaultValue={initialValues?.etaDate} />
          </label>

          <label className="full-width">
            <span>Tambahan / Keterangan</span>
            <input
              name="additionalInfo"
              placeholder="Opsional"
              defaultValue={initialValues?.additionalInfo}
            />
          </label>

          {initialValues && canEditStatus ? (
            <label>
              <span>Status</span>
              <select name="status" defaultValue={initialValues.status ?? "cek_harga"}>
                {sphStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {initialValues && !canEditStatus ? (
            <>
              <input name="status" type="hidden" value={initialValues.status ?? "cek_harga"} />
              <label>
                <span>Status</span>
                <input
                  disabled
                  value={
                    sphStatusOptions.find(
                      (status) => status.value === (initialValues.status ?? "cek_harga")
                    )?.label ?? initialValues.status ?? "Cek Harga"
                  }
                />
              </label>
            </>
          ) : null}
        </div>

        {selectedCustomer ? (
          <div
            className={`customer-preview ${
              selectedCustomerOverLimit ? "credit-over-limit" : ""
            }`}
          >
            <strong>{selectedCustomer.name}</strong>
            <span>{selectedCustomer.detailLine1 || "-"}</span>
            <span>{selectedCustomer.detailLine2 || "-"}</span>
            <span>{selectedCustomer.detailLine3 || "-"}</span>
            <span>
              Limit Bulanan:{" "}
              {selectedCustomer.monthlyCreditLimit > 0
                ? formatMoney(selectedCustomer.monthlyCreditLimit)
                : "Tidak ada limit"}
            </span>
            <span>
              Limit Per SPH:{" "}
              {selectedCustomer.sphCreditLimit > 0
                ? formatMoney(selectedCustomer.sphCreditLimit)
                : "Tidak ada limit"}
            </span>
            <span>Total SPH Saat Ini: {formatMoney(formTotal)}</span>
            <span>
              Invoice Belum Lunas Bulan Ini: {formatMoney(selectedCustomerOutstanding)}
            </span>
            {selectedCustomerSphOverLimit ? (
              <span className="credit-warning">
                Total SPH melebihi limit per SPH customer ini.
              </span>
            ) : null}
            {selectedCustomerOverLimit ? (
              <span className="credit-warning">
                SPH baru diblokir sampai outstanding invoice bulan ini turun di bawah limit.
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="form-section">
        <div className="section-heading compact">
          <div>
            <h2>Item</h2>
            <p>Part Number, Part Name, Qty, dan Harga Satuan.</p>
          </div>
          <button className="secondary-button" onClick={addRow} type="button">
            Tambah Item
          </button>
        </div>

        <div className="item-table-wrap">
          <table className="item-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Part Number</th>
                <th>Part Name</th>
                <th>Qty</th>
                <th>Harga Satuan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>
                    <input
                      name="partNumber"
                      placeholder="WG9761450185"
                      defaultValue={row.partNumber}
                    />
                  </td>
                  <td>
                    <input
                      name="partName"
                      required
                      placeholder="Nama sparepart"
                      defaultValue={row.partName}
                    />
                  </td>
                  <td>
                    <input
                      min="1"
                      name="quantity"
                      required
                      type="number"
                      defaultValue={row.quantity}
                    />
                  </td>
                  <td>
                    <input
                      min="0"
                      name="unitPrice"
                      required
                      type="number"
                      defaultValue={row.unitPrice}
                    />
                  </td>
                  <td>
                    <button
                      aria-label={`Hapus item ${index + 1}`}
                      className="icon-button"
                      disabled={rows.length === 1}
                      onClick={(event) => removeRow(row.id, event.currentTarget.form)}
                      type="button"
                    >
                      x
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </ConfirmForm>
  );
}
