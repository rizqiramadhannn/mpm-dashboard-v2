import { apiFailure, whatsappApiGuard } from "../../../whatsapp/api";
import { dailyData, syncWibDate, todayWib } from "../../../whatsapp/service";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const denied = await whatsappApiGuard(request);
  if (denied) return denied;
  const date = new URL(request.url).searchParams.get("date") || todayWib();
  try { return Response.json(await dailyData(date), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiFailure(error); }
}
export async function POST(request: Request) {
  const denied = await whatsappApiGuard(request, true);
  if (denied) return denied;
  try {
    const body = await request.json() as { date?: string };
    if (typeof body.date !== "string") return Response.json({ error: "Tanggal wajib diisi." }, { status: 400 });
    return Response.json({ syncs: await syncWibDate(body.date), data: await dailyData(body.date) });
  } catch (error) { return apiFailure(error); }
}
