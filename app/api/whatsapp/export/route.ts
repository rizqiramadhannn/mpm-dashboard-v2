import { apiFailure, whatsappApiGuard } from "../../../whatsapp/api";
import { buildDateExport } from "../../../whatsapp/export";
import { todayWib } from "../../../whatsapp/service";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const denied = await whatsappApiGuard(request);
  if (denied) return denied;
  const date = new URL(request.url).searchParams.get("date") || todayWib();
  try {
    const { zip } = await buildDateExport(date);
    return new Response(zip as BodyInit, { headers: { "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="whatsapp-' + date + '.zip"',
      "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}
