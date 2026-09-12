"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "./model";

type Row = { key: number; description: string; quantity: string; unitPrice: string };
const emptyRow = (key: number): Row => ({ key, description: "", quantity: "1", unitPrice: "" });

export function ManualNoteForm({ suppliers, defaultDate }: { suppliers: { id: string; name: string }[]; defaultDate: string }) {
  const router = useRouter();
  const [noteDate, setNoteDate] = useState(defaultDate);
  const [supplierId, setSupplierId] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow(0)]);
  const nextRow = useRef(1);
  const requestKey = useRef("");
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ noteNo: string; previewUrl: string } | null>(null);
  const selected = suppliers.find(supplier => supplier.id === supplierId);
  const options = suppliers.filter(supplier => supplier.id === supplierId || supplier.name.toLowerCase().includes(search.toLowerCase()));
  const total = rows.reduce((sum, row) => sum + Math.round(Number(row.quantity) * Number(row.unitPrice)), 0);
  function update(key: number, field: keyof Omit<Row, "key">, value: string) {
    setRows(current => current.map(row => row.key === key ? { ...row, [field]: value } : row));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
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
  return <form className="manual-note-form" onSubmit={submit}>
    <h2>Buat Nota Manual</h2><p>Nomor nota, total, dan file PDF dibuat otomatis saat disimpan.</p>
    {error && <p className="manual-error" role="alert">{error}</p>}
    {created && <p className="manual-success" role="status">Nota {created.noteNo} berhasil dibuat. <a href={created.previewUrl} target="_blank" rel="noopener noreferrer">Preview PDF</a></p>}
    <fieldset disabled={busy || uncertain}>
      <div className="manual-fields">
        <label>Tanggal<input type="date" min="1900-01-01" max="9999-12-31" required value={noteDate} onChange={event => setNoteDate(event.target.value)} /></label>
        <div><label>Cari supplier<input type="search" placeholder="Ketik nama supplier" value={search} onChange={event => setSearch(event.target.value)} /></label>
          <label>Supplier<select required value={supplierId} onChange={event => setSupplierId(event.target.value)}><option value="">Pilih supplier</option>{options.map(supplier => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></label>
          <small>{selected ? `Terpilih: ${selected.name}. ` : ""}<Link href="/supplier/add-new-supplier">Tambah supplier baru</Link></small>
        </div>
      </div>
      <div className="customer-table-wrap"><table className="customer-table manual-items"><thead><tr><th>No.</th><th>Deskripsi</th><th>Qty (Pcs)</th><th>Harga Satuan (Rp)</th><th>Total</th><th>Aksi</th></tr></thead>
        <tbody>{rows.map((row, i) => <tr key={row.key}><td>{i + 1}</td><td><textarea aria-label={`Deskripsi item ${i + 1}`} required maxLength={600} value={row.description} onChange={event => update(row.key, "description", event.target.value)} /></td><td><input aria-label={`Qty item ${i + 1}`} required type="number" min="0.000001" max="1000000" step="any" value={row.quantity} onChange={event => update(row.key, "quantity", event.target.value)} /></td><td><input aria-label={`Harga item ${i + 1}`} required type="number" min="0" step="1" value={row.unitPrice} onChange={event => update(row.key, "unitPrice", event.target.value)} /></td><td>{rupiah(Math.round(Number(row.quantity) * Number(row.unitPrice)))}</td><td><button type="button" disabled={rows.length === 1} onClick={() => setRows(current => current.filter(item => item.key !== row.key))}>Hapus</button></td></tr>)}</tbody>
      </table></div>
      <button type="button" disabled={rows.length >= 200} onClick={() => setRows(current => [...current, emptyRow(nextRow.current++)])}>+ Tambah Item</button>
    </fieldset>
    <div className="manual-actions"><strong>Total Nota: {rupiah(total)}</strong><button className="primary-button" type="submit" disabled={busy || !suppliers.length}>{busy ? "Membuat PDF..." : uncertain ? "Coba Simpan Kembali" : "Buat Nota & PDF"}</button></div>
    {uncertain && <p>Hasil request belum dapat dipastikan. Input dikunci; coba simpan kembali untuk memeriksa hasil tanpa membuat duplikat.</p>}
  </form>;
}
