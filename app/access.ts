type AccessUser = { role: string; username: string };

export function canAccessRestrictedMenus(user: AccessUser | null): boolean {
  return Boolean(user && (user.role === "superadmin" || user.username.toLowerCase() === "guntur"));
}
