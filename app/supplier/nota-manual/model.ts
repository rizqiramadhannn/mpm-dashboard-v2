export type ManualItem = { description: string; quantity: number; unitPrice: number; totalPrice: number };
export type ManualNoteInput = { noteDate: string; supplierId: string; idempotencyKey: string; items: ManualItem[]; amount: number };

export class ManualNoteError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export function validateManualNote(value: unknown): ManualNoteInput {
  if (!value || typeof value !== "object") throw new ManualNoteError("Data nota tidak valid.");
  const payload = value as Record<string, unknown>;
  const noteDate = typeof payload.noteDate === "string" ? payload.noteDate : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate) || !Number.isFinite(Date.parse(`${noteDate}T00:00:00Z`)) || new Date(`${noteDate}T00:00:00Z`).toISOString().slice(0, 10) !== noteDate || noteDate < "1900-01-01") {
    throw new ManualNoteError("Tanggal nota tidak valid.");
  }
  const supplierId = typeof payload.supplierId === "string" ? payload.supplierId.trim() : "";
  if (!supplierId) throw new ManualNoteError("Supplier wajib dipilih.");
  const idempotencyKey = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : "";
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(idempotencyKey)) throw new ManualNoteError("Kunci request tidak valid.");
  if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 200) throw new ManualNoteError("Isi 1 sampai 200 item.");
  const items = payload.items.map((raw: unknown, index: number) => {
    if (!raw || typeof raw !== "object") throw new ManualNoteError(`Item ${index + 1} tidak valid.`);
    const item = raw as Record<string, unknown>;
    const description = typeof item.description === "string" ? item.description.trim() : "";
    if (!description || description.length > 600) throw new ManualNoteError(`Deskripsi item ${index + 1} wajib diisi, maksimal 600 karakter.`);
    const quantity = item.quantity;
    const unitPrice = item.unitPrice;
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) throw new ManualNoteError(`Qty item ${index + 1} harus positif, maksimal 1.000.000.`);
    if (typeof unitPrice !== "number" || !Number.isSafeInteger(unitPrice) || unitPrice < 0) throw new ManualNoteError(`Harga item ${index + 1} harus bilangan bulat rupiah nonnegatif.`);
    const totalPrice = Math.round(quantity * unitPrice);
    if (!Number.isSafeInteger(totalPrice)) throw new ManualNoteError(`Total item ${index + 1} terlalu besar.`);
    return { description, quantity, unitPrice, totalPrice };
  });
  const amount = items.reduce((sum, item) => sum + item.totalPrice, 0);
  if (!Number.isSafeInteger(amount)) throw new ManualNoteError("Total nota terlalu besar.");
  return { noteDate, supplierId, idempotencyKey, items, amount };
}

export function manualNoteNumber(noteDate: string, sequence: number) {
  return `NM${noteDate.replaceAll("-", "")}${String(sequence).padStart(3, "0")}`;
}

export function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function rupiah(value: number) {
  return `Rp. ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}`;
}
