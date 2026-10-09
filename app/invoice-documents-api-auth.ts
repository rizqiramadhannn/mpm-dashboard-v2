import { validateSupplierNotesApiToken } from "./supplier-notes-api-auth";

export function isInvoiceDocumentsApiPath(path: string) {
  return path === "/api/invoice-documents" || path.startsWith("/api/invoice-documents/");
}
export function isInvoiceDocumentsApiScope(path: string, method: string) {
  return (method === "GET" || method === "PATCH") && /^\/api\/invoice-documents\/[^/]+$/.test(path)
    || method === "GET" && /^\/api\/invoice-documents\/[^/]+\/download$/.test(path)
    || method === "POST" && /^\/api\/invoice-documents\/[^/]+\/settle$/.test(path);
}
export async function invoiceDocumentsApiAuthorization(request: Request) {
  const valid = await validateSupplierNotesApiToken(request.headers.get("authorization"),
    process.env.INVOICE_DOCUMENTS_API_TOKEN_SHA256, process.env.INVOICE_DOCUMENTS_API_TOKEN_EXPIRES_AT);
  return !valid ? 401 : isInvoiceDocumentsApiScope(new URL(request.url).pathname, request.method) ? 200 : 403;
}
