"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "./model";
import { SupplierPicker } from "./SupplierPicker";

type Row = { key: number; description: string; quantity: string; unitPrice: string };
const emptyRow = (key: number): Row => ({ key, description: "", quantity: "1", unitPrice: "" });

export function ManualNoteForm({ suppliers, defaultDate }: { suppliers: { id: string; name: string }[]; defaultDate: string }) {
  const router = useRouter();
  const [noteDate, setNoteDate] = useState(defaultDate);
  const [supplierId, setSupplierId] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow(0)]);
  const nextRow = useRef(1);
  const requestKey = useRef("");
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ noteNo: string; previewUrl: string } | null>(null);
  const total = rows.reduce((sum, row) => sum + Math.round(Number(row.quantity) * Number(row.unitPrice)), 0);
  function update(key: number, field: keyof Omit<Row, "key">, value: string) {
    setRows(current => current.map(row => row.key === key ? { ...row, [field]: value } : row));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    if (!supplierId) {
      setError("Pilih supplier dari hasil pencarian.");
      event.currentTarget.querySelector<HTMLInputElement>("[data-supplier-input]")?.focus();
      return;
    }
    locked.current = true; setBusy(true); setUncertain(true); setError(""); setCreated(null);
    requestKey.current ||= crypto.randomUUID();
    try {
      const response = await fetch("/supplier/nota-manual/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteDate, supplierId, idempotencyKey: requestKey.current, items: rows.map(row => ({ description: row.description, quantity: Number(row.quantity), unitPrice: Number(row.unitPrice) })) }) });
      if (response.redirected) throw new Error("Sesi berakhir. Login kembali lalu coba request yang sama.");
      const body = await response.json();
      if (!response.ok) {
        if (response.status < 500) setUncertain(false);
        else setUncertain(true);
        throw new Error(body.error || "Gagal membuat nota.");
      }
      setCreated(body.data); setUncertain(false); requestKey.current = "";
      setRows([emptyRow(nextRow.current++)]);
      router.replace("/supplier/nota-manual", { scroll: false }); router.refresh();
    } catch (failure) {
      // Freeze input after an ambiguous network/server outcome so retry uses
      // exactly the same payload and idempotency key.
      if (!(failure instanceof Error)) setError("Gagal membuat nota.");
      else setError(failure.message);
    } finally { locked.current = false; setBusy(false); }
  }
  return (
    <form className="manual-note-form" onSubmit={submit} aria-busy={busy}>
      <div className="manual-form-heading">
        <div><h2>Buat Nota Manual</h2><p>Isi detail pembelian. Nomor nota dan PDF dibuat otomatis.</p></div>
        <span className="manual-auto-badge">PDF otomatis</span>
      </div>
      {error && <p className="manual-error" role="alert">{error}</p>}
      {created && <p className="manual-success" role="status">Nota {created.noteNo} berhasil dibuat. <a href={created.previewUrl} target="_blank" rel="noopener noreferrer">Preview PDF</a></p>}
      <fieldset disabled={busy || uncertain}>
        <legend className="manual-section-heading">Detail Nota</legend>
        <div className="manual-fields">
          <label>
            <span>Tanggal nota <span className="manual-required">*</span></span>
            <input type="date" min="1900-01-01" max="9999-12-31" required value={noteDate} onChange={event => setNoteDate(event.target.value)} />
          </label>
          <div>
            <SupplierPicker suppliers={suppliers} value={supplierId} onChange={setSupplierId} />
            <div className="manual-supplier-help"><span>Pilih dari master supplier.</span><Link href="/supplier/add-new-supplier">+ Tambah supplier</Link></div>
          </div>
        </div>
      </fieldset>
      <fieldset disabled={busy || uncertain} className="manual-item-section">
        <legend className="manual-section-heading">Daftar Item <span className="manual-item-count">{rows.length} item</span></legend>
        <p className="manual-section-description">Harga dalam rupiah. Total setiap item dihitung otomatis.</p>
        <div className="manual-item-list">
          {rows.map((row, i) => (
            <div className="manual-item-card" key={row.key}>
              <div className="manual-item-heading">
                <span>Item {String(i + 1).padStart(2, "0")}</span>
                <button className="manual-remove-button" type="button" aria-label={`Hapus item ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows(current => current.filter(item => item.key !== row.key))}>Hapus</button>
              </div>
              <div className="manual-item-fields">
                <label className="manual-description-field">
                  <span>Deskripsi <span className="manual-required">*</span></span>
                  <textarea aria-label={`Deskripsi item ${i + 1}`} required maxLength={600} rows={2} placeholder="Contoh: Pompa steering" value={row.description} onChange={event => update(row.key, "description", event.target.value)} />
                </label>
                <label>
                  <span>Qty (Pcs) <span className="manual-required">*</span></span>
                  <input aria-label={`Qty item ${i + 1}`} required type="number" min="0.000001" max="1000000" step="any" value={row.quantity} onChange={event => update(row.key, "quantity", event.target.value)} />
                </label>
                <label>
                  <span>Harga satuan (Rp) <span className="manual-required">*</span></span>
                  <input aria-label={`Harga item ${i + 1}`} required type="number" min="0" step="1" placeholder="0" value={row.unitPrice} onChange={event => update(row.key, "unitPrice", event.target.value)} />
                </label>
                <div className="manual-line-total"><span>Total item</span><output aria-label={`Total item ${i + 1}`}>{rupiah(Math.round(Number(row.quantity) * Number(row.unitPrice)))}</output></div>
              </div>
            </div>
          ))}
        </div>
        <button className="manual-add-button" type="button" disabled={rows.length >= 200} onClick={() => setRows(current => [...current, emptyRow(nextRow.current++)])}>+ Tambah Item</button>
      </fieldset>
      <div className="manual-actions">
        <div className="manual-grand-total"><span>Total nota <small>· {rows.length} item</small></span><output aria-live="polite">{rupiah(total)}</output><small>Status awal: Belum Bayar</small></div>
        <div className="manual-submit-area">
          <button className="manual-submit-button" type="submit" disabled={busy || !suppliers.length}>{busy ? "Membuat PDF..." : uncertain ? "Coba Simpan Kembali" : "Buat Nota & PDF"}</button>
          <span>Otomatis masuk ke List Nota Supplier</span>
        </div>
      </div>
      {uncertain && !busy && <p className="manual-retry-help">Hasil request belum dapat dipastikan. Input dikunci; coba simpan kembali untuk memeriksa hasil tanpa membuat duplikat.</p>}
    </form>
  );
}
