import { timingSafeEqual } from "node:crypto";
import { apiFailure } from "../../../whatsapp/api";
import { pruneWhatsAppCache, syncWibDate, todayWib } from "../../../whatsapp/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function run(request: Request) {
  const expected = process.env.CRON_SECRET || process.env.WHATSAPP_CRON_TOKEN || "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const cutoff = await pruneWhatsAppCache();
    const yesterday = todayWib(new Date(Date.now() - 86400000));
    const syncs = await syncWibDate(yesterday);
    return Response.json({ cutoff, date: yesterday, syncs });
  } catch (error) { return apiFailure(error); }
}
export const GET = run;
export const POST = run;
