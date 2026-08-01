"use client";

import { useMemo, useState } from "react";

type CustomerOption = {
  id: string;
  code: string;
  name: string;
  detailLine1: string;
  detailLine2: string;
  detailLine3: string;
};

type CreateSphFormProps = {
  action: (formData: FormData) => Promise<void>;
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
  };
  submitLabel?: string;
  title?: string;
};

type ItemRow = {
  id: string | number;
  partName?: string;
  partNumber?: string;
  quantity?: number;
  unitPrice?: number;
};

export function CreateSphForm({
  action,
  customers,
  initialValues,
  submitLabel = "Simpan SPH",
  title = "Create SPH",
}: CreateSphFormProps) {
  const [rows, setRows] = useState<ItemRow[]>(
    initialValues?.items.length ? initialValues.items : [{ id: 1 }]
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    initialValues?.customerId?.toString() ?? customers[0]?.id.toString() ?? ""
  );

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id.toString() === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  function addRow() {
    setRows((current) => [...current, { id: Date.now() }]);
  }

  function removeRow(id: string | number) {
    setRows((current) =>
      current.length === 1 ? current : current.filter((row) => row.id !== id)
    );
  }

  return (
    <form action={action} className="sph-form">
      {initialValues ? <input name="sphId" type="hidden" value={initialValues.sphId ?? ""} /> : null}
      <section className="form-section">
        <div className="section-heading">
          <div>
            <p className="page-kicker">Surat Penawaran Harga</p>
            <h1>{title}</h1>
            {initialValues?.sphNo ? <p className="form-subtitle">{initialValues.sphNo}</p> : null}
          </div>
          <button className="primary-button" disabled={customers.length === 0} type="submit">
            {submitLabel}
          </button>
        </div>

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
        </div>

        {selectedCustomer ? (
          <div className="customer-preview">
            <strong>{selectedCustomer.name}</strong>
            <span>{selectedCustomer.detailLine1 || "-"}</span>
            <span>{selectedCustomer.detailLine2 || "-"}</span>
            <span>{selectedCustomer.detailLine3 || "-"}</span>
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
                      onClick={() => removeRow(row.id)}
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
    </form>
  );
}
