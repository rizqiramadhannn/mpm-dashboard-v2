import { apiFailure, whatsappApiGuard } from "../../../whatsapp/api";
import { sessionStatus, startSession } from "../../../whatsapp/service";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const denied = await whatsappApiGuard(request);
  if (denied) return denied;
  try { return Response.json(await sessionStatus(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiFailure(error); }
}
export async function POST(request: Request) {
  const denied = await whatsappApiGuard(request, true);
  if (denied) return denied;
  try { return Response.json(await startSession(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiFailure(error); }
}
