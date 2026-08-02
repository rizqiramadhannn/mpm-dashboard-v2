"use client";

import { useMemo, useState } from "react";
import type { AvailableItem, SupplierOption } from "./page";

type ShipmentRow = {
  itemId: string;
  quantity: string;
  rowKey: string;
  sphId: string;
  supply: string;
};

type CreateShipmentItemsTableProps = {
  availableItems: AvailableItem[];
  suppliers: SupplierOption[];
};

function createRow(index: number): ShipmentRow {
  return {
    itemId: "",
    quantity: "",
    rowKey: `shipment-row-${Date.now()}-${index}`,
    sphId: "",
    supply: "stock",
  };
}

export function CreateShipmentItemsTable({
  availableItems,
  suppliers,
}: CreateShipmentItemsTableProps) {
  const [rows, setRows] = useState<ShipmentRow[]>([createRow(1)]);
  const sphOptions = useMemo(() => {
    const options = new Map<
      string,
      { customerCode: string; customerName: string; sphId: string; sphNo: string }
    >();

    for (const item of availableItems) {
      options.set(item.sphId, {
        customerCode: item.customerCode,
        customerName: item.customerName,
        sphId: item.sphId,
        sphNo: item.sphNo,
      });
    }

    return Array.from(options.values()).sort((a, b) => a.sphNo.localeCompare(b.sphNo));
  }, [availableItems]);
  const itemById = useMemo(
    () => new Map(availableItems.map((item) => [item.itemId, item])),
    [availableItems]
  );
  const selectedItemIds = new Set(rows.map((row) => row.itemId).filter(Boolean));

  function updateRow(rowKey: string, patch: Partial<ShipmentRow>) {
    setRows((current) =>
      current.map((row) => (row.rowKey === rowKey ? { ...row, ...patch } : row))
    );
  }

  function removeRow(rowKey: string) {
    setRows((current) =>
      current.length <= 1 ? current : current.filter((row) => row.rowKey !== rowKey)
    );
  }

  function addRow() {
    setRows((current) => [...current, createRow(current.length + 1)]);
  }

  return (
    <section className="form-section">
      <div className="section-heading compact">
        <div>
          <h2>Item Pengiriman</h2>
          <p>Pilih SPH, pilih item yang belum dikirim, lalu isi qty batch ini.</p>
        </div>
        <button className="secondary-button" onClick={addRow} type="button">
          Tambah Baris
        </button>
      </div>

      <div className="customer-table-wrap">
        <table className="customer-table shipment-create-table">
          <thead>
            <tr>
              <th>No</th>
              <th>SPH</th>
              <th>Item</th>
              <th>Supply</th>
              <th>Sisa Qty</th>
              <th>Qty Kirim</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {availableItems.length > 0 ? (
              rows.map((row, index) => {
                const selectedItem = row.itemId ? itemById.get(row.itemId) : null;
                const itemOptions = availableItems.filter((item) => item.sphId === row.sphId);

                return (
                  <tr key={row.rowKey}>
                    <td>{index + 1}</td>
                    <td>
                      <select
                        onChange={(event) =>
                          updateRow(row.rowKey, {
                            itemId: "",
                            quantity: "",
                            sphId: event.target.value,
                            supply: "stock",
                          })
                        }
                        value={row.sphId}
                      >
                        <option value="">Pilih SPH</option>
                        {sphOptions.map((sph) => (
                          <option key={sph.sphId} value={sph.sphId}>
                            {sph.sphNo} - {sph.customerCode}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        disabled={!row.sphId}
                        onChange={(event) => {
                          const item = itemById.get(event.target.value);

                          updateRow(row.rowKey, {
                            itemId: event.target.value,
                            quantity: item ? String(item.remainingQty) : "",
                          });
                        }}
                        value={row.itemId}
                      >
                        <option value="">Pilih item</option>
                        {itemOptions.map((item) => {
                          const isSelectedElsewhere =
                            selectedItemIds.has(item.itemId) && row.itemId !== item.itemId;

                          return (
                            <option
                              disabled={isSelectedElsewhere}
                              key={item.itemId}
                              value={item.itemId}
                            >
                              Line {item.lineNo} - {item.partName}
                            </option>
                          );
                        })}
                      </select>
                      {selectedItem ? (
                        <span className="shipment-row-meta">
                          {selectedItem.partNumber || "-"} / {selectedItem.customerName}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {row.itemId ? (
                        <select
                          name={`supply-${row.itemId}`}
                          onChange={(event) =>
                            updateRow(row.rowKey, { supply: event.target.value })
                          }
                          value={row.supply}
                        >
                          <option value="stock">Stok</option>
                          {suppliers.map((supplier) => (
                            <option key={supplier.id} value={`supplier:${supplier.id}`}>
                              {supplier.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select disabled>
                          <option>Stok</option>
                        </select>
                      )}
                    </td>
                    <td>
                      <span className="journey-progress">
                        {selectedItem?.remainingQty ?? "-"}
                      </span>
                    </td>
                    <td>
                      {row.itemId ? (
                        <>
                          <input name="selectedItemId" type="hidden" value={row.itemId} />
                          <input
                            min="1"
                            max={selectedItem?.remainingQty}
                            name={`quantity-${row.itemId}`}
                            onChange={(event) =>
                              updateRow(row.rowKey, { quantity: event.target.value })
                            }
                            placeholder="Qty"
                            type="number"
                            value={row.quantity}
                          />
                        </>
                      ) : (
                        <input disabled placeholder="Qty" type="number" />
                      )}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        disabled={rows.length <= 1}
                        onClick={() => removeRow(row.rowKey)}
                        type="button"
                      >
                        x
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7}>Tidak ada item tersisa untuk pengiriman.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
