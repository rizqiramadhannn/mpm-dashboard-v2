const CANONICAL_NAME = "ANHAR MALIK / HAMZAH";
const CANONICAL_KEY = "ANHAR MALIK HAMZAH";

function baseNormalize(name: string) {
  return name
    .toUpperCase()
    .replace(/\b(PT|CV|UD|TBK|PERSERO)\b/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSupplierName(name: string) {
  const normalized = baseNormalize(name);
  return normalized === "ANHAR MALIK" || normalized === "HAMZAH" || normalized === CANONICAL_KEY
    ? CANONICAL_KEY
    : normalized;
}

export function canonicalSupplierName(name: string) {
  return normalizeSupplierName(name) === CANONICAL_KEY ? CANONICAL_NAME : name.trim();
}
