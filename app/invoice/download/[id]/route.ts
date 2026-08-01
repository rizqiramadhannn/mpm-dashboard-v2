import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { invoiceDocuments, invoiceItems, sphDocuments } from "../../../../db/schema";
import { LOGO_JPEG_BASE64 } from "../../../sph/download/[id]/assets";

type InvoiceDocument = {
  amountInWords: string;
  customerDetailLine1: string;
  customerDetailLine2: string;
  customerDetailLine3: string;
  customerName: string;
  franco: string;
  invoiceDate: string;
  invoiceNo: string;
  paymentDueDate: string | null;
  paymentTerm: string;
  poNo: string;
  sphNo: string;
  totalAmount: number;
};

type InvoiceItem = {
  lineNo: number;
  partNumber: string;
  partName: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  totalPrice: number;
};

type PdfObject =
  | string
  | {
      header: string;
      stream: Uint8Array;
    };

const pageWidth = 595;
const pageHeight = 842;
const left = 45;
const right = 550;
const colA = left;
const colB = 75;
const colC = 160;
const colD = 320;
const colE = 370;
const colF = 460;
const colG = right;

function pdfString(value: unknown) {
  return String(value ?? "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\s+/g, " ")
    .trim();
}

function text(x: number, y: number, value: unknown, size = 9, font = "F1") {
  return `BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${pdfString(
    value
  )}) Tj ET\n`;
}

function line(x1: number, y1: number, x2: number, y2: number) {
  return `${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(
    2
  )} l S\n`;
}

function rect(x: number, y: number, width: number, height: number) {
  return `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(
    2
  )} re S\n`;
}

function fillRect(x: number, y: number, width: number, height: number) {
  return `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(
    2
  )} re f\n`;
}

function image(name: string, x: number, y: number, width: number, height: number) {
  return `q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(
    2
  )} ${y.toFixed(2)} cm /${name} Do Q\n`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatSheetRupiah(value: number) {
  return `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function splitText(value: string, maxChars: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

function rightText(x: number, y: number, value: unknown, size = 9) {
  const display = pdfString(value);
  const estimatedWidth = display.length * size * 0.5;
  return text(x - estimatedWidth, y, display, size);
}

function centerText(x1: number, x2: number, y: number, value: unknown, size = 9, font = "F1") {
  const display = pdfString(value);
  const estimatedWidth = display.length * size * 0.5;
  return text((x1 + x2 - estimatedWidth) / 2, y, display, size, font);
}

function buildContent(document: InvoiceDocument, items: InvoiceItem[]) {
  const companyName = "PT Morowali Putra Mandiri";
  const addressLines = [
    "Jl. Trans Sulawesi",
    "Kavling Bintang Putri Blok D No 4",
    "Bahodopi - Morowali",
    "Sulawesi Tengah",
  ];

  let content = "1 w\n";
  content += image("ImLogo", left, 772, 52, 52);
  content += centerText(0, pageWidth, 798, "INVOICE", 16, "F2");
  content += text(left, 732, companyName, 10, "F2");
  content += text(365, 732, "Quo. No", 10, "F2");
  content += text(438, 732, document.sphNo, 9);
  content += text(365, 714, "Tanggal.", 10, "F2");
  content += text(438, 714, formatDate(document.invoiceDate), 9);
  content += text(365, 696, "Inv. No", 10, "F2");
  content += text(438, 696, document.invoiceNo, 9);
  content += text(365, 678, "PO No.", 10, "F2");
  content += text(438, 678, document.poNo || "-", 9);

  addressLines.forEach((addressLine, index) => {
    content += text(left, 716 - index * 16, addressLine, 9);
  });

  content += text(left, 620, "Kepada Yth : ", 10, "F2");
  content += text(365, 620, "Pembayaran", 9, "F2");
  content += text(438, 620, document.paymentTerm, 9);
  content += text(left, 598, document.customerName, 10);
  content += text(365, 598, "Franco ", 9, "F2");
  content += text(438, 598, document.franco || "-", 9);
  content += text(left, 582, document.customerDetailLine1, 9);
  content += text(365, 582, "Tgl Pembayaran", 9, "F2");
  content += text(438, 582, formatDate(document.paymentDueDate), 9);
  content += text(left, 566, document.customerDetailLine2, 9);
  content += text(left, 550, document.customerDetailLine3, 9);

  const tableTop = 494;
  const headerHeight = 22;
  const rowHeight = 19;
  const cols = [colA, colB, colC, colD, colE, colF, colG];

  content += "0 0 0 rg\n";
  content += fillRect(left, tableTop - headerHeight, right - left, headerHeight);
  content += "0 0 0 RG\n";
  content += rect(left, tableTop - headerHeight, right - left, headerHeight);
  for (const col of cols.slice(1, -1)) {
    content += line(col, tableTop, col, tableTop - headerHeight);
  }
  content += "1 1 1 rg\n";
  content += centerText(colA, colB, tableTop - 14, "No.", 10, "F2");
  content += centerText(colB, colC, tableTop - 14, "Part Number", 10, "F2");
  content += centerText(colC, colD, tableTop - 14, "Part Name", 10, "F2");
  content += centerText(colD, colE, tableTop - 14, "Jumlah", 10, "F2");
  content += centerText(colE, colF, tableTop - 14, "Harga Satuan", 10, "F2");
  content += centerText(colF, colG, tableTop - 14, "Total", 10, "F2");
  content += "0 0 0 rg\n";

  let y = tableTop - headerHeight;
  const visibleRows = Math.max(items.length + 4, 4);
  for (let index = 0; index < visibleRows; index += 1) {
    const item = items[index];

    if (item) {
      content += centerText(colA, colB, y - 13, item.lineNo, 10);
      content += text(colB + 6, y - 13, item.partNumber, 10);
      content += text(colC + 6, y - 13, splitText(item.partName, 30)[0], 10);
      content += centerText(colD, colE, y - 13, item.quantity, 10);
      content += rightText(colF - 8, y - 13, formatSheetRupiah(item.unitPrice), 10);
      content += rightText(colG - 8, y - 13, formatSheetRupiah(item.totalPrice), 10);
    }

    y -= rowHeight;
  }

  content += line(left, y, right, y);
  content += rightText(colG - 8, y - 18, formatSheetRupiah(document.totalAmount), 10);
  y -= 43;

  for (const lineValue of splitText(document.amountInWords, 76).slice(0, 3)) {
    content += text(left, y, lineValue, 10, "F3");
    y -= 16;
  }

  y -= 20;
  content += text(left, y, "Rekening Pembayaran :", 10, "F2");
  y -= 18;
  content += text(left, y, "Bank", 10, "F2");
  content += text(left + 72, y, "   : Bank BCA", 10);
  y -= 18;
  content += text(left, y, "Nama Rek", 10, "F2");
  content += text(left + 72, y, "   : Morowali Putra Mandiri", 10);
  y -= 18;
  content += text(left, y, "No Rek", 10, "F2");
  content += text(left + 72, y, "   : 7245751010", 10);

  content += centerText(390, 520, y + 54, "Hormat Kami,", 10);
  content += centerText(360, 545, y - 64, "PT Morowali Putra Mandiri", 10);

  return content;
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function loadJpegAsset(base64: string, width: number, height: number) {
  return {
    data: base64ToBytes(base64),
    width,
    height,
  };
}

function imageObject(asset: ReturnType<typeof loadJpegAsset>) {
  return {
    header:
      `<< /Type /XObject /Subtype /Image /Width ${asset.width} /Height ${asset.height} ` +
      "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode",
    stream: asset.data,
  };
}

function createPdf(document: InvoiceDocument, items: InvoiceItem[]) {
  const content = buildContent(document, items);
  const logo = loadJpegAsset(LOGO_JPEG_BASE64, 1080, 1080);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> /XObject << /ImLogo 7 0 R >> >> /Contents 8 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>",
    imageObject(logo),
    `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}endstream`,
  ] satisfies PdfObject[];

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets = [0];
  let length = 0;

  function appendText(value: string) {
    const bytes = encoder.encode(value);
    chunks.push(bytes);
    length += bytes.length;
  }

  function appendBytes(value: Uint8Array) {
    chunks.push(value);
    length += value.length;
  }

  appendText("%PDF-1.4\n");

  objects.forEach((object, index) => {
    offsets.push(length);
    appendText(`${index + 1} 0 obj\n`);
    if (typeof object === "string") {
      appendText(`${object}\n`);
    } else {
      appendText(`${object.header} /Length ${object.stream.length} >>\nstream\n`);
      appendBytes(object.stream);
      appendText("\nendstream\n");
    }
    appendText("endobj\n");
  });

  const xrefOffset = length;
  appendText(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets.slice(1)) {
    appendText(`${offset.toString().padStart(10, "0")} 00000 n \n`);
  }
  appendText(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  const pdf = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    pdf.set(chunk, offset);
    offset += chunk.length;
  }

  return pdf;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return new Response("Invoice tidak valid.", { status: 400 });
  }

  const db = await getDb();
  const [document] = await db
    .select({
      amountInWords: invoiceDocuments.amountInWords,
      customerDetailLine1: invoiceDocuments.customerDetailLine1,
      customerDetailLine2: invoiceDocuments.customerDetailLine2,
      customerDetailLine3: invoiceDocuments.customerDetailLine3,
      customerName: invoiceDocuments.customerName,
      franco: invoiceDocuments.franco,
      invoiceDate: invoiceDocuments.invoiceDate,
      invoiceNo: invoiceDocuments.invoiceNo,
      paymentDueDate: invoiceDocuments.paymentDueDate,
      paymentTerm: invoiceDocuments.paymentTerm,
      poNo: invoiceDocuments.poNo,
      sphNo: sphDocuments.sphNo,
      totalAmount: invoiceDocuments.totalAmount,
    })
    .from(invoiceDocuments)
    .leftJoin(sphDocuments, eq(invoiceDocuments.sphId, sphDocuments.id))
    .where(eq(invoiceDocuments.id, id))
    .limit(1);

  if (!document) {
    return new Response("Invoice tidak ditemukan.", { status: 404 });
  }

  const items = await db
    .select({
      lineNo: invoiceItems.lineNo,
      partNumber: invoiceItems.partNumber,
      partName: invoiceItems.partName,
      quantity: invoiceItems.quantity,
      uom: invoiceItems.uom,
      unitPrice: invoiceItems.unitPrice,
      totalPrice: invoiceItems.totalPrice,
    })
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id));
  items.sort((a, b) => a.lineNo - b.lineNo);

  return new Response(createPdf(document, items), {
    headers: {
      "Content-Disposition": `attachment; filename="${document.invoiceNo}.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
}
