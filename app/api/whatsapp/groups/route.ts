import { apiFailure, whatsappApiGuard } from "../../../whatsapp/api";
import { listAvailableGroups, saveMonitoredGroups } from "../../../whatsapp/service";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const denied = await whatsappApiGuard(request);
  if (denied) return denied;
  try { return Response.json({ groups: await listAvailableGroups() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiFailure(error); }
}
export async function PUT(request: Request) {
  const denied = await whatsappApiGuard(request, true);
  if (denied) return denied;
  try {
    const body = await request.json() as { ids?: unknown };
    if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== "string")) {
      return Response.json({ error: "ids harus berupa array ID grup." }, { status: 400 });
    }
    return Response.json({ groups: await saveMonitoredGroups(body.ids) });
  } catch (error) { return apiFailure(error); }
}
