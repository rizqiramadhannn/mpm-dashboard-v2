import { createHash } from "node:crypto";
import { and, asc, eq, lt } from "drizzle-orm";
import { getDb } from "../../db";
import { randomId } from "../../db/id";
import { whatsappConnection, whatsappDailySyncs, whatsappGroups, whatsappMessages } from "../../db/schema";
import { summarizeDailyMessages } from "./summary";

const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
const GROUP_ID = /@g\.us$/;
type JsonObject = Record<string, unknown>;

export class WhatsAppError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}
function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function nestedString(value: unknown): string {
  if (typeof value === "string") return value;
  const row = object(value);
  return string(row._serialized) || string(row.id) || string(row.user);
}
function array(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const row = object(value);
  for (const key of ["data", "items", "messages", "groups", "results"]) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
  }
  return [];
}
function settings() {
  const base = process.env.OPENWA_BASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.OPENWA_API_KEY?.trim();
  if (!base || !key) throw new WhatsAppError("OPENWA_BASE_URL dan OPENWA_API_KEY belum diatur di server.", 503);
  const url = new URL(base);
  if (!["http:", "https:"].includes(url.protocol)) throw new WhatsAppError("OPENWA_BASE_URL harus HTTP atau HTTPS.", 503);
  return { base: url.toString().replace(/\/$/, ""), key };
}
async function openwa(path: string, init: RequestInit = {}) {
  const { base, key } = settings();
  let response: Response;
  try { response = await fetch(base + "/api" + path, {
    ...init,
    headers: { "X-API-Key": key, ...(init.body ? { "Content-Type": "application/json" } : {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  }); } catch { throw new WhatsAppError("OpenWA tidak dapat dijangkau. Periksa OPENWA_BASE_URL dan proses OpenWA.", 503); }
  if (!response.ok) {
    let detail = "";
    try { detail = string(object(await response.json()).message); } catch { /* no JSON */ }
    throw new WhatsAppError("OpenWA: " + (detail || response.statusText || String(response.status)), response.status === 401 ? 503 : 502);
  }
  return response;
}
async function openwaJson(path: string, init: RequestInit = {}) {
  return openwa(path, init).then((response) => response.json() as Promise<unknown>);
}
export function todayWib(now = new Date()) {
  return new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
}
export function validWibDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const start = Date.parse(value + "T00:00:00+07:00");
  return Number.isFinite(start) && new Date(start + 7 * 3600000).toISOString().slice(0, 10) === value;
}
export function oldestKeptWibDate(now = new Date()) {
  const today = todayWib(now);
  return new Date(Date.parse(today + "T00:00:00+07:00") - 6 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
}
export function requireRetainedDate(value: string) {
  if (!validWibDate(value) || value < oldestKeptWibDate() || value > todayWib()) {
    throw new WhatsAppError("Pilih tanggal WIB dalam 7 hari terakhir.");
  }
}
export async function pruneWhatsAppCache() {
  const db = await getDb();
  const cutoff = oldestKeptWibDate();
  await db.delete(whatsappMessages).where(lt(whatsappMessages.wibDate, cutoff));
  await db.delete(whatsappDailySyncs).where(lt(whatsappDailySyncs.wibDate, cutoff));
  return cutoff;
}
async function connection() {
  const db = await getDb();
  return db.query.whatsappConnection.findFirst({ where: eq(whatsappConnection.id, 1) });
}
export async function sessionStatus() {
  settings();
  const saved = await connection();
  if (!saved) return { configured: true, session: null, qr: "" };
  const session = object(await openwaJson("/sessions/" + encodeURIComponent(saved.sessionId)));
  let qr = "";
  const state = string(session.status) || string(session.state);
  if (!["connected", "ready", "authenticated"].includes(state.toLowerCase())) {
    try {
      const payload = await openwaJson("/sessions/" + encodeURIComponent(saved.sessionId) + "/qr");
      const row = object(payload);
      qr = string(payload) || string(row.qr) || string(row.qrCode) || string(row.dataUrl) || string(row.data);
      if (qr && !qr.startsWith("data:image/png;base64,")) qr = "";
    } catch { /* QR may not be ready yet */ }
  }
  return { configured: true, session: { id: saved.sessionId, name: saved.sessionName, status: state || "unknown" }, qr };
}
export async function startSession() {
  const db = await getDb();
  let saved = await connection();
  if (!saved) {
    const name = "mpm-dashboard";
    const created = object(await openwaJson("/sessions", { method: "POST", body: JSON.stringify({ name }) }));
    const id = string(created.id) || string(created.sessionId);
    if (!id) throw new WhatsAppError("OpenWA tidak mengembalikan session ID.", 502);
    saved = { id: 1, sessionId: id, sessionName: name, createdAt: new Date().toISOString() };
    await db.insert(whatsappConnection).values(saved);
  }
  const current = object(await openwaJson("/sessions/" + encodeURIComponent(saved.sessionId)));
  if (current.engineLoaded !== true) {
    await openwa("/sessions/" + encodeURIComponent(saved.sessionId) + "/start", { method: "POST" });
  }
  return sessionStatus();
}
export async function listAvailableGroups() {
  const saved = await connection();
  if (!saved) return [];
  const db = await getDb();
  const monitored = new Map((await db.select().from(whatsappGroups)).map((group) => [group.id, group.monitored]));
  const groups: { id: string; name: string; monitored: boolean }[] = [];
  for (let offset = 0; offset <= 1000; offset += 100) {
    const batch = array(await openwaJson("/sessions/" + encodeURIComponent(saved.sessionId) + "/groups?limit=100&offset=" + offset));
    for (const item of batch) {
      const row = object(item);
      const id = nestedString(row.id) || string(row.groupId);
      if (GROUP_ID.test(id)) groups.push({ id, name: string(row.name) || string(row.subject) || id, monitored: monitored.get(id) || false });
    }
    if (batch.length < 100) break;
  }
  return groups;
}
export async function saveMonitoredGroups(ids: string[]) {
  if (ids.length > 50 || ids.some((id) => !GROUP_ID.test(id))) throw new WhatsAppError("ID grup tidak valid.");
  const available = await listAvailableGroups();
  const allowed = new Set(available.map((group) => group.id));
  if (ids.some((id) => !allowed.has(id))) throw new WhatsAppError("Grup harus berasal dari sesi WhatsApp aktif.");
  const db = await getDb();
  const selected = new Set(ids);
  const now = new Date().toISOString();
  for (const group of available) {
    await db.insert(whatsappGroups).values({ id: group.id, name: group.name, monitored: selected.has(group.id), updatedAt: now })
      .onConflictDoUpdate({ target: whatsappGroups.id, set: { name: group.name, monitored: selected.has(group.id), updatedAt: now } });
  }
  return available.map((group) => ({ ...group, monitored: selected.has(group.id) }));
}
function timestamp(value: unknown): string {
  if (typeof value === "number") return new Date(value < 100000000000 ? value * 1000 : value).toISOString();
  if (typeof value === "string") {
    if (/^\d+$/.test(value)) return timestamp(Number(value));
    const time = Date.parse(value);
    if (Number.isFinite(time)) return new Date(time).toISOString();
  }
  return "";
}
export function normalizeMessage(input: unknown, expectedGroup: string) {
  const row = object(input);
  const key = object(row.key);
  const chatId = nestedString(row.chatId) || nestedString(row.from) || nestedString(key.remoteJid);
  if (chatId !== expectedGroup) return null;
  const mediaId = string(row.waMessageId) || string(key.id);
  const sourceId = mediaId || nestedString(row.id) || string(row.messageId);
  const sentAt = timestamp(row.timestamp ?? row.messageTimestamp ?? row.sentAt);
  if (!sourceId || !sentAt) return null;
  const senderId = nestedString(row.author) || nestedString(row.participant) || nestedString(key.participant);
  const metadata = object(row.metadata);
  const mediaMetadata = object(metadata.media);
  const mime = string(row.mediaMimetype) || string(row.mimetype) || string(row.mimeType) || string(metadata.mimetype) || string(metadata.mimeType) || string(mediaMetadata.mimetype);
  const name = string(row.filename) || string(row.fileName) || string(row.mediaName) || string(metadata.filename) || string(metadata.fileName) || string(mediaMetadata.filename);
  const type = string(row.type) || string(row.messageType);
  const body = string(row.body) || string(row.text) || string(row.caption) || string(row.content);
  const inferredMime = mime || (/\.pdf$/i.test(name) ? "application/pdf" : /\.png$/i.test(name) ? "image/png" : type === "image" || /\.(jpe?g|webp)$/i.test(name) ? "image/jpeg" : "");
  const isTargetMedia = inferredMime.startsWith("image/") || inferredMime === "application/pdf";
  return {
    sourceId, sentAt, wibDate: todayWib(new Date(sentAt)), senderId,
    senderName: string(row.senderName) || string(row.notifyName) || string(row.pushName) || string(metadata.pushName) || senderId,
    body, messageType: type, mediaName: name, mediaMime: inferredMime,
    hasTargetMedia: isTargetMedia, mediaId,
  };
}
async function downloadMedia(sessionId: string, groupId: string, messageId: string) {
  try {
    const response = await openwa("/sessions/" + encodeURIComponent(sessionId) + "/messages/" + encodeURIComponent(groupId) + "/" + encodeURIComponent(messageId) + "/media");
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_MEDIA_BYTES) return { status: "too-large", base64: "", hash: "", mime: "" };
    const reader = response.body?.getReader();
    if (!reader) return { status: "unavailable", base64: "", hash: "", mime: "" };
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_MEDIA_BYTES) {
          await reader.cancel();
          return { status: "too-large", base64: "", hash: "", mime: "" };
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks);
    return { status: "saved", base64: Buffer.from(bytes).toString("base64"), hash: createHash("sha256").update(bytes).digest("hex"), mime: response.headers.get("content-type") || "" };
  } catch {
    return { status: "unavailable", base64: "", hash: "", mime: "" };
  }
}
export async function syncWibDate(date: string) {
  requireRetainedDate(date);
  const saved = await connection();
  if (!saved) throw new WhatsAppError("Hubungkan WhatsApp terlebih dahulu.");
  const db = await getDb();
  const groups = await db.select().from(whatsappGroups).where(eq(whatsappGroups.monitored, true));
  if (!groups.length) throw new WhatsAppError("Pilih minimal satu grup untuk dimonitor.");
  await pruneWhatsAppCache();
  const results = [];
  for (const group of groups) {
    let scanned = 0;
    let mediaSaved = 0;
    let skipped = 0;
    let mediaFailed = 0;
    let pageCap = true;
    let after = "";
    for (let page = 0; page < MAX_PAGES; page++) {
      const cursor = after ? "&after=" + encodeURIComponent(after) : "&offset=" + (page * PAGE_SIZE);
      const batch = array(await openwaJson("/sessions/" + encodeURIComponent(saved.sessionId) + "/messages?chatId=" + encodeURIComponent(group.id) + "&limit=" + PAGE_SIZE + "&inlineMedia=false" + cursor));
      for (const source of batch) {
        const message = normalizeMessage(source, group.id);
        if (!message) {
          if (string(object(source).chatId) === group.id) skipped++;
          continue;
        }
        if (message.wibDate !== date) continue;
        scanned++;
        const existing = await db.query.whatsappMessages.findFirst({ where: and(eq(whatsappMessages.groupId, group.id), eq(whatsappMessages.sourceId, message.sourceId)) });
        const media = message.hasTargetMedia
          ? existing?.mediaStatus === "saved" && existing.mediaBase64
            ? { status: "saved", base64: existing.mediaBase64, hash: existing.mediaSha256, mime: existing.mediaMime }
            : message.mediaId ? await downloadMedia(saved.sessionId, group.id, message.mediaId)
              : { status: "unavailable", base64: "", hash: "", mime: "" }
          : { status: "none", base64: "", hash: "", mime: "" };
        if (media.status === "saved") mediaSaved++;
        else if (message.hasTargetMedia) mediaFailed++;
        const values = {
          id: existing?.id || randomId(), groupId: group.id, sourceId: message.sourceId,
          sentAt: message.sentAt, wibDate: message.wibDate, senderId: message.senderId,
          senderName: message.senderName, body: message.body, messageType: message.messageType,
          mediaName: message.mediaName || (message.mediaMime === "application/pdf" ? "document.pdf" : "image"),
          mediaMime: message.mediaMime || media.mime, mediaStatus: media.status,
          mediaBase64: media.base64, mediaSha256: media.hash, syncedAt: new Date().toISOString(),
        };
        await db.insert(whatsappMessages).values(values).onConflictDoUpdate({
          target: [whatsappMessages.groupId, whatsappMessages.sourceId],
          set: { ...values, id: undefined },
        });
      }
      after = nestedString(object(batch.at(-1)).id);
      if (batch.length < PAGE_SIZE) { pageCap = false; break; }
    }
    const status = pageCap || mediaFailed || skipped ? "partial" : "scanned";
    const note = (pageCap ? "Batas 5000 pesan OpenWA tercapai; cakupan tanggal belum lengkap. " : "") +
      (skipped ? String(skipped) + " pesan tanpa waktu kirim atau ID dilewati. " : "") +
      "Cakupan mengikuti riwayat yang tersedia di OpenWA.";
    const existingSync = await db.query.whatsappDailySyncs.findFirst({ where: and(eq(whatsappDailySyncs.groupId, group.id), eq(whatsappDailySyncs.wibDate, date)) });
    const sync = { id: existingSync?.id || randomId(), groupId: group.id, wibDate: date, status, messageCount: scanned, mediaCount: mediaSaved, failedMediaCount: mediaFailed, checkedAt: new Date().toISOString(), note };
    await db.insert(whatsappDailySyncs).values(sync).onConflictDoUpdate({ target: [whatsappDailySyncs.groupId, whatsappDailySyncs.wibDate], set: { status, messageCount: scanned, mediaCount: mediaSaved, failedMediaCount: mediaFailed, checkedAt: sync.checkedAt, note } });
    results.push({ ...sync, name: group.name });
  }
  return results;
}
export async function dailyData(date: string) {
  requireRetainedDate(date);
  await pruneWhatsAppCache();
  const db = await getDb();
  const [groups, messages, syncs] = await Promise.all([
    db.select().from(whatsappGroups).where(eq(whatsappGroups.monitored, true)),
    db.select({
      id: whatsappMessages.id, groupId: whatsappMessages.groupId, sourceId: whatsappMessages.sourceId,
      sentAt: whatsappMessages.sentAt, senderName: whatsappMessages.senderName, senderId: whatsappMessages.senderId,
      body: whatsappMessages.body, messageType: whatsappMessages.messageType, mediaName: whatsappMessages.mediaName,
      mediaMime: whatsappMessages.mediaMime, mediaStatus: whatsappMessages.mediaStatus, mediaSha256: whatsappMessages.mediaSha256,
    }).from(whatsappMessages).where(eq(whatsappMessages.wibDate, date)).orderBy(asc(whatsappMessages.sentAt)),
    db.select().from(whatsappDailySyncs).where(eq(whatsappDailySyncs.wibDate, date)),
  ]);
  const monitored = new Set(groups.map((group) => group.id));
  const filtered = messages.filter((message) => monitored.has(message.groupId));
  const byGroup = groups.map((group) => {
    const items = filtered.filter((message) => message.groupId === group.id);
    return { id: group.id, name: group.name, sync: syncs.find((item) => item.groupId === group.id) || null,
      summary: summarizeDailyMessages(items), messages: items };
  });
  return { date, timezone: "Asia/Jakarta", groups: byGroup };
}
export async function mediaForExport(date: string) {
  requireRetainedDate(date);
  const db = await getDb();
  return db.select().from(whatsappMessages).where(and(eq(whatsappMessages.wibDate, date), eq(whatsappMessages.mediaStatus, "saved")));
}
