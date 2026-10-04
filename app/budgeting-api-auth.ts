import { validateSupplierNotesApiToken } from "./supplier-notes-api-auth";

export function isBudgetingApiPath(pathname: string) {
  return pathname === "/api/budgeting" || pathname.startsWith("/api/budgeting/");
}

export function isBudgetingApiScope(pathname: string, method: string) {
  return method === "GET" && /^\/api\/budgeting\/(invoices|supplier-notes)(\/[^/]+)?$/.test(pathname);
}

// Independent credential: never reuse a browser session or a supplier write token.
export async function budgetingApiAuthorization(request: Request) {
  const valid = await validateSupplierNotesApiToken(
    request.headers.get("authorization"),
    process.env.BUDGETING_API_TOKEN_SHA256,
    process.env.BUDGETING_API_TOKEN_EXPIRES_AT,
  );
  if (!valid) return 401;
  return isBudgetingApiScope(new URL(request.url).pathname, request.method) ? 200 : 403;
}
