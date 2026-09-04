export type ExcelCellValue = number | string | null | undefined;

export type ExcelColumn<T> = {
  format?: "currency" | "number" | "percent" | "text";
  header: string;
  value: (row: T, index: number) => ExcelCellValue;
  width?: number;
};

export type ExcelWorksheet<T> = {
  columns: ExcelColumn<T>[];
  rows: T[];
  sheetName: string;
  subtitle?: string;
  title?: string;
};

type AnyExcelWorksheet = Omit<ExcelWorksheet<never>, "rows"> & { rows: unknown[] };

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
  return `<c r="${cellRef(row, column)}" t="inlineStr" s="${style}"><is><t>${xmlEscape(
    value
  )}</t></is></c>`;
}

function numberCell(row: number, column: number, value: number, style = 0) {
  return `<c r="${cellRef(row, column)}" s="${style}"><v>${
    Number.isFinite(value) ? value : 0
  }</v></c>`;
}

function rowXml(rowNumber: number, cells: string[]) {
  return `<row r="${rowNumber}">${cells.join("")}</row>`;
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

function createStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="[$Rp-421] #,##0"/>
    <numFmt numFmtId="165" formatCode="0.0%"/>
  </numFmts>
  <fonts count="4">
    <font><sz val="10"/><name val="Calibri"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Calibri"/></font>
    <font><b/><color rgb="FF20124D"/><sz val="16"/><name val="Calibri"/></font>
    <font><i/><color rgb="FF667085"/><sz val="10"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF20124D"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF4F3FF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="9">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
</styleSheet>`;
}

function sanitizeSheetName(value: string) {
  return (value.trim().replace(/[:\\/?*[\]]+/g, " ").slice(0, 31) || "Sheet1").trim();
}

export function sanitizeExcelFileName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ") || "export";
}

function styleForColumn(format: ExcelColumn<unknown>["format"], value: ExcelCellValue) {
  if (typeof value !== "number") return 2;
  if (format === "currency") return 4;
  if (format === "percent") return 5;
  return 3;
}

function createWorksheetXml({
  columns,
  rows,
  subtitle,
  title,
}: AnyExcelWorksheet) {
  const headerRowNumber = title ? 4 : 1;
  const dataStartRow = headerRowNumber + 1;
  const topRows = title
    ? [
        rowXml(1, [inlineStringCell(1, 1, title, 6)]),
        rowXml(2, [inlineStringCell(2, 1, subtitle ?? "", 7)]),
      ]
    : [];
  const headerRow = rowXml(
    headerRowNumber,
    columns.map((column, index) =>
      inlineStringCell(headerRowNumber, index + 1, column.header, 1)
    )
  );
  const dataRows = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + dataStartRow;
    const cells = columns.map((column, columnIndex) => {
      const value = column.value(row as never, rowIndex);
      const style = styleForColumn(
        column.format as ExcelColumn<unknown>["format"],
        value
      );

      if (typeof value === "number") {
        return numberCell(rowNumber, columnIndex + 1, value, style);
      }

      return inlineStringCell(rowNumber, columnIndex + 1, String(value ?? ""), style);
    });

    return rowXml(rowNumber, cells);
  });
  const cols = columns
    .map((column, index) => {
      const columnNumber = index + 1;
      const width = column.width ?? Math.max(column.header.length + 2, 12);
      return `<col min="${columnNumber}" max="${columnNumber}" width="${width}" customWidth="1"/>`;
    })
    .join("");
  const endColumn = columnName(Math.max(1, columns.length));
  const endRow = Math.max(headerRowNumber, dataStartRow + rows.length - 1);
  const merge = title && columns.length > 1 ? `<mergeCells count="2"><mergeCell ref="A1:${endColumn}1"/><mergeCell ref="A2:${endColumn}2"/></mergeCells>` : "";
  const autoFilter = rows.length > 0 ? `<autoFilter ref="A${headerRowNumber}:${endColumn}${endRow}"/>` : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${endColumn}${endRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRowNumber}" topLeftCell="A${dataStartRow}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${cols}</cols>
  <sheetData>${[...topRows, headerRow, ...dataRows].join("")}</sheetData>
  ${merge}
  ${autoFilter}
  <pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

export function createExcelWorkbookBlob({
  sheets,
}: {
  sheets: AnyExcelWorksheet[];
}) {
  const normalizedSheets = sheets.map((sheet, index) => ({
    ...sheet,
    sheetName: sanitizeSheetName(sheet.sheetName || `Sheet${index + 1}`),
  }));
  const contentTypes = normalizedSheets
    .map(
      (_sheet, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("");
  const workbookSheets = normalizedSheets
    .map(
      (sheet, index) =>
        `<sheet name="${xmlEscape(sheet.sheetName)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join("");
  const worksheetRelationships = normalizedSheets
    .map(
      (_sheet, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join("");
  const styleRelationshipId = normalizedSheets.length + 1;
  const files = normalizedSheets.map((sheet, index) => ({
    name: `xl/worksheets/sheet${index + 1}.xml`,
    content: createWorksheetXml(sheet),
  }));
  return createZip([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${contentTypes}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${worksheetRelationships}<Relationship Id="rId${styleRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "xl/styles.xml", content: createStylesXml() },
    ...files,
  ]);
}

export function downloadExcelWorkbook({
  fileName,
  sheets,
}: {
  fileName: string;
  sheets: AnyExcelWorksheet[];
}) {
  const blob = createExcelWorkbookBlob({ sheets });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${sanitizeExcelFileName(fileName)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadExcel<T>({
  columns,
  fileName,
  rows,
  sheetName,
}: {
  columns: ExcelColumn<T>[];
  fileName: string;
  rows: T[];
  sheetName: string;
}) {
  const headerRow = rowXml(
    1,
    columns.map((column, index) => inlineStringCell(1, index + 1, column.header, 1))
  );
  const dataRows = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const cells = columns.map((column, columnIndex) => {
      const value = column.value(row, rowIndex);

      if (typeof value === "number") {
        return numberCell(rowNumber, columnIndex + 1, value, 3);
      }

      return inlineStringCell(rowNumber, columnIndex + 1, String(value ?? ""), 2);
    });

    return rowXml(rowNumber, cells);
  });
  const cols = columns
    .map((column, index) => {
      const columnNumber = index + 1;
      const width = column.width ?? Math.max(column.header.length + 2, 12);
      return `<col min="${columnNumber}" max="${columnNumber}" width="${width}" customWidth="1"/>`;
    })
    .join("");
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${cols}</cols>
  <sheetData>${[headerRow, ...dataRows].join("")}</sheetData>
</worksheet>`;
  const workbookSheetName = xmlEscape(sanitizeSheetName(sheetName));
  const blob = createZip([
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
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${workbookSheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "xl/styles.xml", content: createStylesXml() },
    { name: "xl/worksheets/sheet1.xml", content: worksheet },
  ]);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${sanitizeExcelFileName(fileName)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
