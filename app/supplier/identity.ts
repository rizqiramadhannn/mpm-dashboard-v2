const CANONICAL_NAME = "ANHAR MALIK / HAMZAH";
const CANONICAL_KEY = "ANHAR MALIK HAMZAH";
const VICKY_FADLI_NAME = "VICKY / FADLI";
const VICKY_FADLI_KEY = "VICKY FADLI";

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
  if (["ANHAR MALIK", "HAMZAH", CANONICAL_KEY].includes(normalized)) return CANONICAL_KEY;
  if (["VICKY", "FADLI", VICKY_FADLI_KEY].includes(normalized)) return VICKY_FADLI_KEY;
  return normalized;
}

export function canonicalSupplierName(name: string) {
  const normalized = normalizeSupplierName(name);
  if (normalized === CANONICAL_KEY) return CANONICAL_NAME;
  if (normalized === VICKY_FADLI_KEY) return VICKY_FADLI_NAME;
  return name.trim();
}
