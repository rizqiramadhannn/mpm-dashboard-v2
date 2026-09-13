import type { ReactNode } from "react";
import { getCurrentUser } from "../auth";
import { canAccessRestrictedMenus } from "../access";
import { AppShellClient } from "./AppShellClient";

export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return <AppShellClient canAccessRestrictedMenus={canAccessRestrictedMenus(user)}>{children}</AppShellClient>;
}
