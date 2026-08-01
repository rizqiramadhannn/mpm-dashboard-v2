"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ConfirmForm } from "../../components/ConfirmForm";

type SupplierOption = {
  id: string;
  name: string;
};

type ShipmentItem = {
  id: string;
  lineNo: number;
  partNumber: string;
  partName: string;
  quantity: number;
};

type JourneySplit = {
  id: string;
  splitNo: number;
  batchNo: number;
  quantity: number;
  supplyType: "stock" | "supplier";
  supplierId: string | null;
  origin: string;
  destination: string;
  latestStatus: string;
  shippingVendor: string;
  shippingCost: number;
  isShippingPaid: boolean;
  customerReceived: boolean;
};

type JourneyByItem = Record<string, JourneySplit[]>;

type ShipmentJourneyFormProps = {
  action: (formData: FormData) => Promise<void>;
  customerCode: string;
  customerName: string;
  destinationFallback: string;
  items: ShipmentItem[];
  journeysByItem: JourneyByItem;
  sphId: string;
  sphNo: string;
  suppliers: SupplierOption[];
};

type SplitRow = JourneySplit & {
  rowKey: string;
};

type ShipmentBatch = {
  batchNo: number;
  shippingVendor: string;
  shippingCost: number;
  isShippingPaid: boolean;
};

function createSplit(itemId: string, splitNo: number, destinationFallback: string): SplitRow {
  return {
    destination: destinationFallback,
    id: "",
    latestStatus: "",
    batchNo: 1,
    origin: "",
    quantity: 0,
    rowKey: `new_${itemId}_${splitNo}`,
    shippingCost: 0,
    shippingVendor: "",
    isShippingPaid: false,
    customerReceived: false,
    splitNo,
    supplierId: null,
    supplyType: "stock",
  };
}

function supplyValue(split: SplitRow) {
  if (split.supplyType === "supplier" && split.supplierId) {
    return `supplier:${split.supplierId}`;
  }

  return "stock";
}

function deriveBatches(rowsByItem: Record<string, SplitRow[]>) {
  const batches = new Map<number, ShipmentBatch>();

  for (const split of Object.values(rowsByItem).flat()) {
    const batchNo = split.batchNo || 1;
    const current = batches.get(batchNo);

    batches.set(batchNo, {
      batchNo,
      isShippingPaid: current?.isShippingPaid || split.isShippingPaid,
      shippingCost: Math.max(current?.shippingCost ?? 0, split.shippingCost || 0),
      shippingVendor: current?.shippingVendor || split.shippingVendor || "",
    });
  }

  if (batches.size === 0) {
    batches.set(1, {
      batchNo: 1,
      isShippingPaid: false,
      shippingCost: 0,
      shippingVendor: "",
    });
  }

  return Array.from(batches.values()).sort((a, b) => a.batchNo - b.batchNo);
}

export function ShipmentJourneyForm({
  action,
  customerCode,
  customerName,
  destinationFallback,
  items,
  journeysByItem,
  sphId,
  sphNo,
  suppliers,
}: ShipmentJourneyFormProps) {
  const initialRows = useMemo(() => {
    const rowsByItem: Record<string, SplitRow[]> = {};

    for (const item of items) {
      const journeyRows = journeysByItem[item.id] ?? [];
      rowsByItem[item.id] =
        journeyRows.length > 0
          ? journeyRows
              .sort((a, b) => a.splitNo - b.splitNo)
              .map((split) => ({
                ...split,
                destination: split.destination || destinationFallback,
                rowKey: split.id,
              }))
          : [
              {
                ...createSplit(item.id, 1, destinationFallback),
                quantity: item.quantity,
              },
            ];
    }

    return rowsByItem;
  }, [destinationFallback, items, journeysByItem]);
  const [rowsByItem, setRowsByItem] = useState(initialRows);
  const [batches, setBatches] = useState(() => deriveBatches(initialRows));
  const sortedBatches = useMemo(
    () => [...batches].sort((a, b) => a.batchNo - b.batchNo),
    [batches]
  );

  function addSplit(item: ShipmentItem) {
    setRowsByItem((current) => {
      const currentRows = current[item.id] ?? [];
      const nextNo =
        currentRows.reduce((highest, split) => Math.max(highest, split.splitNo), 0) + 1;

      return {
        ...current,
        [item.id]: [...currentRows, createSplit(item.id, nextNo, destinationFallback)],
      };
    });
  }

  function removeSplit(itemId: string, rowKey: string) {
    setRowsByItem((current) => {
      const currentRows = current[itemId] ?? [];

      if (currentRows.length <= 1) {
        return current;
      }

      return {
        ...current,
        [itemId]: currentRows.filter((split) => split.rowKey !== rowKey),
      };
    });
  }

  function splitTotal(itemId: string) {
    return (rowsByItem[itemId] ?? []).reduce(
      (total, split) => total + (Number(split.quantity) || 0),
      0
    );
  }

  function updateSplitQuantity(itemId: string, rowKey: string, quantity: number) {
    updateSplit(itemId, rowKey, { quantity });
  }

  function updateSplit(itemId: string, rowKey: string, patch: Partial<SplitRow>) {
    setRowsByItem((current) => ({
      ...current,
      [itemId]: (current[itemId] ?? []).map((split) =>
        split.rowKey === rowKey ? { ...split, ...patch } : split
      ),
    }));
  }

  function addBatch() {
    setBatches((current) => {
      const nextBatchNo =
        current.reduce((highest, batch) => Math.max(highest, batch.batchNo), 0) + 1;

      return [
        ...current,
        {
          batchNo: nextBatchNo,
          isShippingPaid: false,
          shippingCost: 0,
          shippingVendor: "",
        },
      ];
    });
  }

  function updateBatch(batchNo: number, patch: Partial<Omit<ShipmentBatch, "batchNo">>) {
    setBatches((current) =>
      current.map((batch) => (batch.batchNo === batchNo ? { ...batch, ...patch } : batch))
    );
    setRowsByItem((current) => {
      const nextRows: Record<string, SplitRow[]> = {};

      for (const [itemId, rows] of Object.entries(current)) {
        nextRows[itemId] = rows.map((split) =>
          split.batchNo === batchNo && !split.customerReceived ? { ...split, ...patch } : split
        );
      }

      return nextRows;
    });
  }

  function assignBatch(itemId: string, rowKey: string, batchNo: number) {
    const batch = batches.find((candidate) => candidate.batchNo === batchNo);

    updateSplit(itemId, rowKey, {
      batchNo,
      isShippingPaid: batch?.isShippingPaid ?? false,
      shippingCost: batch?.shippingCost ?? 0,
      shippingVendor: batch?.shippingVendor ?? "",
    });
  }

  function updateSupply(itemId: string, rowKey: string, value: string) {
    if (value.startsWith("supplier:")) {
      updateSplit(itemId, rowKey, {
        supplierId: value.replace("supplier:", ""),
        supplyType: "supplier",
      });
      return;
    }

    updateSplit(itemId, rowKey, {
      supplierId: null,
      supplyType: "stock",
    });
  }

  function updateCustomerReceived(itemId: string, rowKey: string, checked: boolean) {
    updateSplit(itemId, rowKey, {
      customerReceived: checked,
      latestStatus: checked ? "TERKIRIM" : "",
    });
  }

  function hiddenReceivedFields(item: ShipmentItem, split: SplitRow) {
    if (!split.customerReceived) {
      return null;
    }

    return (
      <>
        <input name={`quantity-${item.id}-${split.rowKey}`} type="hidden" value={split.quantity} />
        <input name={`supply-${item.id}-${split.rowKey}`} type="hidden" value={supplyValue(split)} />
        <input name={`origin-${item.id}-${split.rowKey}`} type="hidden" value={split.origin} />
        <input
          name={`destination-${item.id}-${split.rowKey}`}
          type="hidden"
          value={split.destination || destinationFallback}
        />
        <input name={`latestStatus-${item.id}-${split.rowKey}`} type="hidden" value="TERKIRIM" />
        <input name={`batchNo-${item.id}-${split.rowKey}`} type="hidden" value={split.batchNo} />
        <input
          name={`shippingVendor-${item.id}-${split.rowKey}`}
          type="hidden"
          value={split.shippingVendor}
        />
        <input
          name={`shippingCost-${item.id}-${split.rowKey}`}
          type="hidden"
          value={split.shippingCost}
        />
        {split.isShippingPaid ? (
          <input name={`isShippingPaid-${item.id}-${split.rowKey}`} type="hidden" value="on" />
        ) : null}
        <input name={`customerReceived-${item.id}-${split.rowKey}`} type="hidden" value="on" />
      </>
    );
  }

  return (
    <ConfirmForm
      action={action}
      className="shipment-detail-page"
      confirmMessage={`Simpan journey pengiriman untuk ${sphNo}?`}
    >
      <input name="sphId" type="hidden" value={sphId} />
      <section className="form-section">
        <div className="section-heading">
          <div>
            <p className="page-kicker">Journey Pengiriman</p>
            <h1>{sphNo}</h1>
            <p>
              {customerName} ({customerCode}) - Tujuan SPH: {destinationFallback || "-"}
            </p>
          </div>
          <div className="shipment-heading-actions">
            <Link className="secondary-button" href="/pengiriman">
              Kembali
            </Link>
            <a className="secondary-button" href={`/pengiriman/${sphId}/download-ttb`}>
              Download TTB
            </a>
            <button className="primary-button" type="submit">
              Simpan Journey
            </button>
          </div>
        </div>
      </section>

      <section className="shipment-batch-section">
        <div className="shipment-batch-header">
          <div>
            <span>Batch Pengiriman</span>
            <strong>Ongkir diisi satu kali per batch</strong>
          </div>
          <button className="secondary-button" onClick={addBatch} type="button">
            Tambah Batch
          </button>
        </div>

        <div className="shipment-batch-list">
          {sortedBatches.map((batch) => (
            <div className="shipment-batch" key={batch.batchNo}>
              <div className="shipment-batch-title">
                <span>Batch</span>
                <strong>{batch.batchNo}</strong>
              </div>
              <div className="shipment-grid batch-grid">
                <label>
                  <span>Vendor Pengiriman</span>
                  <input
                    onChange={(event) =>
                      updateBatch(batch.batchNo, { shippingVendor: event.target.value })
                    }
                    placeholder="Nama vendor / ekspedisi"
                    value={batch.shippingVendor}
                  />
                </label>

                <label>
                  <span>Biaya Kirim</span>
                  <input
                    min="0"
                    onChange={(event) =>
                      updateBatch(batch.batchNo, {
                        shippingCost: Number(event.target.value) || 0,
                      })
                    }
                    placeholder="0"
                    type="number"
                    value={batch.shippingCost || ""}
                  />
                </label>

                <label className="checkbox-field">
                  <input
                    checked={batch.isShippingPaid}
                    onChange={(event) =>
                      updateBatch(batch.batchNo, { isShippingPaid: event.target.checked })
                    }
                    type="checkbox"
                  />
                  <span>Sudah dibayar</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="shipment-journey-list">
        {items.length > 0 ? (
          items.map((item) => {
            const rows = rowsByItem[item.id] ?? [];
            const total = splitTotal(item.id);

            return (
              <section className="shipment-item" key={item.id}>
                <input name="itemId" type="hidden" value={item.id} />
                <div className="shipment-item-summary">
                  <div>
                    <span>Item {item.lineNo}</span>
                    <strong>{item.partName}</strong>
                    <p>
                      {item.partNumber || "-"} - Qty SPH {item.quantity}
                    </p>
                  </div>
                  <div>
                    <span>Split Qty</span>
                    <strong className={total === item.quantity ? "" : "split-warning"}>
                      {total}/{item.quantity}
                    </strong>
                  </div>
                </div>

                <div className="shipment-split-list">
                  {rows.map((split, index) => (
                    <div className="shipment-split" key={split.rowKey}>
                      {hiddenReceivedFields(item, split)}
                      <input
                        name={`journeyId-${item.id}`}
                        type="hidden"
                        value={split.id}
                      />
                      <input
                        name={`splitKey-${item.id}`}
                        type="hidden"
                        value={split.rowKey}
                      />
                      {!split.customerReceived ? (
                        <>
                          <input
                            name={`shippingVendor-${item.id}-${split.rowKey}`}
                            type="hidden"
                            value={split.shippingVendor}
                          />
                          <input
                            name={`shippingCost-${item.id}-${split.rowKey}`}
                            type="hidden"
                            value={split.shippingCost}
                          />
                          {split.isShippingPaid ? (
                            <input
                              name={`isShippingPaid-${item.id}-${split.rowKey}`}
                              type="hidden"
                              value="on"
                            />
                          ) : null}
                        </>
                      ) : null}
                      <div className="split-heading">
                        <strong>Split {index + 1}</strong>
                        <button
                          className="icon-button"
                          disabled={rows.length <= 1 || split.customerReceived}
                          onClick={() => removeSplit(item.id, split.rowKey)}
                          type="button"
                          aria-label={`Hapus split ${index + 1}`}
                        >
                          x
                        </button>
                      </div>

                      <div className="shipment-grid split-grid">
                        <label>
                          <span>Qty</span>
                          <input
                            disabled={split.customerReceived}
                            min="0"
                            name={`quantity-${item.id}-${split.rowKey}`}
                            onChange={(event) =>
                              updateSplitQuantity(
                                item.id,
                                split.rowKey,
                                Number(event.target.value) || 0
                              )
                            }
                            type="number"
                            value={split.quantity || ""}
                          />
                        </label>

                        <label>
                          <span>Supply</span>
                          <select
                            disabled={split.customerReceived}
                            name={`supply-${item.id}-${split.rowKey}`}
                            onChange={(event) =>
                              updateSupply(item.id, split.rowKey, event.target.value)
                            }
                            value={supplyValue(split)}
                          >
                            <option value="stock">Stok</option>
                            {suppliers.map((supplier) => (
                              <option key={supplier.id} value={`supplier:${supplier.id}`}>
                                {supplier.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span>Batch Pengiriman</span>
                          <select
                            disabled={split.customerReceived}
                            name={`batchNo-${item.id}-${split.rowKey}`}
                            onChange={(event) =>
                              assignBatch(
                                item.id,
                                split.rowKey,
                                Number(event.target.value) || 1
                              )
                            }
                            value={split.batchNo || 1}
                          >
                            {sortedBatches.map((batch) => (
                              <option key={batch.batchNo} value={batch.batchNo}>
                                Batch {batch.batchNo}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span>Asal</span>
                          <input
                            disabled={split.customerReceived}
                            name={`origin-${item.id}-${split.rowKey}`}
                            onChange={(event) =>
                              updateSplit(item.id, split.rowKey, {
                                origin: event.target.value,
                              })
                            }
                            placeholder="Gudang / lokasi supplier"
                            value={split.origin}
                          />
                        </label>

                        <label>
                          <span>Tujuan</span>
                          <input
                            disabled={split.customerReceived}
                            name={`destination-${item.id}-${split.rowKey}`}
                            onChange={(event) =>
                              updateSplit(item.id, split.rowKey, {
                                destination: event.target.value,
                              })
                            }
                            placeholder={destinationFallback || "Lokasi tujuan"}
                            value={split.destination || destinationFallback}
                          />
                        </label>

                        <label>
                          <span>Status Terakhir</span>
                          <input
                            disabled={split.customerReceived}
                            name={`latestStatus-${item.id}-${split.rowKey}`}
                            onChange={(event) =>
                              updateSplit(item.id, split.rowKey, {
                                latestStatus: event.target.value,
                              })
                            }
                            placeholder="Transit, menunggu driver, sampai"
                            value={split.latestStatus}
                          />
                        </label>

                        <label className="checkbox-field">
                          <input
                            checked={split.customerReceived}
                            disabled={split.customerReceived}
                            name={`customerReceived-${item.id}-${split.rowKey}`}
                            onChange={(event) =>
                              updateCustomerReceived(
                                item.id,
                                split.rowKey,
                                event.target.checked
                              )
                            }
                            type="checkbox"
                          />
                          <span>Diterima customer</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  className="secondary-button split-add-button"
                  disabled={(rowsByItem[item.id] ?? []).every((split) => split.customerReceived)}
                  onClick={() => addSplit(item)}
                  type="button"
                >
                  Tambah Split
                </button>
              </section>
            );
          })
        ) : (
          <section className="empty-state">SPH ini belum memiliki item.</section>
        )}
      </div>
    </ConfirmForm>
  );
}
