"use client";

import { useState } from "react";

type SphItem = {
  id: string;
  lineNo: number;
  partNumber: string;
  partName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type ItemListModalProps = {
  items: SphItem[];
  sphNo: string;
};

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export function ItemListModal({ items, sphNo }: ItemListModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="item-modal-trigger" onClick={() => setOpen(true)} type="button">
        {items.length} item
      </button>

      {open ? (
        <div className="preview-modal-backdrop" role="presentation">
          <div aria-modal="true" className="preview-modal item-list-modal" role="dialog">
            <div className="preview-modal-header">
              <div className="preview-modal-title">
                <strong>Item SPH</strong>
                <span>{sphNo}</span>
              </div>
              <button onClick={() => setOpen(false)} type="button">
                Tutup
              </button>
            </div>

            <div className="item-list-modal-body">
              <table className="customer-table item-list-modal-table" data-sortable-table>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Part Number</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Harga</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length > 0 ? (
                    items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.lineNo}</td>
                        <td>{item.partNumber || "-"}</td>
                        <td>
                          <strong className="table-primary">{item.partName}</strong>
                        </td>
                        <td>{item.quantity}</td>
                        <td>{formatRupiah(item.unitPrice)}</td>
                        <td>{formatRupiah(item.totalPrice)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>Belum ada item.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
