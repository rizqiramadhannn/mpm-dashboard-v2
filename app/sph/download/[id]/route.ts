import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { sphDocuments, sphItems } from "../../../../db/schema";
import { LOGO_JPEG_BASE64, SIGNATURE_JPEG_BASE64 } from "./assets";

type StaticSphSnapshot = {
  company?: {
    name?: string;
    addressLines?: string[];
  };
  paymentAccount?: {
    bank?: string;
    accountName?: string;
    accountNumber?: string;
  };
  signature?: {
    label?: string;
    companyName?: string;
  };
};

type SphDocument = {
  sphNo: string;
  sphDate: string;
  customerName: string;
  customerDetailLine1: string;
  customerDetailLine2: string;
  customerDetailLine3: string;
  paymentTerm: string;
  franco: string;
  deliveryDate: string | null;
  etaDate: string | null;
  additionalInfo: string;
  totalAmount: number;
  amountInWords: string;
  staticSnapshotJson: Record<string, unknown> | null;
};

type SphItem = {
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

  const date = new Date(`${value}T00:00:00`);

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

function buildContent(document: SphDocument, items: SphItem[]) {
  const snapshot = (document.staticSnapshotJson ?? {}) as StaticSphSnapshot;
  const company = snapshot.company ?? {};
  const paymentAccount = snapshot.paymentAccount ?? {};
  const signature = snapshot.signature ?? {};
  const companyName = company.name ?? "PT Morowali Putra Mandiri";
  const addressLines = company.addressLines ?? [
    "Jl. Trans Sulawesi",
    "Kavling Bintang Putri Blok D No 4",
    "Bahodopi - Morowali",
    "Sulawesi Tengah",
  ];
  const signatureCompany = signature.companyName ?? companyName;

  let content = "1 w\n";
  content += image("ImLogo", left, 772, 52, 52);
  content += centerText(0, pageWidth, 798, "SURAT PENAWARAN HARGA", 14, "F2");
  content += text(left, 732, companyName, 10, "F2");
  content += text(365, 732, "Quo. No", 10, "F2");
  content += text(438, 732, document.sphNo, 9);
  content += text(365, 714, "Tanggal.", 10, "F2");
  content += text(438, 714, formatDate(document.sphDate), 9);

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
  content += text(365, 582, "Pengiriman", 9, "F2");
  content += text(438, 582, formatDate(document.deliveryDate), 9);
  content += text(left, 566, document.customerDetailLine2, 9);
  content += text(365, 566, "ETA", 9, "F2");
  content += text(438, 566, formatDate(document.etaDate), 9);
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
  const visibleRows = Math.max(items.length + 2, 2);
  for (let index = 0; index < visibleRows; index += 1) {
    const item = items[index];

    if (item) {
      const itemName = splitText(item.partName, 30)[0];
      content += centerText(colA, colB, y - 13, item.lineNo, 10);
      content += text(colB + 6, y - 13, item.partNumber, 10);
      content += text(colC + 6, y - 13, itemName, 10);
      content += centerText(colD, colE, y - 13, item.quantity, 10);
      content += rightText(colF - 8, y - 13, formatSheetRupiah(item.unitPrice), 10);
      content += rightText(colG - 8, y - 13, formatSheetRupiah(item.totalPrice), 10);
    }

    y -= rowHeight;
  }

  content += line(left, y, right, y);
  content += rightText(colG - 8, y - 18, formatSheetRupiah(document.totalAmount), 10);
  y -= 43;

  content += text(left, y, "Terbilang :", 10, "F3");
  y -= 18;
  for (const lineValue of splitText(document.amountInWords, 76).slice(0, 3)) {
    content += text(left, y, lineValue, 10, "F3");
    y -= 16;
  }

  y -= 20;
  content += text(left, y, "Rekening Pembayaran :", 10, "F2");
  y -= 18;
  content += text(left, y, "Bank", 10, "F2");
  content += text(left + 72, y, `   : ${paymentAccount.bank ?? "Bank BCA"}`, 10);
  y -= 18;
  content += text(left, y, "Nama Rek", 10, "F2");
  content += text(left + 72, y, `   : ${paymentAccount.accountName ?? "Morowali Putra Mandiri"}`, 10);
  y -= 18;
  content += text(left, y, "No Rek", 10, "F2");
  content += text(left + 72, y, `   : ${paymentAccount.accountNumber ?? "7245751010"}`, 10);

  content += centerText(390, 520, y, signature.label ?? "Hormat Kami,", 10);
  content += image("ImSignature", 427, y - 66, 56, 56);
  content += centerText(360, 545, y - 82, signatureCompany, 10);

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

function createPdf(document: SphDocument, items: SphItem[]) {
  const content = buildContent(document, items);
  const logo = loadJpegAsset(LOGO_JPEG_BASE64, 1080, 1080);
  const signatureQr = loadJpegAsset(SIGNATURE_JPEG_BASE64, 1105, 1105);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> /XObject << /ImLogo 7 0 R /ImSignature 8 0 R >> >> /Contents 9 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>",
    imageObject(logo),
    imageObject(signatureQr),
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
    return new Response("SPH tidak valid.", { status: 400 });
  }

  const db = await getDb();
  const [document] = await db
    .select({
      sphNo: sphDocuments.sphNo,
      sphDate: sphDocuments.sphDate,
      customerName: sphDocuments.customerName,
      customerDetailLine1: sphDocuments.customerDetailLine1,
      customerDetailLine2: sphDocuments.customerDetailLine2,
      customerDetailLine3: sphDocuments.customerDetailLine3,
      paymentTerm: sphDocuments.paymentTerm,
      franco: sphDocuments.franco,
      deliveryDate: sphDocuments.deliveryDate,
      etaDate: sphDocuments.etaDate,
      additionalInfo: sphDocuments.additionalInfo,
      totalAmount: sphDocuments.totalAmount,
      amountInWords: sphDocuments.amountInWords,
      staticSnapshotJson: sphDocuments.staticSnapshotJson,
      status: sphDocuments.status,
    })
    .from(sphDocuments)
    .where(eq(sphDocuments.id, id))
    .limit(1);

  if (!document) {
    return new Response("SPH tidak ditemukan.", { status: 404 });
  }

  if (["cek_harga", "draft"].includes(document.status)) {
    return new Response("SPH masih Cek Harga dan belum bisa didownload.", {
      status: 403,
    });
  }

  const items = await db
    .select({
      lineNo: sphItems.lineNo,
      partNumber: sphItems.partNumber,
      partName: sphItems.partName,
      quantity: sphItems.quantity,
      uom: sphItems.uom,
      unitPrice: sphItems.unitPrice,
      totalPrice: sphItems.totalPrice,
    })
    .from(sphItems)
    .where(eq(sphItems.sphId, id));

  items.sort((a, b) => a.lineNo - b.lineNo);

  return new Response(createPdf(document, items), {
    headers: {
      "Content-Disposition": `attachment; filename="${document.sphNo}.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
}
