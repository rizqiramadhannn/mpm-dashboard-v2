"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "../../db";
import { financeCategoryOverrides, financeRecords } from "../../db/schema";
import { recordActivityLog, requireUser } from "../auth";
import { FINANCE_CATEGORIES, FinanceCategory } from "./constants";

export async function moveFinanceRecordAction(formData: FormData) {
  const returnTo = safeReturnTo(formData.get("returnTo"));
  const user = await requireUser(returnTo);
  const recordId = String(formData.get("recordId") || "");
  const category = String(formData.get("financeCategory") || "") as FinanceCategory;
  if (!recordId || !FINANCE_CATEGORIES.includes(category)) redirect(returnTo);

  const db = await getDb();
  const record = await db.query.financeRecords.findFirst({ where: eq(financeRecords.id, recordId) });
  if (!record || record.financeCategory === category) redirect(returnTo);

  const direction = category === "Income" ? "income" : "outcome";
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.update(financeRecords).set({ financeCategory: category, direction, updatedAt: now }).where(eq(financeRecords.id, recordId));
    await tx.insert(financeCategoryOverrides).values({
      sourceKey: record.sourceKey,
      financeCategory: category,
      direction,
      updatedByUsername: user.username,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: financeCategoryOverrides.sourceKey,
      set: { financeCategory: category, direction, updatedByUsername: user.username, updatedAt: now },
    });
  });
  await recordActivityLog({
    action: "finance_category_changed",
    actor: user,
    details: { from: record.financeCategory, recordId, sourceKey: record.sourceKey, to: category },
    targetUsername: record.counterparty || record.sourceSheet,
  });
  revalidatePath("/finance");
  redirect(returnTo);
}

function safeReturnTo(value: FormDataEntryValue | null) {
  const path = String(value || "/finance");
  return path === "/finance" || path.startsWith("/finance?") ? path : "/finance";
}
