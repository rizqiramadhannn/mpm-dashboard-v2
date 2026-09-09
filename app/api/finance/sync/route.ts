import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, gte, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { randomId } from "../../../../db/id";
import { financeRecords } from "../../../../db/schema";
import { FINANCE_CATEGORIES } from "../../../finance/constants";

type IncomingRecord = {
  sourceKey: string; sourceSheet: string; sourceRow: number;
  transactionDate: string; transactionTime?: string; sourceDocument?: string;
  description?: string; counterparty?: string; sourceCategory?: string;
  direction: "income" | "outcome"; financeCategory: string; amount: number;
  sourceStatus?: string; notes?: string;
};
type SyncBody = { spreadsheetId: string; periodStart: string; periodEnd: string; records: IncomingRecord[] };

export async function POST(request: Request) {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: SyncBody;
  try { body = (await request.json()) as SyncBody; }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const error = validateBody(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const db = await getDb();
  const batchId = randomId();
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.delete(financeRecords).where(and(
      eq(financeRecords.sourceSpreadsheetId, body.spreadsheetId),
      gte(financeRecords.transactionDate, body.periodStart),
      lte(financeRecords.transactionDate, body.periodEnd)
    ));
    for (let offset = 0; offset < body.records.length; offset += 250) {
      await tx.insert(financeRecords).values(body.records.slice(offset, offset + 250).map((record) => ({
        ...record, id: randomId(), amount: Math.round(record.amount), importBatchId: batchId,
        sourceSpreadsheetId: body.spreadsheetId, transactionTime: record.transactionTime || "",
        sourceDocument: record.sourceDocument || "", description: record.description || "",
        counterparty: record.counterparty || "", sourceCategory: record.sourceCategory || "",
        sourceStatus: record.sourceStatus || "", notes: record.notes || "", createdAt: now, updatedAt: now,
      })));
    }
  });
  const income = body.records.filter((r) => r.direction === "income").reduce((s, r) => s + r.amount, 0);
  const outcome = body.records.filter((r) => r.direction === "outcome").reduce((s, r) => s + r.amount, 0);
  return NextResponse.json({ batchId, imported: body.records.length, income, outcome, net: income - outcome,
    periodStart: body.periodStart, periodEnd: body.periodEnd });
}

function isAuthorized(header: string | null) {
  const databaseToken = process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN;
  const supplied = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!supplied) return false;
  const candidates = [
    process.env.FINANCE_SYNC_TOKEN,
    databaseToken ? deriveSyncToken(databaseToken) : "",
  ].filter(Boolean) as string[];
  return candidates.some((expected) => {
    const a = Buffer.from(expected); const b = Buffer.from(supplied);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

function deriveSyncToken(databaseToken: string) {
  return createHash("sha256").update(`mpm-finance-sync:v1:${databaseToken}`).digest("hex");
}

function validateBody(body: SyncBody) {
  if (!body || typeof body !== "object") return "Body is required";
  if (!body.spreadsheetId?.trim()) return "spreadsheetId is required";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.periodStart || "")) return "Invalid periodStart";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.periodEnd || "") || body.periodStart > body.periodEnd) return "Invalid periodEnd";
  if (!Array.isArray(body.records) || body.records.length > 5000) return "records must contain at most 5000 items";
  const keys = new Set<string>();
  for (const [i, record] of body.records.entries()) {
    if (!record.sourceKey || keys.has(record.sourceKey)) return `Invalid or duplicate sourceKey at record ${i}`;
    keys.add(record.sourceKey);
    if (!record.sourceSheet || !Number.isInteger(record.sourceRow) || record.sourceRow < 1) return `Invalid source at record ${i}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.transactionDate) || record.transactionDate < body.periodStart || record.transactionDate > body.periodEnd) return `Invalid date at record ${i}`;
    if (record.direction !== "income" && record.direction !== "outcome") return `Invalid direction at record ${i}`;
    if (!FINANCE_CATEGORIES.includes(record.financeCategory as never)) return `Invalid category at record ${i}`;
    if (!Number.isFinite(record.amount) || record.amount <= 0) return `Invalid amount at record ${i}`;
    if ((record.direction === "income") !== (record.financeCategory === "Income")) return `Direction/category mismatch at record ${i}`;
  }
  return "";
}
