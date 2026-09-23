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
  pdfSphDate: string | null;
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

function estimatedTextWidth(value: unknown, size = 9) {
  return Array.from(pdfString(value)).reduce((width, char) => {
    if (char === " ") {
      return width + size * 0.28;
    }

    if ("MW".includes(char)) {
      return width + size * 0.88;
    }

    if ("ABCDEFGHKNOPQRSTUVWXYZ".includes(char)) {
      return width + size * 0.68;
    }

    if ("0123456789".includes(char)) {
      return width + size * 0.56;
    }

    if ("ijlI.,:/-".includes(char)) {
      return width + size * 0.32;
    }

    return width + size * 0.52;
  }, 0);
}

function splitLongText(value: string, maxWidth: number, size = 9) {
  const lines: string[] = [];
  let current = "";

  for (const char of value) {
    const next = `${current}${char}`;

    if (current && estimatedTextWidth(next, size) > maxWidth) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

function fitText(value: string, maxWidth: number, size = 9) {
  if (estimatedTextWidth(value, size) <= maxWidth) {
    return value;
  }

  const suffix = "...";
  let fitted = value;

  while (
    fitted.length > 0 &&
    estimatedTextWidth(`${fitted}${suffix}`, size) > maxWidth
  ) {
    fitted = fitted.slice(0, -1);
  }

  return fitted ? `${fitted}${suffix}` : "";
}

function partNumberTokens(value: string) {
  const parts = value.split(/(\s+|\/)/).filter(Boolean);
  const tokens: string[] = [];
  let current = "";

  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else if (part === "/") {
      current = `${current}/`;
      tokens.push(current);
      current = "";
    } else {
      current = `${current}${part}`;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens.length > 0 ? tokens : [""];
}

function wrapText(
  value: unknown,
  maxWidth: number,
  size = 9,
  options: { maxLines?: number; slashBreaks?: boolean } = {}
) {
  const display = pdfString(value);
  const words = options.slashBreaks ? partNumberTokens(display) : display.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words.length > 0 ? words : [""]) {
    if (estimatedTextWidth(word, size) > maxWidth) {
      if (current) {
        lines.push(current);
        current = "";
      }

      const splitLines = splitLongText(word, maxWidth, size);
      lines.push(...splitLines.slice(0, -1));
      current = splitLines.at(-1) ?? "";

      continue;
    }

    const separator = options.slashBreaks && current.endsWith("/") ? "" : " ";
    const next = current ? `${current}${separator}${word}` : word;

    if (current && estimatedTextWidth(next, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  const normalizedLines = lines.length > 0 ? lines : [""];

  if (options.maxLines && normalizedLines.length > options.maxLines) {
    return [
      ...normalizedLines.slice(0, options.maxLines - 1),
      fitText(normalizedLines.slice(options.maxLines - 1).join(" "), maxWidth, size),
    ];
  }

  return normalizedLines;
}

function multilineText(
  x: number,
  y: number,
  lines: string[],
  size = 9,
  font = "F1",
  lineHeight = 11
) {
  return lines.map((lineValue, index) => text(x, y - index * lineHeight, lineValue, size, font)).join("");
}

function rightText(x: number, y: number, value: unknown, size = 9) {
  const display = pdfString(value);
  return text(x - estimatedTextWidth(display, size), y, display, size);
}

function centerText(x1: number, x2: number, y: number, value: unknown, size = 9, font = "F1") {
  const display = pdfString(value);
  const estimatedWidth = estimatedTextWidth(display, size);
  return text((x1 + x2 - estimatedWidth) / 2, y, display, size, font);
}

type PreparedSphItem = SphItem & {
  partNameLines: string[];
  partNumberLines: string[];
  rowHeight: number;
};

function prepareItem(item: SphItem): PreparedSphItem {
  const partNumberLines = wrapText(item.partNumber, colC - colB - 12, 9, { slashBreaks: true });
  const partNameLines = wrapText(item.partName, colD - colC - 12, 10, { maxLines: 3 });
  return {
    ...item,
    partNameLines,
    partNumberLines,
    rowHeight: Math.max(19, Math.max(partNumberLines.length, partNameLines.length) * 11 + 8),
  };
}

function tableHeader(tableTop: number) {
  const headerHeight = 22;
  const cols = [colA, colB, colC, colD, colE, colF, colG];
  let content = "0 0 0 rg\n";
  content += fillRect(left, tableTop - headerHeight, right - left, headerHeight);
  content += "0 0 0 RG\n";
  content += rect(left, tableTop - headerHeight, right - left, headerHeight);
  for (const col of cols.slice(1, -1)) content += line(col, tableTop, col, tableTop - headerHeight);
  content += "1 1 1 rg\n";
  content += centerText(colA, colB, tableTop - 14, "No.", 10, "F2");
  content += centerText(colB, colC, tableTop - 14, "Part Number", 10, "F2");
  content += centerText(colC, colD, tableTop - 14, "Part Name", 10, "F2");
  content += centerText(colD, colE, tableTop - 14, "Jumlah", 10, "F2");
  content += centerText(colE, colF, tableTop - 14, "Harga Satuan", 10, "F2");
  content += centerText(colF, colG, tableTop - 14, "Total", 10, "F2");
  return content + "0 0 0 rg\n";
}

function itemRow(item: PreparedSphItem, y: number) {
  let content = centerText(colA, colB, y - 13, item.lineNo, 10);
  content += multilineText(colB + 6, y - 13, item.partNumberLines, 9, "F1", 11);
  content += multilineText(colC + 6, y - 13, item.partNameLines, 10, "F1", 11);
  content += centerText(colD, colE, y - 13, item.quantity, 10);
  content += rightText(colF - 8, y - 13, formatSheetRupiah(item.unitPrice), 10);
  return content + rightText(colG - 8, y - 13, formatSheetRupiah(item.totalPrice), 10);
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

  const preparedItems = items.map(prepareItem);
  const pages: string[] = [];
  let itemIndex = 0;

  do {
    const firstPage = pages.length === 0;
    const tableTop = firstPage ? 494 : 748;
    const rowStart = tableTop - 22;
    const remainingHeight = preparedItems.slice(itemIndex).reduce((sum, item) => sum + item.rowHeight, 0);
    const isFinalPage = remainingHeight + 38 <= rowStart - 300;
    const pageItems: PreparedSphItem[] = [];
    let availableY = rowStart;

    if (isFinalPage) {
      pageItems.push(...preparedItems.slice(itemIndex));
      itemIndex = preparedItems.length;
    } else {
      while (itemIndex < preparedItems.length - 1 && availableY - preparedItems[itemIndex].rowHeight >= 55) {
        const item = preparedItems[itemIndex];
        pageItems.push(item);
        availableY -= item.rowHeight;
        itemIndex += 1;
      }
      if (pageItems.length === 0 && itemIndex < preparedItems.length) {
        pageItems.push(preparedItems[itemIndex]);
        itemIndex += 1;
      }
    }

    let content = "1 w\n";
    if (!firstPage) {
      content += image("ImLogo", left, 774, 42, 42);
      content += centerText(0, pageWidth, 798, "SURAT PENAWARAN HARGA - LANJUTAN", 13, "F2");
      content += text(left, 758, companyName, 9, "F2");
      content += rightText(right, 758, document.sphNo, 9);
    } else {
  content += image("ImLogo", left, 772, 52, 52);
  content += centerText(0, pageWidth, 798, "SURAT PENAWARAN HARGA", 14, "F2");
  content += text(left, 732, companyName, 10, "F2");
  content += text(365, 732, "Quo. No", 10, "F2");
  content += text(438, 732, document.sphNo, 9);
  content += text(365, 714, "Tanggal.", 10, "F2");
  content += text(438, 714, formatDate(document.pdfSphDate ?? document.sphDate), 9);

  addressLines.forEach((addressLine, index) => {
    content += text(left, 716 - index * 16, addressLine, 9);
  });

  content += text(left, 620, "Kepada Yth : ", 10, "F2");
  content += text(365, 620, "Pembayaran", 9, "F2");
  content += text(438, 620, document.paymentTerm, 9);
  let customerY = 598;
  for (const customerLine of [
    { value: document.customerName, size: 10 },
    { value: document.customerDetailLine1, size: 9 },
    { value: document.customerDetailLine2, size: 9 },
    { value: document.customerDetailLine3, size: 9 },
  ]) {
    const lines = wrapText(customerLine.value, 310, customerLine.size, { maxLines: 2 });
    content += multilineText(left, customerY, lines, customerLine.size);
    customerY -= lines.length * 12 + 4;
  }
  content += text(365, 598, "Franco ", 9, "F2");
  content += text(438, 598, document.franco || "-", 9);
  content += text(365, 582, "Pengiriman", 9, "F2");
  content += text(438, 582, formatDate(document.deliveryDate), 9);
  content += text(365, 566, "ETA", 9, "F2");
  content += text(438, 566, formatDate(document.etaDate), 9);

    }

    content += tableHeader(tableTop);
    let y = rowStart;
    for (const item of pageItems) {
      content += itemRow(item, y);
      y -= item.rowHeight;
    }

    if (isFinalPage) {
      y -= 38;
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
    } else {
      content += line(left, y, right, y);
      content += rightText(right, Math.max(35, y - 18), "Bersambung ke halaman berikutnya", 9);
    }
    pages.push(content);
  } while (itemIndex < preparedItems.length);

  return pages.map((content, index) =>
    content + centerText(0, pageWidth, 20, `Halaman ${index + 1} dari ${pages.length}`, 8)
  );
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

export function createSphPdf(document: SphDocument, items: SphItem[]) {
  const contents = buildContent(document, items);
  const logo = loadJpegAsset(LOGO_JPEG_BASE64, 1080, 1080);
  const signatureQr = loadJpegAsset(SIGNATURE_JPEG_BASE64, 1105, 1105);
  const pageObjectStart = 3;
  const fontObjectStart = pageObjectStart + contents.length;
  const logoObject = fontObjectStart + 3;
  const signatureObject = logoObject + 1;
  const contentObjectStart = signatureObject + 1;
  const pageReferences = contents
    .map((_, index) => `${pageObjectStart + index} 0 R`)
    .join(" ");
  const pageObjects = contents.map(
    (_, index) =>
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Resources << /Font << /F1 ${fontObjectStart} 0 R /F2 ${fontObjectStart + 1} 0 R ` +
      `/F3 ${fontObjectStart + 2} 0 R >> /XObject << /ImLogo ${logoObject} 0 R ` +
      `/ImSignature ${signatureObject} 0 R >> >> /Contents ${contentObjectStart + index} 0 R >>`
  );
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageReferences}] /Count ${contents.length} >>`,
    ...pageObjects,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>",
    imageObject(logo),
    imageObject(signatureQr),
    ...contents.map(
      (content) =>
        `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}endstream`
    ),
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
      pdfSphDate: sphDocuments.pdfSphDate,
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

  return new Response(createSphPdf(document, items), {
    headers: {
      "Content-Disposition": `attachment; filename="${document.sphNo}.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
}
