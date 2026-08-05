"use client";

import { useState } from "react";
import { ConfirmForm } from "../components/ConfirmForm";

type PaymentRequestRow = {
  amount: number;
  description: string;
  destinationAccount: string;
  id: string;
  requestDate: string;
  requestedByUsername: string;
  sourceFund: string;
  status: string;
  transactionPurpose: string;
};

type PaymentRequestTableProps = {
  canDelete: boolean;
  deleteAction: (formData: FormData) => void;
  rows: PaymentRequestRow[];
  updateAction: (formData: FormData) => void;
};

function formatDate(value: string | null) {
  if (!value) return "-";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value);
}

function EditIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="m20 6-11 11-5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M3 6h18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M8 6V4h8v2m-1 5v6M9 11v6m-3-11 1 14h10l1-14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function PaymentRequestTable({
  canDelete,
  deleteAction,
  rows,
  updateAction,
}: PaymentRequestTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="customer-table-wrap">
      <table className="customer-table payment-request-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Tanggal</th>
            <th>Diajukan Oleh</th>
            <th>Sumber Dana</th>
            <th>Nominal</th>
            <th>Rek Tujuan</th>
            <th>Deskripsi</th>
            <th>Tujuan Transaksi</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row, index) => {
              const isEditing = editingId === row.id;
              const formId = `payment-request-${row.id}`;

              return (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>
                    {isEditing ? (
                      <input
                        className="inline-date-input"
                        form={formId}
                        name="requestDate"
                        required
                        type="date"
                        defaultValue={row.requestDate}
                      />
                    ) : (
                      formatDate(row.requestDate)
                    )}
                  </td>
                  <td>{row.requestedByUsername || "-"}</td>
                  <td>
                    {isEditing ? (
                      <input
                        className="inline-text-input"
                        form={formId}
                        name="sourceFund"
                        required
                        defaultValue={row.sourceFund}
                      />
                    ) : (
                      row.sourceFund
                    )}
                  </td>
                  <td className={isEditing ? "" : "numeric-cell"}>
                    {isEditing ? (
                      <input
                        className="inline-money-input"
                        form={formId}
                        inputMode="numeric"
                        name="amount"
                        required
                        defaultValue={formatRupiah(row.amount)}
                      />
                    ) : (
                      formatRupiah(row.amount)
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className="inline-text-input"
                        form={formId}
                        name="destinationAccount"
                        required
                        defaultValue={row.destinationAccount}
                      />
                    ) : (
                      row.destinationAccount
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className="inline-text-input wide"
                        form={formId}
                        name="description"
                        required
                        defaultValue={row.description}
                      />
                    ) : (
                      row.description
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className="inline-text-input wide"
                        form={formId}
                        name="transactionPurpose"
                        required
                        defaultValue={row.transactionPurpose}
                      />
                    ) : (
                      row.transactionPurpose
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        aria-label={`Status ${row.description}`}
                        className="inline-status-input"
                        form={formId}
                        name="status"
                        placeholder="-"
                        defaultValue={row.status}
                      />
                    ) : (
                      row.status || "-"
                    )}
                  </td>
                  <td>
                    <div className="table-actions icon-actions">
                      {isEditing ? (
                        <>
                          <ConfirmForm
                            action={updateAction}
                            confirmMessage={`Simpan perubahan payment request ${row.description}?`}
                            id={formId}
                          >
                            <input name="id" type="hidden" value={row.id} />
                            <button
                              aria-label={`Simpan ${row.description}`}
                              className="icon-action success"
                              title="Simpan"
                              type="submit"
                            >
                              <SaveIcon />
                            </button>
                          </ConfirmForm>
                          <button
                            aria-label={`Batal edit ${row.description}`}
                            className="icon-action"
                            onClick={() => setEditingId(null)}
                            title="Batal"
                            type="button"
                          >
                            <CancelIcon />
                          </button>
                        </>
                      ) : (
                        <button
                          aria-label={`Edit ${row.description}`}
                          className="icon-action"
                          onClick={() => setEditingId(row.id)}
                          title="Edit"
                          type="button"
                        >
                          <EditIcon />
                        </button>
                      )}
                      {canDelete && !isEditing ? (
                        <ConfirmForm
                          action={deleteAction}
                          confirmMessage={`Hapus payment request ${row.description}?`}
                        >
                          <input name="id" type="hidden" value={row.id} />
                          <button
                            aria-label={`Hapus ${row.description}`}
                            className="icon-action danger"
                            title="Hapus"
                            type="submit"
                          >
                            <TrashIcon />
                          </button>
                        </ConfirmForm>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={10}>Belum ada payment request sesuai filter.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
