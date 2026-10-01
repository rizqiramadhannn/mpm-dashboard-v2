import { PDFDocument } from "pdf-lib";

type TtbFormat = "application/pdf" | "image/jpeg" | "image/png";

function detectTtbFormat(bytes: Uint8Array): TtbFormat | null {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-") {
    return "application/pdf";
  }
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}

export async function validateSignedTtb(bytes: Uint8Array): Promise<TtbFormat> {
  const format = detectTtbFormat(bytes);
  if (!format) throw new Error("TTB harus berupa PDF, JPG, atau PNG yang valid.");

  try {
    if (format === "application/pdf") {
      const document = await PDFDocument.load(bytes);
      if (document.getPageCount() === 0) throw new Error("TTB PDF tidak memiliki halaman.");
    } else {
      const document = await PDFDocument.create();
      if (format === "image/png") await document.embedPng(bytes);
      else await document.embedJpg(bytes);
    }
  } catch {
    throw new Error("File TTB tidak dapat dibaca. Unggah PDF, JPG, atau PNG yang valid.");
  }

  return format;
}

export async function appendSignedTtb(invoiceBytes: Uint8Array, ttbBytes: Uint8Array) {
  const format = await validateSignedTtb(ttbBytes);
  const invoice = await PDFDocument.load(invoiceBytes);

  if (format === "application/pdf") {
    const ttb = await PDFDocument.load(ttbBytes);
    const pages = await invoice.copyPages(ttb, ttb.getPageIndices());
    for (const page of pages) invoice.addPage(page);
  } else {
    const image = format === "image/png"
      ? await invoice.embedPng(ttbBytes)
      : await invoice.embedJpg(ttbBytes);
    const landscape = image.width > image.height;
    const pageWidth = landscape ? 842 : 595;
    const pageHeight = landscape ? 595 : 842;
    const margin = 24;
    const scale = Math.min(
      (pageWidth - 2 * margin) / image.width,
      (pageHeight - 2 * margin) / image.height
    );
    const width = image.width * scale;
    const height = image.height * scale;
    const page = invoice.addPage([pageWidth, pageHeight]);
    page.drawImage(image, {
      height,
      width,
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
    });
  }

  return invoice.save();
}
