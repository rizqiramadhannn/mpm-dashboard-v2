import { NextResponse } from "next/server";
import { invoiceDocumentsApiAuthorization } from "../../../../invoice-documents-api-auth";
import { GET as downloadInvoice } from "../../../../invoice/download/[id]/route";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await invoiceDocumentsApiAuthorization(request);
  if (auth !== 200) return NextResponse.json({ error: "Unauthorized or forbidden" }, { status: auth });
  return downloadInvoice(request, context);
}
