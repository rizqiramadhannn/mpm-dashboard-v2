import { eq } from "drizzle-orm";
import type { getDb } from "../../../db";
import { suppliers, appAdminAuditLogs } from "../../../db/schema";
import { ManualNoteError } from "./model";
import { canonicalSupplierName, normalizeSupplierName } from "../identity";

export async function createApiSupplier(db: Awaited<ReturnType<typeof getDb>>, value: unknown, ipAddress: string) {
  const inputName = value && typeof value === "object" && "name" in value && typeof value.name === "string" ? value.name.trim() : "";
  const name = canonicalSupplierName(inputName);
  const normalizedName = normalizeSupplierName(inputName);
  if (!name || name.length > 200 || !normalizedName) throw new ManualNoteError("Nama supplier wajib valid, maksimal 200 karakter.");
  return db.transaction(async tx => {
    const [inserted] = await tx.insert(suppliers).values({ name, normalizedName }).onConflictDoNothing({ target: suppliers.normalizedName }).returning({ id: suppliers.id, name: suppliers.name });
    if (inserted) {
      await tx.insert(appAdminAuditLogs).values({ actorUserId: null, actorUsername: "supplier-notes-api", action: "supplier_created", ipAddress, detailsJson: { supplierId: inserted.id, name: inserted.name } });
      return { ...inserted, reused: false };
    }
    const [existing] = await tx.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.normalizedName, normalizedName)).limit(1);
    if (!existing) throw new Error("Supplier conflict could not be reconciled");
    return { ...existing, reused: true };
  });
}
