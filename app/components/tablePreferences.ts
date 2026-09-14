export type TableColumn = { id: string; label: string };
export type TablePreferences = Record<string, string[]>;
export const TABLE_COOKIE_PREFIX = "mpm_cols_v1_";

export function tableCookieName(scope: string, tableId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(scope) || !/^[a-zA-Z0-9_-]+$/.test(tableId)) throw new Error("Invalid table preference key");
  return `${TABLE_COOKIE_PREFIX}${scope}_${tableId}`;
}

export function parseHiddenColumns(value: string): string[] {
  if (!value) return [];
  const ids = value.split(".");
  return ids.length <= 100 && ids.every(id => /^c\d{1,3}$/.test(id)) ? [...new Set(ids)] : [];
}

export function validHiddenColumns(hidden: string[], columns: TableColumn[]): string[] {
  const known = new Set(columns.map(column => column.id));
  const filtered = [...new Set(hidden)].filter(id => known.has(id));
  return filtered.length < columns.length ? filtered : [];
}

export function tablePreferenceCookie(scope: string, tableId: string, hidden: string[], secure: boolean) {
  return `${tableCookieName(scope, tableId)}=${hidden.join(".")}; Max-Age=${hidden.length ? 31536000 : 0}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}
