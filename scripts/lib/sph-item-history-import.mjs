import { createHash } from "node:crypto";

export const SOURCE_SPREADSHEET_ID = "1z-hLdIQG4STbRjxGsgzShQf-joWV_hufbEGyvR--keg";
export const SOURCE_SHEET_NAME = "Sheet1";
export const SOURCE_FIRST_ROW = 8;

function text(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function number(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = text(value).replace(/[^\d,.-]/g, "").replaceAll(".", "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function googleSerialDateToIso(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const serial = number(value);
  if (serial === null) return null;
  const date = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function canonicalContent(record) {
  return JSON.stringify([
    record.sphDate,
    record.partNumber,
    record.partName,
    record.customerName,
    record.sphNo,
    record.quantity,
    record.uom,
    record.unitPrice,
    record.totalPrice,
  ]);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function parseItemHistoryRows(
  values,
  {
    spreadsheetId = SOURCE_SPREADSHEET_ID,
    sheetName = SOURCE_SHEET_NAME,
    firstRow = SOURCE_FIRST_ROW,
  } = {}
) {
  const valid = [];
  const skippedRows = [];

  values.forEach((row, index) => {
    const sourceRow = firstRow + index;
    const sphDate = googleSerialDateToIso(row[7]);
    const partName = text(row[2]);
    const customerName = text(row[5]);
    const sphNo = text(row[6]);
    const unitPriceValue = number(row[8]);
    const unitPrice = unitPriceValue === null ? null : Math.round(unitPriceValue);

    if (!partName || !customerName || !sphNo || !sphDate || unitPrice === null || unitPrice < 0) {
      skippedRows.push(sourceRow);
      return;
    }

    const quantityValue = number(row[3]);
    const totalPriceValue = number(row[9]);
    const record = {
      sourceSpreadsheetId: spreadsheetId,
      sourceSheetName: sheetName,
      sourceRow,
      sphDate,
      partNumber: text(row[1]),
      partName,
      customerName,
      sphNo,
      quantity: quantityValue,
      uom: text(row[4]),
      unitPrice,
      totalPrice: totalPriceValue === null ? null : Math.round(totalPriceValue),
      status: "-",
    };
    const contentHash = hash(canonicalContent(record));
    valid.push({
      ...record,
      contentHash,
    });
  });

  const mostRecentRowByContent = new Map();
  const records = [];
  const duplicateRows = [];
  for (const record of valid) {
    const previousRow = mostRecentRowByContent.get(record.contentHash);
    // Repeated blocks next to the original are accidental copies. A matching
    // line much later in the ledger is retained as a separate historical row.
    if (previousRow !== undefined && record.sourceRow - previousRow <= 10) {
      duplicateRows.push(record.sourceRow);
      continue;
    }
    mostRecentRowByContent.set(record.contentHash, record.sourceRow);
    const sourceKey = `${spreadsheetId}:${sheetName}:${record.sourceRow}:${record.contentHash}`;
    const values = { ...record };
    delete values.contentHash;
    records.push({
      ...values,
      id: `sheet1-${hash(sourceKey).slice(0, 32)}`,
      sourceKey,
    });
  }

  return { records, skippedRows, duplicateRows, validRows: valid.length };
}
