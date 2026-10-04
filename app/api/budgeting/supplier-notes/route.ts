import { budgetingResponse } from "../../../budgeting/handler";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return budgetingResponse(request, "supplier-notes"); }
