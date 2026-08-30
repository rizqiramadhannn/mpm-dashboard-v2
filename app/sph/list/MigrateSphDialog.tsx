"use client";

import { useMemo, useState, useTransition } from "react";
import { ItemListModal } from "./ItemListModal";

type SphItem = {
  id: string;
  lineNo: number;
  partNumber: string;
  partName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type MigratableSphRow = {
  customerCode: string;
  customerName: string;
  id: string;
  items: SphItem[];
  paymentTerm: string;
  sphDate: string;
  sphNo: string;
  status: string;
  statusLabel: string;
  totalAmount: number;
};

type MigrateSphDialogProps = {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  rows: MigratableSphRow[];
};

function formatDate(value: string) {
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

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function MigrateSphDialog({ action, rows }: MigrateSphDialogProps) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [listOpen, setListOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetMonth, setTargetMonth] = useState(currentMonthValue);

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.id)),
    [rows, selectedIds]
  );
  const allVisibleSelected = rows.length > 0 && selectedIds.length === rows.length;
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.totalAmount, 0);

  function closeAll() {
    setError("");
    setListOpen(false);
    setMonthOpen(false);
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? rows.map((row) => row.id) : []);
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, id])] : current.filter((selectedId) => selectedId !== id)
    );
  }

  function openMonthDialog() {
    if (selectedIds.length === 0) {
      setError("Pilih minimal satu SPH untuk dimigrasi.");
      return;
    }

    setError("");
    setMonthOpen(true);
  }

  function submitMigration() {
    const formData = new FormData();
    formData.set("targetMonth", targetMonth);

    for (const id of selectedIds) {
      formData.append("sphId", id);
    }

    startTransition(async () => {
      try {
        setError("");
        const result = await action(formData);

        if (result?.error) {
          setError(result.error);
          return;
        }

        closeAll();
        setSelectedIds([]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Gagal migrate SPH.");
      }
    });
  }

  return (
    <>
      <button className="secondary-button" onClick={() => setListOpen(true)} type="button">
        Migrate SPH
      </button>

      {listOpen ? (
        <div className="preview-modal-backdrop" role="presentation">
          <div
            aria-labelledby="migrate-sph-title"
            aria-modal="true"
            className="preview-modal migrate-sph-modal"
            role="dialog"
          >
            <div className="preview-modal-header">
              <div className="preview-modal-title">
                <strong id="migrate-sph-title">Migrate SPH</strong>
                <span>
                  {rows.length} SPH dengan status Menunggu Pengiriman, Cek Harga, atau Cancel
                </span>
              </div>
              <button onClick={closeAll} type="button">
                Tutup
              </button>
            </div>

            <div className="migrate-sph-body">
              {error ? <div className="inline-error">{error}</div> : null}
              <div className="customer-table-wrap migrate-sph-table-wrap">
                <table className="customer-table migrate-sph-table">
                  <thead>
                    <tr>
                      <th className="checkbox-cell">
                        <input
                          aria-label="Pilih semua SPH"
                          checked={allVisibleSelected}
                          disabled={rows.length === 0}
                          onChange={(event) => toggleAll(event.target.checked)}
                          type="checkbox"
                        />
                      </th>
                      <th>No. SPH</th>
                      <th>Tanggal</th>
                      <th>Customer</th>
                      <th>Payment</th>
                      <th>Total</th>
                      <th>Item</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length > 0 ? (
                      rows.map((row) => (
                        <tr key={row.id}>
                          <td className="checkbox-cell">
                            <input
                              aria-label={`Pilih ${row.sphNo}`}
                              checked={selectedIds.includes(row.id)}
                              onChange={(event) => toggleOne(row.id, event.target.checked)}
                              type="checkbox"
                            />
                          </td>
                          <td>
                            <strong className="table-primary">{row.sphNo}</strong>
                          </td>
                          <td>{formatDate(row.sphDate)}</td>
                          <td>
                            <div className="stacked-cell">
                              <strong>{row.customerName}</strong>
                              <span>{row.customerCode}</span>
                            </div>
                          </td>
                          <td>{row.paymentTerm}</td>
                          <td>{formatRupiah(row.totalAmount)}</td>
                          <td>
                            <ItemListModal items={row.items} sphNo={row.sphNo} />
                          </td>
                          <td>
                            <span className={`status-badge ${row.status}`}>
                              {row.statusLabel}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8}>Tidak ada SPH yang bisa dimigrasi.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="migrate-sph-footer">
              <div>
                <strong>{selectedIds.length} SPH dipilih</strong>
                <span>{formatRupiah(selectedTotal)}</span>
              </div>
              <div className="migrate-sph-actions">
                <button className="secondary-button" onClick={closeAll} type="button">
                  Cancel
                </button>
                <button
                  className="primary-button"
                  disabled={selectedIds.length === 0}
                  onClick={openMonthDialog}
                  type="button"
                >
                  Migrate
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {monthOpen ? (
        <div className="preview-modal-backdrop migrate-month-backdrop" role="presentation">
          <div
            aria-labelledby="migrate-month-title"
            aria-modal="true"
            className="preview-modal migrate-month-modal"
            role="dialog"
          >
            <div className="preview-modal-header">
              <div className="preview-modal-title">
                <strong id="migrate-month-title">Pilih Bulan Migrasi</strong>
                <span>{selectedIds.length} SPH akan diberi nomor bulan baru</span>
              </div>
              <button disabled={isPending} onClick={() => setMonthOpen(false)} type="button">
                Kembali
              </button>
            </div>

            <div className="migrate-month-body">
              <label>
                <span>Bulan dan Tahun</span>
                <input
                  autoFocus
                  disabled={isPending}
                  onChange={(event) => setTargetMonth(event.target.value)}
                  required
                  type="month"
                  value={targetMonth}
                />
              </label>
              <div className="migrate-month-summary">
                <strong>{selectedIds.length} SPH</strong>
                <span>{formatRupiah(selectedTotal)}</span>
              </div>
              {error ? <div className="inline-error">{error}</div> : null}
            </div>

            <div className="migrate-sph-footer">
              <span>Tanggal data menjadi tanggal 1 bulan tujuan, tanggal PDF tetap.</span>
              <div className="migrate-sph-actions">
                <button
                  className="secondary-button"
                  disabled={isPending}
                  onClick={() => setMonthOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  disabled={isPending || !targetMonth}
                  onClick={submitMigration}
                  type="button"
                >
                  {isPending ? "Migrating..." : "Migrate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
