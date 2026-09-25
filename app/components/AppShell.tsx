import type { ReactNode } from "react";
import { getCurrentUser } from "../auth";
import { canAccessRestrictedMenus } from "../access";
import { AppShellClient } from "./AppShellClient";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { TABLE_COOKIE_PREFIX, parseHiddenColumns } from "./tablePreferences";
import type { TablePreferences } from "./tablePreferences";
import { CONFIGURABLE_TABLE_IDS } from "./tableDefinitions";

export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const tablePreferenceScope = createHash("sha256").update(user?.id ?? "anonymous").digest("hex").slice(0, 16);
  const prefix = `${TABLE_COOKIE_PREFIX}${tablePreferenceScope}_`;
  const tablePreferences: TablePreferences = {};
  for (const cookie of (await cookies()).getAll()) {
    if (cookie.name.startsWith(prefix)) {
      const tableId = cookie.name.slice(prefix.length);
      if (CONFIGURABLE_TABLE_IDS.includes(tableId)) tablePreferences[tableId] = parseHiddenColumns(cookie.value);
    }
  }
  return <AppShellClient canAccessRestrictedMenus={canAccessRestrictedMenus(user)} isSuperadmin={user?.role === "superadmin"} tablePreferenceScope={tablePreferenceScope} tablePreferences={tablePreferences}>{children}</AppShellClient>;
}
