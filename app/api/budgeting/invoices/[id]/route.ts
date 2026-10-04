import { budgetingResponse } from "../../../../budgeting/handler";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return budgetingResponse(request, "invoices", (await context.params).id);
}
