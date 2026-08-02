import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  shipmentJourneys,
  shipments,
  sphDocuments,
  sphItems,
  suppliers,
} from "../../../../../db/schema";
import { LOGO_JPEG_BASE64, SIGNATURE_JPEG_BASE64 } from "../../../../sph/download/[id]/assets";

type TtbDocument = {
  customerName: string;
  refSphNos: string;
  ttbNo: string;
};

type TtbItem = {
  lineNo: string;
  partNumber: string;
  partName: string;
  quantity: number;
  uom: string;
  note: string;
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

function centerText(x1: number, x2: number, y: number, value: unknown, size = 9, font = "F1") {
  const display = pdfString(value);
  const estimatedWidth = display.length * size * 0.5;
  return text((x1 + x2 - estimatedWidth) / 2, y, display, size, font);
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

function checkBox(x: number, y: number) {
  return rect(x, y, 9, 9);
}

function buildContent(document: TtbDocument, items: TtbItem[]) {
  const addressLines = [
    "Jl. Trans Sulawesi",
    "Kavling Bintang Putri Blok D No 4",
    "Bahodopi - Morowali",
    "Sulawesi Tengah",
  ];
  const handoverText =
    "Pada hari ini Tanggal ____________________ telah diserahkan sejumlah barang " +
    "dengan informasi detail sebagai berikut :";
  const refSphLines = document.refSphNos
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  let content = "1 w\n";
  content += image("ImLogo", left, 772, 52, 52);
  content += centerText(0, pageWidth, 796, "TANDA TERIMA BARANG", 16, "F2");

  content += text(left, 728, "PT Morowali Putra Mandiri", 11, "F2");
  addressLines.forEach((addressLine, index) => {
    content += text(left, 708 - index * 16, addressLine, 10);
  });

  content += text(382, 728, "No TTB", 10, "F2");
  content += text(452, 728, document.ttbNo, 10);
  content += text(382, 708, "No PO", 10, "F2");
  content += text(452, 708, "-", 10);
  content += text(382, 688, "Tanggal", 10, "F2");
  content += text(452, 688, "_________", 10);
  content += text(382, 668, "Ref SPH", 10, "F2");
  if (refSphLines.length > 0) {
    refSphLines.slice(0, 3).forEach((sphNo, index) => {
      content += text(452, 668 - index * 14, sphNo, 8);
    });
  } else {
    content += text(452, 668, "-", 8);
  }

  content += text(left, 612, handoverText, 10);

  const tableTop = 565;
  const headerHeight = 23;
  const rowHeight = 24;
  const colA = left;
  const colB = 76;
  const colC = 158;
  const colD = 352;
  const colE = 408;
  const colF = 462;
  const colG = right;
  const cols = [colA, colB, colC, colD, colE, colF, colG];

  content += "0 0 0 rg\n";
  content += fillRect(left, tableTop - headerHeight, right - left, headerHeight);
  content += rect(left, tableTop - headerHeight, right - left, headerHeight);
  for (const col of cols.slice(1, -1)) {
    content += line(col, tableTop, col, tableTop - headerHeight);
  }
  content += "1 1 1 rg\n";
  content += centerText(colA, colB, tableTop - 15, "No.", 9, "F2");
  content += centerText(colB, colC, tableTop - 15, "Part Number", 9, "F2");
  content += centerText(colC, colD, tableTop - 15, "Part Name", 9, "F2");
  content += centerText(colD, colE, tableTop - 15, "Jumlah", 9, "F2");
  content += centerText(colE, colF, tableTop - 15, "Satuan", 9, "F2");
  content += centerText(colF, colG, tableTop - 15, "Cek", 9, "F2");
  content += "0 0 0 rg\n";

  let y = tableTop - headerHeight;
  const visibleRows = items.length + 2;

  for (let index = 0; index < visibleRows; index += 1) {
    const item = items[index];

    if (item) {
      const nameLines = splitText(item.partName, 31);
      content += centerText(colA, colB, y - 15, item.lineNo, 9);
      content += text(colB + 5, y - 15, item.partNumber, 8);
      content += text(colC + 5, y - 15, nameLines[0], 8);
      content += centerText(colD, colE, y - 15, item.quantity, 9);
      content += centerText(colE, colF, y - 15, item.uom || "pcs", 9);
      content += checkBox((colF + colG - 9) / 2, y - 17);
    }

    y -= rowHeight;
  }

  y -= 38;
  content += centerText(60, 250, y, "PT Morowali Putra Mandiri", 10);
  content += centerText(360, 550, y, "Diterima oleh", 10);
  content += image("ImSignature", 124, y - 76, 56, 56);
  y -= 92;
  content += centerText(60, 250, y, "Admin Logistik MPM", 10);
  content += centerText(360, 550, y, document.customerName, 10);

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

function createPdf(document: TtbDocument, items: TtbItem[]) {
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
    return new Response("Pengiriman tidak valid.", { status: 400 });
  }

  const db = await getDb();
  const [shipment] = await db
    .select({
      customerName: shipments.customerName,
      shipmentNo: shipments.shipmentNo,
    })
    .from(shipments)
    .where(eq(shipments.id, id))
    .limit(1);

  if (!shipment) {
    return new Response("Pengiriman tidak ditemukan.", { status: 404 });
  }

  const rows = await db
    .select({
      destination: shipmentJourneys.destination,
      latestStatus: shipmentJourneys.latestStatus,
      lineNo: sphItems.lineNo,
      origin: shipmentJourneys.origin,
      partName: sphItems.partName,
      partNumber: sphItems.partNumber,
      quantity: shipmentJourneys.quantity,
      sphNo: sphDocuments.sphNo,
      splitNo: shipmentJourneys.splitNo,
      supplierName: suppliers.name,
      uom: sphItems.uom,
    })
    .from(shipmentJourneys)
    .innerJoin(sphItems, eq(shipmentJourneys.sphItemId, sphItems.id))
    .innerJoin(sphDocuments, eq(sphItems.sphId, sphDocuments.id))
    .leftJoin(suppliers, eq(shipmentJourneys.supplierId, suppliers.id))
    .where(eq(shipmentJourneys.shipmentId, id));
  const refSphNos = [...new Set(rows.map((row) => row.sphNo))].join(", ");
  const items = rows
    .sort(
      (a, b) =>
        a.sphNo.localeCompare(b.sphNo) ||
        a.lineNo - b.lineNo ||
        a.splitNo - b.splitNo
    )
    .map((row, index) => {
      return {
        lineNo: String(index + 1),
        note: "",
        partName: row.partName,
        partNumber: row.partNumber,
        quantity: row.quantity,
        uom: row.uom,
      };
    });
  const ttbNo = shipment.shipmentNo;

  return new Response(
    createPdf(
      {
        customerName: shipment.customerName,
        refSphNos,
        ttbNo,
      },
      items
    ),
    {
      headers: {
        "Content-Disposition": `attachment; filename="${ttbNo}.pdf"`,
        "Content-Type": "application/pdf",
      },
    }
  );
}
