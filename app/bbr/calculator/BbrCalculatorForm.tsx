"use client";

import { useMemo, useState } from "react";

type CalculatorItem = {
  brand: string;
  customer: string;
  id: string;
  partName: string;
  partNumber: string;
  purchasePrice: string;
  quantity: string;
  sellingPrice: string;
  site: string;
  supplier: string;
};

type CalculatorRow = Omit<
  CalculatorItem,
  "purchasePrice" | "quantity" | "sellingPrice"
> & {
  index: number;
  margin: number;
  purchasePrice: number;
  purchaseTotal: number;
  quantity: number;
  sellingPrice: number;
  sellingTotal: number;
};

type CalculatorTotals = {
  bbrShare: number;
  feeJuswan: number;
  feeRiyan: number;
  feeSalesTotal: number;
  feeToto: number;
  grandTotal: number;
  margin: number;
  mpmShare: number;
  ongkir: number;
  profit: number;
  taxBase: number;
  totalPurchase: number;
  totalSelling: number;
  vat: number;
};

const brandOptions = [
  "",
  "SHACMAN",
  "SHACMAN CUMMINS",
  "SHACMAN WEICHAI",
  "HOWO",
  "HINO",
  "SANY",
  "FUSO",
];

function createItem(index: number): CalculatorItem {
  return {
    brand: "",
    customer: "",
    id: `bbr-item-${Date.now()}-${index}`,
    partName: "",
    partNumber: "",
    purchasePrice: "",
    quantity: "1",
    sellingPrice: "",
    site: "",
    supplier: "",
  };
}

function numeric(value: string) {
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function percent(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
    style: "percent",
  }).format(value);
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnName(index: number) {
  let value = index;
  let name = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }

  return name;
}

function cellRef(row: number, column: number) {
  return `${columnName(column)}${row}`;
}

function inlineStringCell(row: number, column: number, value: string, style = 0) {
  return `<c r="${cellRef(row, column)}" t="inlineStr" s="${style}"><is><t>${xmlEscape(value)}</t></is></c>`;
}

function numberCell(row: number, column: number, value: number, style = 0) {
  return `<c r="${cellRef(row, column)}" s="${style}"><v>${Number.isFinite(value) ? value : 0}</v></c>`;
}

function formulaCell(row: number, column: number, formula: string, value: number, style = 0) {
  return `<c r="${cellRef(row, column)}" s="${style}"><f>${xmlEscape(formula)}</f><v>${Number.isFinite(value) ? value : 0}</v></c>`;
}

function rowXml(rowNumber: number, cells: string[]) {
  return `<row r="${rowNumber}">${cells.join("")}</row>`;
}

function sanitizeFileName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ") || "calculator-bbr";
}

function crc32(bytes: Uint8Array) {
  let crc = -1;

  for (const byte of bytes) {
    crc ^= byte;

    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ -1) >>> 0;
}

function writeUint16(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(target: number[], value: number) {
  target.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  );
}

function createZip(files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder();
  const output: number[] = [];
  const centralDirectory: number[] = [];

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const offset = output.length;
    const checksum = crc32(contentBytes);

    writeUint32(output, 0x04034b50);
    writeUint16(output, 20);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint32(output, checksum);
    writeUint32(output, contentBytes.length);
    writeUint32(output, contentBytes.length);
    writeUint16(output, nameBytes.length);
    writeUint16(output, 0);
    output.push(...nameBytes, ...contentBytes);

    writeUint32(centralDirectory, 0x02014b50);
    writeUint16(centralDirectory, 20);
    writeUint16(centralDirectory, 20);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint32(centralDirectory, checksum);
    writeUint32(centralDirectory, contentBytes.length);
    writeUint32(centralDirectory, contentBytes.length);
    writeUint16(centralDirectory, nameBytes.length);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint32(centralDirectory, 0);
    writeUint32(centralDirectory, offset);
    centralDirectory.push(...nameBytes);
  }

  const centralOffset = output.length;
  output.push(...centralDirectory);
  writeUint32(output, 0x06054b50);
  writeUint16(output, 0);
  writeUint16(output, 0);
  writeUint16(output, files.length);
  writeUint16(output, files.length);
  writeUint32(output, centralDirectory.length);
  writeUint32(output, centralOffset);
  writeUint16(output, 0);

  return new Blob([new Uint8Array(output)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function createCalculatorWorksheet({
  noPr,
  rows,
  shippingCost,
  supplierTotals,
  totals,
}: {
  noPr: string;
  rows: CalculatorRow[];
  shippingCost: string;
  supplierTotals: Array<[string, number]>;
  totals: CalculatorTotals;
}) {
  const today = new Date().toLocaleDateString("id-ID");
  const rowCount = Math.max(rows.length, 1);
  const itemStart = 3;
  const itemEnd = itemStart + rowCount - 1;
  const rowsByNumber = new Map<number, string[]>();
  const addCells = (rowNumber: number, cells: string[]) => {
    rowsByNumber.set(rowNumber, [...(rowsByNumber.get(rowNumber) ?? []), ...cells]);
  };

  addCells(2, [
      inlineStringCell(2, 2, "NO", 1),
      inlineStringCell(2, 3, "TANGGAL", 1),
      inlineStringCell(2, 4, "NO PR", 1),
      inlineStringCell(2, 5, "CUSTOMER", 1),
      inlineStringCell(2, 6, "SITE", 1),
      inlineStringCell(2, 7, "PART NUMBER", 1),
      inlineStringCell(2, 8, "PART NAME", 1),
      inlineStringCell(2, 9, "QTY", 1),
      inlineStringCell(2, 10, "PRICE", 1),
      inlineStringCell(2, 11, "TOTAL", 1),
      inlineStringCell(2, 12, "PRICE MODAL", 1),
      inlineStringCell(2, 13, "TOTAL MODAL", 1),
      inlineStringCell(2, 14, "MARGIN", 1),
      inlineStringCell(2, 15, "SUPPLIER", 1),
      inlineStringCell(2, 16, "BRAND", 1),
      inlineStringCell(2, 17, "STATUS", 1),
      inlineStringCell(2, 19, "TOTAL", 2),
  ]);

  rows.forEach((item, index) => {
    const rowNumber = itemStart + index;

    addCells(rowNumber, [
        numberCell(rowNumber, 2, index + 1, 3),
        inlineStringCell(rowNumber, 3, index === 0 ? today : "", 3),
        inlineStringCell(rowNumber, 4, index === 0 ? noPr : "", 3),
        inlineStringCell(rowNumber, 5, item.customer, 3),
        inlineStringCell(rowNumber, 6, item.site, 3),
        inlineStringCell(rowNumber, 7, item.partNumber, 3),
        inlineStringCell(rowNumber, 8, item.partName, 3),
        numberCell(rowNumber, 9, item.quantity, 3),
        numberCell(rowNumber, 10, item.sellingPrice, 4),
        formulaCell(rowNumber, 11, `I${rowNumber}*J${rowNumber}`, item.sellingTotal, 4),
        numberCell(rowNumber, 12, item.purchasePrice, 4),
        formulaCell(rowNumber, 13, `I${rowNumber}*L${rowNumber}`, item.purchaseTotal, 4),
        formulaCell(rowNumber, 14, `K${rowNumber}-M${rowNumber}`, item.margin, 4),
        inlineStringCell(rowNumber, 15, item.supplier, 3),
        inlineStringCell(rowNumber, 16, item.brand, 3),
        inlineStringCell(rowNumber, 17, "", 3),
    ]);
  });

  addCells(3, [
      inlineStringCell(3, 19, "Total", 3),
      formulaCell(3, 20, `SUM(K${itemStart}:K${itemEnd})`, totals.totalSelling, 5),
  ]);
  addCells(4, [
      inlineStringCell(4, 19, "Tax Base", 3),
      formulaCell(4, 20, "T3*11/12", totals.taxBase, 5),
  ]);
  addCells(5, [
      inlineStringCell(5, 19, "VAT 12%", 3),
      formulaCell(5, 20, "T4*12/100", totals.vat, 5),
  ]);
  addCells(6, [
      inlineStringCell(6, 19, "Grand Total", 3),
      formulaCell(6, 20, "T3+T5", totals.grandTotal, 5),
  ]);
  addCells(10, [inlineStringCell(10, 19, "MODAL", 3), formulaCell(10, 20, `SUM(M${itemStart}:M${itemEnd})`, totals.totalPurchase, 5)]);
  addCells(11, [inlineStringCell(11, 19, "HARGA JUAL", 3), formulaCell(11, 20, `SUM(K${itemStart}:K${itemEnd})`, totals.totalSelling, 5)]);
  addCells(12, [inlineStringCell(12, 19, "MARGIN", 3), formulaCell(12, 20, "T11-T10", totals.margin, 5)]);
  addCells(14, [inlineStringCell(14, 19, "JUSWAN 3%", 3), formulaCell(14, 20, "T12*3%", totals.feeJuswan, 5)]);
  addCells(15, [inlineStringCell(15, 19, "TOTO 2%", 3), formulaCell(15, 20, "T12*2%", totals.feeToto, 5)]);
  addCells(16, [inlineStringCell(16, 19, "RIYAN 2%", 3), formulaCell(16, 20, "T12*2%", totals.feeRiyan, 5)]);
  addCells(18, [inlineStringCell(18, 19, "ONGKIR", 3), numberCell(18, 20, numeric(shippingCost), 5)]);
  addCells(20, [inlineStringCell(20, 19, "PROFIT", 3), formulaCell(20, 20, "T12-T14-T15-T16-T18", totals.profit, 5)]);
  addCells(22, [inlineStringCell(22, 19, "BBR 50%", 3), formulaCell(22, 20, "T20*50%", totals.bbrShare, 5)]);
  addCells(23, [inlineStringCell(23, 19, "MPM 50%", 3), formulaCell(23, 20, "T22", totals.mpmShare, 5)]);
  addCells(28, [inlineStringCell(28, 19, "PEMBAYARAN SUPPLIER", 2)]);
  addCells(30, [inlineStringCell(30, 19, "SUPPLIER", 1), inlineStringCell(30, 20, "NOMINAL", 1)]);

  supplierTotals.forEach(([supplier, total], index) => {
    const rowNumber = 31 + index;
    addCells(rowNumber, [inlineStringCell(rowNumber, 19, supplier, 3), numberCell(rowNumber, 20, total, 5)]);
  });

  const supplierTotalRow = 31 + supplierTotals.length;
  addCells(supplierTotalRow, [
      inlineStringCell(supplierTotalRow, 19, "TOTAL", 2),
      formulaCell(
        supplierTotalRow,
        20,
        supplierTotals.length > 0 ? `SUM(T31:T${supplierTotalRow - 1})` : "0",
        totals.totalPurchase,
        5
      ),
  ]);
  addCells(40, [inlineStringCell(40, 19, "FEE SALES", 3), formulaCell(40, 20, "T14+T15+T16", totals.feeSalesTotal, 5)]);
  addCells(41, [inlineStringCell(41, 19, "ONGKIR", 3), formulaCell(41, 20, "T18", totals.ongkir, 5)]);
  addCells(42, [inlineStringCell(42, 19, "MPM 50%", 3), formulaCell(42, 20, "T23", totals.mpmShare, 5)]);
  addCells(43, [inlineStringCell(43, 19, "TOTAL", 2), formulaCell(43, 20, "SUM(T40:T42)", totals.feeSalesTotal + totals.ongkir + totals.mpmShare, 5)]);
  addCells(45, [inlineStringCell(45, 19, "GRAND TOTAL", 2), formulaCell(45, 20, "T38+T43", totals.feeSalesTotal + totals.ongkir + totals.mpmShare, 5)]);
  addCells(46, [inlineStringCell(46, 19, "TOTAL BBR", 2), formulaCell(46, 20, "T22", totals.bbrShare, 5)]);

  const sheetRows = Array.from(rowsByNumber.entries())
    .sort(([a], [b]) => a - b)
    .map(([rowNumber, cells]) => rowXml(rowNumber, cells));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="2" max="2" width="6" customWidth="1"/>
    <col min="3" max="6" width="16" customWidth="1"/>
    <col min="7" max="8" width="22" customWidth="1"/>
    <col min="9" max="9" width="8" customWidth="1"/>
    <col min="10" max="14" width="15" customWidth="1"/>
    <col min="15" max="17" width="16" customWidth="1"/>
    <col min="19" max="20" width="18" customWidth="1"/>
  </cols>
  <sheetData>${sheetRows.join("")}</sheetData>
</worksheet>`;
}

function createStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="[$Rp-421]#,##0"/></numFmts>
  <fonts count="3">
    <font><sz val="10"/><name val="Calibri"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF20124D"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF4F7FA"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
  </cellXfs>
</styleSheet>`;
}

function createWorkbookBlob(args: {
  noPr: string;
  rows: CalculatorRow[];
  shippingCost: string;
  supplierTotals: Array<[string, number]>;
  totals: CalculatorTotals;
}) {
  return createZip([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="CALCULATOR" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "xl/styles.xml", content: createStylesXml() },
    { name: "xl/worksheets/sheet1.xml", content: createCalculatorWorksheet(args) },
  ]);
}

export function BbrCalculatorForm() {
  const [items, setItems] = useState<CalculatorItem[]>([createItem(1)]);
  const [noPr, setNoPr] = useState("");
  const [shippingCost, setShippingCost] = useState("");

  const rows = useMemo<CalculatorRow[]>(
    () =>
      items.map((item, index) => {
        const quantity = numeric(item.quantity);
        const sellingPrice = numeric(item.sellingPrice);
        const purchasePrice = numeric(item.purchasePrice);
        const sellingTotal = quantity * sellingPrice;
        const purchaseTotal = quantity * purchasePrice;
        const margin = sellingTotal - purchaseTotal;

        return {
          ...item,
          index,
          margin,
          purchasePrice,
          purchaseTotal,
          quantity,
          sellingPrice,
          sellingTotal,
        };
      }),
    [items]
  );
  const totals = useMemo<CalculatorTotals>(() => {
    const totalSelling = rows.reduce((total, item) => total + item.sellingTotal, 0);
    const totalPurchase = rows.reduce((total, item) => total + item.purchaseTotal, 0);
    const margin = totalSelling - totalPurchase;
    const feeJuswan = margin * 0.03;
    const feeToto = margin * 0.02;
    const feeRiyan = margin * 0.02;
    const feeSalesTotal = feeJuswan + feeToto + feeRiyan;
    const ongkir = numeric(shippingCost);
    const profit = margin - feeSalesTotal - ongkir;

    return {
      bbrShare: profit * 0.5,
      feeJuswan,
      feeRiyan,
      feeSalesTotal,
      feeToto,
      grandTotal: totalSelling + (totalSelling * 11) / 12 * 0.12,
      margin,
      mpmShare: profit * 0.5,
      ongkir,
      profit,
      taxBase: (totalSelling * 11) / 12,
      totalPurchase,
      totalSelling,
      vat: (totalSelling * 11) / 12 * 0.12,
    };
  }, [rows, shippingCost]);
  const supplierTotals = useMemo(() => {
    const grouped = new Map<string, number>();

    for (const item of rows) {
      const supplier = item.supplier.trim();

      if (!supplier) {
        continue;
      }

      grouped.set(supplier, (grouped.get(supplier) ?? 0) + item.purchaseTotal);
    }

    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  function updateItem(id: string, patch: Partial<CalculatorItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function addItem() {
    setItems((current) => [...current, createItem(current.length + 1)]);
  }

  function removeItem(id: string) {
    setItems((current) =>
      current.length <= 1 ? current : current.filter((item) => item.id !== id)
    );
  }

  function saveWorkbook() {
    const invalidRow = rows.find((item) => !item.partNumber.trim() && !item.partName.trim());

    if (invalidRow) {
      window.alert("Part number atau part name wajib diisi minimal salah satu untuk semua item.");
      return;
    }

    const blob = createWorkbookBlob({
      noPr,
      rows,
      shippingCost,
      supplierTotals,
      totals,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${sanitizeFileName(noPr || "calculator-bbr")}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bbr-calculator-page">
      <section className="form-section">
        <div className="section-heading">
          <div>
            <p className="page-kicker">BBR</p>
            <h1>Calculator Margin Penawaran</h1>
            <p>Input item penawaran, harga jual, harga beli, fee sales, dan ongkir.</p>
          </div>
          <div className="calculator-header-actions">
            <button className="primary-button" onClick={saveWorkbook} type="button">
              Save
            </button>
          </div>
        </div>
        <div className="form-grid">
          <label>
            <span>NO PR</span>
            <input
              onChange={(event) => setNoPr(event.target.value)}
              placeholder="Contoh: AJB 140"
              value={noPr}
            />
          </label>
        </div>
      </section>

      <section className="calculator-summary-grid" aria-label="Ringkasan calculator">
        <SummaryCard label="Total Harga Jual" value={money(totals.totalSelling)} />
        <SummaryCard label="Total Harga Beli" value={money(totals.totalPurchase)} />
        <SummaryCard label="Margin" value={money(totals.margin)} />
        <SummaryCard label="Profit" value={money(totals.profit)} />
        <SummaryCard label="BBR 50%" value={money(totals.bbrShare)} />
        <SummaryCard label="MPM 50%" value={money(totals.mpmShare)} />
      </section>

      <section className="form-section">
        <div className="section-heading compact">
          <div>
            <h2>Item Penawaran</h2>
            <p>Part number atau part name wajib diisi minimal salah satu.</p>
          </div>
          <button className="secondary-button" onClick={addItem} type="button">
            Tambah Item
          </button>
        </div>

        <div className="customer-table-wrap">
          <table className="customer-table bbr-calculator-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Customer</th>
                <th>Site</th>
                <th>Part Number</th>
                <th>Part Name</th>
                <th>Qty</th>
                <th>Harga Jual</th>
                <th>Total Harga Jual</th>
                <th>Harga Beli</th>
                <th>Total Harga Beli</th>
                <th>Margin</th>
                <th>Supplier</th>
                <th>Brand</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, index) => {
                const partInvalid = !item.partNumber.trim() && !item.partName.trim();

                return (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td>
                      <input
                        onChange={(event) =>
                          updateItem(item.id, { customer: event.target.value })
                        }
                        placeholder="Opsional"
                        value={item.customer}
                      />
                    </td>
                    <td>
                      <input
                        onChange={(event) =>
                          updateItem(item.id, { site: event.target.value })
                        }
                        placeholder="Opsional"
                        value={item.site}
                      />
                    </td>
                    <td>
                      <input
                        aria-invalid={partInvalid}
                        onChange={(event) =>
                          updateItem(item.id, { partNumber: event.target.value })
                        }
                        placeholder="Part number"
                        value={item.partNumber}
                      />
                    </td>
                    <td>
                      <input
                        aria-invalid={partInvalid}
                        onChange={(event) =>
                          updateItem(item.id, { partName: event.target.value })
                        }
                        placeholder="Part name"
                        value={item.partName}
                      />
                    </td>
                    <td>
                      <input
                        min="0"
                        onChange={(event) =>
                          updateItem(item.id, { quantity: event.target.value })
                        }
                        type="number"
                        value={item.quantity}
                      />
                    </td>
                    <td>
                      <input
                        min="0"
                        onChange={(event) =>
                          updateItem(item.id, { sellingPrice: event.target.value })
                        }
                        placeholder="0"
                        type="number"
                        value={item.sellingPrice}
                      />
                    </td>
                    <td className="numeric-cell">{money(item.sellingTotal)}</td>
                    <td>
                      <input
                        min="0"
                        onChange={(event) =>
                          updateItem(item.id, { purchasePrice: event.target.value })
                        }
                        placeholder="0"
                        type="number"
                        value={item.purchasePrice}
                      />
                    </td>
                    <td className="numeric-cell">{money(item.purchaseTotal)}</td>
                    <td className="numeric-cell">{money(item.margin)}</td>
                    <td>
                      <input
                        onChange={(event) =>
                          updateItem(item.id, { supplier: event.target.value })
                        }
                        placeholder="Opsional"
                        value={item.supplier}
                      />
                    </td>
                    <td>
                      <select
                        onChange={(event) =>
                          updateItem(item.id, { brand: event.target.value })
                        }
                        value={item.brand}
                      >
                        <option value="">Opsional</option>
                        {brandOptions
                          .filter(Boolean)
                          .map((brand) => (
                            <option key={brand} value={brand}>
                              {brand}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        disabled={items.length <= 1}
                        onClick={() => removeItem(item.id)}
                        type="button"
                      >
                        x
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="calculator-detail-grid">
        <article className="form-section">
          <div className="section-heading compact">
            <div>
              <h2>Fee Sales & Ongkir</h2>
              <p>Fee sales dihitung otomatis dari margin, ongkir diinput manual.</p>
            </div>
          </div>
          <div className="calculator-breakdown">
            <BreakdownRow label={`Juswan ${percent(0.03)}`} value={money(totals.feeJuswan)} />
            <BreakdownRow label={`Toto ${percent(0.02)}`} value={money(totals.feeToto)} />
            <BreakdownRow label={`Riyan ${percent(0.02)}`} value={money(totals.feeRiyan)} />
            <BreakdownRow label="Total Fee Sales" value={money(totals.feeSalesTotal)} strong />
            <label className="calculator-inline-input">
              <span>Ongkir</span>
              <input
                min="0"
                onChange={(event) => setShippingCost(event.target.value)}
                placeholder="0"
                type="number"
                value={shippingCost}
              />
            </label>
            <BreakdownRow label="Profit" value={money(totals.profit)} strong />
          </div>
        </article>

        <article className="form-section">
          <div className="section-heading compact">
            <div>
              <h2>Tax & Pembagian</h2>
              <p>Tax base, VAT, grand total, BBR 50%, dan MPM 50% otomatis.</p>
            </div>
          </div>
          <div className="calculator-breakdown">
            <BreakdownRow label="Tax Base" value={money(totals.taxBase)} />
            <BreakdownRow label="VAT 12%" value={money(totals.vat)} />
            <BreakdownRow label="Grand Total" value={money(totals.grandTotal)} strong />
            <BreakdownRow label="BBR 50%" value={money(totals.bbrShare)} />
            <BreakdownRow label="MPM 50%" value={money(totals.mpmShare)} />
          </div>
        </article>

        <article className="form-section">
          <div className="section-heading compact">
            <div>
              <h2>Pembayaran Supplier</h2>
              <p>Total harga beli dikelompokkan per supplier.</p>
            </div>
          </div>
          <div className="calculator-breakdown">
            {supplierTotals.length > 0 ? (
              supplierTotals.map(([supplier, total]) => (
                <BreakdownRow key={supplier} label={supplier} value={money(total)} />
              ))
            ) : (
              <p className="empty-card-text">Belum ada supplier.</p>
            )}
            <BreakdownRow label="Total" value={money(totals.totalPurchase)} strong />
          </div>
        </article>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function BreakdownRow({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div className={`calculator-breakdown-row ${strong ? "strong" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
