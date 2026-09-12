import Link from "next/link";
import { getDb } from "../../../db";
import { requireUser } from "../../auth";
import { AppShell } from "../../components/AppShell";
import { getCurrentPage, paginateRows, Pagination } from "../../components/Pagination";
import { listSuppliers } from "../data";
import { ManualNoteForm } from "./ManualNoteForm";
import { jakartaToday, rupiah } from "./model";
import { listManualNotes } from "./storage";
import "./manual.css";

export const dynamic = "force-dynamic";

export default async function ManualNotesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser("/supplier/nota-manual");
  const params = (await searchParams) ?? {};
  const [suppliers, notes] = await Promise.all([listSuppliers(), getDb().then(listManualNotes)]);
  const { pageRows, safePage } = paginateRows(notes, getCurrentPage(params));
  return <AppShell><section className="sph-list-page">
    <div className="dashboard-header"><div><p className="page-kicker">Supplier</p><h1>Nota Manual</h1></div><Link href="/supplier/nota-supplier">List Nota Supplier</Link></div>
    <ManualNoteForm suppliers={suppliers.map(({ id, name }) => ({ id, name }))} defaultDate={jakartaToday()} />
    <section className="manual-history" aria-labelledby="manual-history-title">
      <h2 id="manual-history-title">History Nota Manual</h2>
      <div className="customer-table-wrap"><table className="customer-table"><thead><tr><th>Tanggal</th><th>Nomor Nota</th><th>Supplier</th><th>Jumlah Item</th><th>Total</th><th>File</th></tr></thead>
        <tbody>{pageRows.length ? pageRows.map(note => <tr key={note.id}><td>{new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${note.noteDate}T00:00:00Z`))}</td><td><strong>{note.noteNo}</strong></td><td>{note.supplierName}</td><td>{note.itemCount}</td><td>{rupiah(note.amount)}</td><td><a className="file-preview-link" href={`/supplier/nota-supplier/download/${note.id}?type=invoice&inline=1`} target="_blank" rel="noopener noreferrer">Preview PDF</a></td></tr>) : <tr><td colSpan={6}>Belum ada nota manual.</td></tr>}</tbody>
      </table></div>
      <Pagination currentPage={safePage} params={params} totalItems={notes.length} />
    </section>
  </section></AppShell>;
}
