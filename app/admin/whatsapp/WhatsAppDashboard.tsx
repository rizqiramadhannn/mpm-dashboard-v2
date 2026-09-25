"use client";
import { useCallback, useEffect, useState } from "react";

type Session = { configured: boolean; session: { id: string; status: string } | null; qr: string };
type Group = { id: string; name: string; monitored: boolean };
type Daily = { date: string; groups: { id: string; name: string; sync: { status: string; note: string } | null;
  summary: { messages: number; participants: number; images: number; pdfs: number; mediaFailures: number; overview: string;
    periods: { label: string; messages: number }[]; topSenders: { name: string; messages: number }[];
    excerpts: { time: string; sender: string; text: string }[] } }[] };
function wibDay(offset = 0) {
  return new Date(Date.now() + 7 * 3600000 + offset * 86400000).toISOString().slice(0, 10);
}
async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Permintaan gagal.");
  return body as T;
}
export default function WhatsAppDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [daily, setDaily] = useState<Daily | null>(null);
  const [date, setDate] = useState(wibDay());
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async (day: string) => {
    const current = await json<Session>("/api/whatsapp/session");
    setSession(current);
    if (current.session) {
      try { setGroups((await json<{ groups: Group[] }>("/api/whatsapp/groups")).groups); }
      catch { setGroups([]); }
    }
    setDaily(await json<Daily>("/api/whatsapp/daily?date=" + encodeURIComponent(day)));
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(date).catch((cause) => setError(cause instanceof Error ? cause.message : "Gagal memuat WhatsApp."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [date, load]);
  useEffect(() => {
    const status = session?.session?.status;
    if (!status || ["connected", "ready", "authenticated"].includes(status.toLowerCase())) return;
    const timer = window.setInterval(() => {
      void json<Session>("/api/whatsapp/session").then(setSession).catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [session?.session?.status]);
  useEffect(() => {
    if (session?.session?.status.toLowerCase() !== "ready") return;
    void json<{ groups: Group[] }>("/api/whatsapp/groups").then((result) => setGroups(result.groups)).catch(() => {});
  }, [session?.session?.status]);
  async function start() {
    setBusy("start"); setError(""); setNotice("");
    try { setSession(await json<Session>("/api/whatsapp/session", { method: "POST" })); setNotice("Scan QR dari WhatsApp > Perangkat tertaut."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal memulai sesi."); }
    finally { setBusy(""); }
  }
  async function saveGroups() {
    setBusy("groups"); setError(""); setNotice("");
    try {
      const ids = groups.filter((group) => group.monitored).map((group) => group.id);
      const result = await json<{ groups: Group[] }>("/api/whatsapp/groups", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
      });
      setGroups(result.groups); setNotice("Grup yang dimonitor disimpan.");
      setDaily(await json<Daily>("/api/whatsapp/daily?date=" + date));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal menyimpan grup."); }
    finally { setBusy(""); }
  }
  async function sync() {
    setBusy("sync"); setError(""); setNotice("");
    try {
      const result = await json<{ data: Daily }>("/api/whatsapp/daily", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date }),
      });
      setDaily(result.data); setNotice("Sinkronisasi selesai. Periksa status cakupan dan media tiap grup.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sinkronisasi gagal."); }
    finally { setBusy(""); }
  }
  return <section className="customer-page">
    <div className="section-heading compact"><div><p className="page-kicker">Admin</p><h1>Sync WhatsApp</h1>
      <p>Hanya grup yang dipilih yang disimpan. Pesan dan media dashboard disimpan untuk 7 tanggal WIB terakhir.</p></div></div>
    {error ? <p className="auth-error inline" role="alert">{error}</p> : null}
    {notice ? <p className="auth-success" role="status">{notice}</p> : null}
    <div className="whatsapp-grid">
      <section className="whatsapp-card"><h2>Koneksi WhatsApp</h2>
        <p>Status: <strong>{session?.session?.status || (session?.configured ? "Belum dibuat" : "Memuat...")}</strong></p>
        <button className="primary-button" disabled={!!busy} onClick={() => void start()} type="button">
          {busy === "start" ? "Memulai..." : session?.session ? "Mulai / Sambungkan Ulang" : "Buat Sesi dan Tampilkan QR"}</button>
        {session?.qr ? <div><p>Scan lewat WhatsApp di ponsel: Perangkat tertaut → Tautkan perangkat.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Kode QR login WhatsApp" className="whatsapp-qr" src={session.qr} /></div> : null}
        <p className="whatsapp-muted">OpenWA harus berjalan dan dapat dijangkau oleh server dashboard. QR diperbarui otomatis.</p>
      </section>
      <section className="whatsapp-card"><h2>Grup yang dimonitor</h2>
        {groups.length ? <div className="whatsapp-groups">{groups.map((group) =>
          <label key={group.id}><input checked={group.monitored} onChange={() => setGroups((current) => current.map((item) =>
            item.id === group.id ? { ...item, monitored: !item.monitored } : item))} type="checkbox" /><span>{group.name}</span></label>)}</div>
          : <p>Hubungkan WhatsApp untuk memuat grup.</p>}
        <button className="primary-button" disabled={!!busy || !groups.length} onClick={() => void saveGroups()} type="button">
          {busy === "groups" ? "Menyimpan..." : "Simpan pilihan grup"}</button>
      </section>
    </div>
    <section className="whatsapp-card"><h2>Ringkasan harian</h2>
      <div className="whatsapp-toolbar"><label>Tanggal WIB <input type="date" min={wibDay(-6)} max={wibDay()} value={date}
        onChange={(event) => setDate(event.target.value)} /></label>
        <button className="primary-button" disabled={!!busy || !groups.some((group) => group.monitored)}
          onClick={() => void sync()} type="button">{busy === "sync" ? "Menyinkronkan..." : "Sync tanggal ini"}</button>
        <a className="file-upload-button" href={"/api/whatsapp/export?date=" + encodeURIComponent(date)}>Download ZIP tanggal ini</a>
      </div>
      <p className="whatsapp-muted">Ringkasan mencatat pesan yang tersedia di riwayat OpenWA. “partial” berarti ada media gagal atau batas halaman tercapai.</p>
      {daily?.groups.length ? daily.groups.map((group) => <div className="whatsapp-digest" key={group.id}>
        <h3>{group.name}</h3><p><strong>{group.summary.messages}</strong> pesan · {group.summary.participants} pengirim · {group.summary.images} gambar · {group.summary.pdfs} PDF · {group.summary.mediaFailures} media gagal</p>
        <p>{group.summary.overview}</p>
        <p>Status: {group.sync?.status || "Belum disinkronkan"}{group.sync ? " · " + group.sync.note : ""}</p>
        <p>Periode: {group.summary.periods.map((period) => period.label + " WIB: " + period.messages).join(" · ")}</p>
        {group.summary.topSenders.length ? <p>Pengirim teraktif: {group.summary.topSenders.map((sender) => sender.name + " (" + sender.messages + ")").join(", ")}</p> : null}
        {group.summary.excerpts.length ? <h4>Cuplikan sepanjang hari</h4> : null}
        {group.summary.excerpts.length ? <ul>{group.summary.excerpts.map((entry, index) =>
          <li key={index}><strong>{new Date(entry.time).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })} {entry.sender}:</strong> {entry.text}</li>)}</ul>
          : <p>Belum ada teks tersimpan untuk tanggal ini.</p>}
      </div>) : <p>Pilih dan simpan grup untuk melihat ringkasan.</p>}
    </section>
  </section>;
}
