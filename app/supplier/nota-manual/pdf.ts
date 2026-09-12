import type { ManualItem } from "./model";
import { rupiah } from "./model";

// Native PDF drawing, matching the existing invoice/SPH generators. No browser
// or filesystem dependency, so generation also works in the worker runtime.
function clean(value: string) {
  return value.replace(/[\r\n\t]/g, " ").replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}
function literal(value: string) { return clean(value).replace(/[\\()]/g, "\\$&"); }
function text(x: number, y: number, value: string, size = 10, bold = false) {
  return `0 g BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${literal(value)}) Tj ET\n`;
}
function line(x: number, y: number, x2: number, y2: number) { return `0 G 0.6 w ${x} ${y} m ${x2} ${y2} l S\n`; }
function wrap(value: string, width: number, size = 10) {
  // Conservative maximum Helvetica glyph width: even all-uppercase and long
  // unbroken part numbers fit their cell without clipping.
  const max = Math.max(1, Math.floor(width / (size * 0.95)));
  const words = clean(value).split(/\s+/).flatMap(word => word.match(new RegExp(`.{1,${max}}`, "g")) ?? []);
  const rows: string[] = [];
  let row = "";
  for (const word of words) {
    if (row && row.length + word.length + 1 > max) { rows.push(row); row = ""; }
    row += `${row ? " " : ""}${word}`;
  }
  if (row) rows.push(row);
  return rows.length ? rows : [""];
}
function background() {
  // Smooth mint/blue gradient clipped to diagonal header and footer polygons.
  let result = "q 0 535 m 595 650 l 595 842 l 0 842 l h W n\n";
  for (let i = 0; i < 120; i++) {
    const t = i / 119;
    result += `${(0.80 - 0.15 * t).toFixed(3)} ${(0.93 - 0.06 * t).toFixed(3)} ${(0.87 + 0.04 * t).toFixed(3)} rg ${i * 5} 530 5.1 312 re f\n`;
  }
  result += "Q q 0 0 m 595 0 l 595 155 l 0 85 l h W n\n";
  for (let i = 0; i < 120; i++) {
    const t = i / 119;
    result += `${(0.65 + 0.15 * t).toFixed(3)} ${(0.87 + 0.06 * t).toFixed(3)} ${(0.91 - 0.04 * t).toFixed(3)} rg ${i * 5} 0 5.1 160 re f\n`;
  }
  return result + "Q\n";
}

export function generateManualNotePdf(note: { noteNo: string; noteDate: string; supplierName: string; items: ManualItem[]; amount: number }) {
  const pages: string[] = [];
  let content = "";
  let y = 420;
  const newPage = () => {
    content = background();
    content += text(42, 799, "FAKTUR", 16, true) + text(42, 775, "PENJUALAN", 16, true);
    content += text(42, 744, `Nomor Nota: ${note.noteNo}`, 10, true);
    wrap(`Supplier: ${note.supplierName}`, 500).forEach((row, i) => { content += text(42, 726 - i * 13, row); });
    content += text(22, 642, "TANGGAL", 10, true);
    const date = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${note.noteDate}T00:00:00Z`)).toUpperCase();
    content += text(22, 623, date);
    content += text(22, 583, "KEPADA,", 11, true) + text(22, 564, "MOROWALI PUTRA MANDIRI", 11, true);
    ["Jl. Trans Sulawesi", "Kavling Bintang Putri Blok D No. 4", "Bahodopi - Morowali", "Sulawesi Tengah"].forEach((row, i) => { content += text(22, 544 - i * 18, row, 12); });
    if (pages.length) {
      content = background() + text(42, 799, "FAKTUR PENJUALAN - LANJUTAN", 16, true);
      content += text(42, 770, `Nomor Nota: ${note.noteNo}`, 10, true);
      wrap(`Supplier: ${note.supplierName}`, 500).forEach((row, i) => { content += text(42, 750 - i * 13, row); });
      content += text(42, 675, date);
    }
    y = pages.length ? 650 : 420;
    content += `0.88 0.87 0.80 rg 64 ${y - 32} 467 32 re f\n`;
    content += text(72, y - 20, "No.", 9, true) + text(236, y - 20, "DESKRIPSI", 9, true) + text(462, y - 20, "TOTAL", 9, true);
    content += line(64, y, 531, y) + line(64, y - 32, 531, y - 32);
    for (const x of [64, 96, 426, 531]) content += line(x, y, x, y - 32);
    y -= 32;
  };
  const finish = (last: boolean) => {
    if (last) {
      content += text(310, y - 25, "TOTAL", 10, true);
      const total = rupiah(note.amount);
      content += text(433, y - 25, total, Math.min(9, 90 / (total.length * 0.6)), true);
      content += text(22, 221, "NB:", 8, true);
      ["Pembayaran kami", "anggap lunas apabila", "nota faktur telah di TTD oleh", "kami."].forEach((row, i) => { content += text(60, 221 - i * 11, row, 8, true); });
      content += text(455, 166, "Hormat Kami,", 11);
      content += text(441, 111, "(", 10) + text(544, 111, ")", 10) + line(446, 110, 543, 110);
    }
    content += text(265, 35, `Halaman ${pages.length + 1}`, 8);
    pages.push(content);
  };
  newPage();
  for (let index = 0; index < note.items.length; index++) {
    const item = note.items[index];
    const rows = wrap(`${item.description} ${new Intl.NumberFormat("id-ID").format(item.quantity)} PCS`, 314);
    // Split exceptionally long descriptions over pages instead of shrinking text.
    let offset = 0;
    while (offset < rows.length) {
      if (y < 280) { finish(false); newPage(); }
      const capacity = Math.max(1, Math.floor((y - 270 - 16) / 13));
      const count = Math.min(capacity, rows.length - offset);
      const height = Math.max(38, count * 13 + 16);
      content += `0.88 0.87 0.80 rg 64 ${y - height} 467 ${height} re f\n`;
      content += text(72, y - 16, offset ? "" : String(index + 1), 9);
      rows.slice(offset, offset + count).forEach((row, i) => { content += text(102, y - 16 - i * 13, row, 10); });
      if (offset + count === rows.length) {
        // Money can reach 16 digits. Use conservative width-aware sizing.
        const amount = rupiah(item.totalPrice);
        content += text(433, y - 16, amount, Math.min(9, 90 / (amount.length * 0.6)), true);
      }
      for (const x of [64, 96, 426, 531]) content += line(x, y, x, y - height);
      content += line(64, y - height, 531, y - height);
      y -= height;
      offset += count;
      if (offset < rows.length) { finish(false); newPage(); }
    }
  }
  finish(true);
  const objects: string[] = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"];
  const pageIds: number[] = [];
  for (const page of pages) {
    const id = objects.length + 1;
    pageIds.push(id);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${id + 1} 0 R >>`);
    objects.push(`<< /Length ${page.length} >>\nstream\n${page}endstream`);
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(pdf, char => char.charCodeAt(0));
}
