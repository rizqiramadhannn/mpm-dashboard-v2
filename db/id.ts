export function randomId() {
  return `id_${crypto.randomUUID().replace(/-/g, "")}`;
}
