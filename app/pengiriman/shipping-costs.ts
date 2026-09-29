export const shippingCostFields = [
  { key: "handlingCost", label: "Handling" },
  { key: "airShippingCost", label: "Ongkir udara" },
  { key: "seaShippingCost", label: "Ongkir laut" },
  { key: "landShippingCost", label: "Ongkir darat" },
  { key: "maximShippingCost", label: "Ongkir maxim" },
  { key: "otherShippingCost", label: "Biaya lain-lain" },
] as const;

export type ShippingCosts = Record<(typeof shippingCostFields)[number]["key"], number>;

export function parseShippingCosts(formData: FormData): ShippingCosts {
  return Object.fromEntries(
    shippingCostFields.map(({ key, label }) => {
      const raw = formData.get(key);
      const value = raw === null || raw === "" ? 0 : Number(raw);
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`${label} harus berupa angka bulat nonnegatif.`);
      }
      return [key, value];
    })
  ) as ShippingCosts;
}

export function totalShippingCosts(costs: ShippingCosts): number {
  const total = shippingCostFields.reduce((sum, { key }) => sum + costs[key], 0);
  if (!Number.isSafeInteger(total)) {
    throw new Error("Total biaya pengiriman terlalu besar.");
  }
  return total;
}
