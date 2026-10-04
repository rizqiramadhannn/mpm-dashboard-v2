import { getDb } from "../../db";
import { budgetingApiAuthorization } from "../budgeting-api-auth";
import { InvalidBudgetingQuery, parseBudgetingQuery, readBudgetingDocuments, type DocumentType } from "./query";

const headers = { "Cache-Control": "private, no-store", "Vary": "Authorization" };
export async function budgetingResponse(request: Request, type: DocumentType, id?: string) {
  // Defense in depth for runtimes that do not execute the Next proxy.
  const status = await budgetingApiAuthorization(request);
  if (status !== 200) return Response.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status, headers });
  try {
    const params = new URL(request.url).searchParams;
    if (id && [...params.keys()].some(key => key !== "asOf")) throw new InvalidBudgetingQuery("Detail hanya menerima asOf.");
    const query = parseBudgetingQuery(params);
    const result = await readBudgetingDocuments(await getDb(), type, query, id);
    if (id && !result.data.length) return Response.json({ error: "Dokumen tidak ditemukan." }, { status: 404, headers });
    return Response.json(id ? { data: result.data[0], asOf: result.asOf, timeZone: result.timeZone } : result, { headers });
  } catch (error) {
    if (error instanceof InvalidBudgetingQuery) return Response.json({ error: error.message }, { status: 400, headers });
    return Response.json({ error: "Gagal membaca dokumen budgeting." }, { status: 500, headers });
  }
}
