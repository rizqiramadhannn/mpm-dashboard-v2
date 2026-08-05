import { listPaymentRequests } from "../data";

export const dynamic = "force-dynamic";

function escapeXml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function cell(value: string | number, styleId: string, type = "String") {
  return `<Cell ss:StyleID="${styleId}"><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

function emptyCell() {
  return "<Cell />";
}

function row(cells: string[]) {
  return `<Row>${cells.join("")}</Row>`;
}

function buildWorkbookXml(
  rows: Awaited<ReturnType<typeof listPaymentRequests>>
) {
  const dataRows = rows.map((item, index) =>
    row([
      emptyCell(),
      cell(index + 1, "Center", "Number"),
      cell(formatDate(item.requestDate), "DateText"),
      cell(item.requestedByUsername || "-", "Center"),
      cell(item.sourceFund, "Center"),
      cell(item.amount, "Money", "Number"),
      cell(item.destinationAccount, "Text"),
      cell(item.description, "Text"),
      cell(item.transactionPurpose, "Text"),
      cell(item.status, "Text"),
    ])
  );

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Bottom"/>
      <Font ss:FontName="Arial" ss:Size="10"/>
    </Style>
    <Style ss:ID="Title">
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
    </Style>
    <Style ss:ID="Header">
      <Alignment ss:Horizontal="Center" ss:Vertical="Bottom"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
      <Interior ss:Color="#CFE2F3" ss:Pattern="Solid"/>
      <Font ss:FontName="Arial" ss:Size="10"/>
    </Style>
    <Style ss:ID="Center">
      <Alignment ss:Horizontal="Center" ss:Vertical="Bottom"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="DateText">
      <Alignment ss:Horizontal="Center" ss:Vertical="Bottom"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Money">
      <Alignment ss:Horizontal="Right" ss:Vertical="Bottom"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
      <NumberFormat ss:Format="#,##0"/>
    </Style>
    <Style ss:ID="Text">
      <Alignment ss:Horizontal="Left" ss:Vertical="Bottom"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
  </Styles>
  <Worksheet ss:Name="Sheet1">
    <Table>
      <Column ss:Width="24"/>
      <Column ss:Width="42"/>
      <Column ss:Width="86"/>
      <Column ss:Width="110"/>
      <Column ss:Width="118"/>
      <Column ss:Width="100"/>
      <Column ss:Width="160"/>
      <Column ss:Width="190"/>
      <Column ss:Width="210"/>
      <Column ss:Width="100"/>
      ${row([emptyCell(), '<Cell ss:StyleID="Title"><Data ss:Type="String">PAYMENT REQUEST</Data></Cell>'])}
      ${row([emptyCell()])}
      ${row([
        emptyCell(),
        cell("No", "Header"),
        cell("Tanggal", "Header"),
        cell("Diajukan Oleh", "Header"),
        cell("Sumber Dana", "Header"),
        cell("Nominal", "Header"),
        cell("Rek Tujuan", "Header"),
        cell("Deskripsi", "Header"),
        cell("Tujuan Transaksi", "Header"),
        cell("Status", "Header"),
      ])}
      ${dataRows.join("\n")}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>3</SplitHorizontal>
      <TopRowBottomPane>3</TopRowBottomPane>
      <ActivePane>2</ActivePane>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`;
}

export async function GET() {
  const rows = await listPaymentRequests("asc");
  const xml = buildWorkbookXml(rows);

  return new Response(xml, {
    headers: {
      "content-disposition": 'attachment; filename="payment-request.xls"',
      "content-type": "application/vnd.ms-excel; charset=utf-8",
    },
  });
}
