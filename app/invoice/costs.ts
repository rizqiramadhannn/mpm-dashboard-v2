import { totalShippingCosts, type ShippingCosts } from "../pengiriman/shipping-costs";

type CostJourney = ShippingCosts & { sphItemId: string; shipmentId: string | null; batchNo: number };

// Shipping costs repeat per item. Count the largest recorded total once per
// SPH/shipment (or legacy batch), then sum the distinct batches.
export function invoiceShippingBySph(items: Array<{ id: string; sphId: string }>, journeys: CostJourney[]) {
  const sphByItem = new Map(items.map(item => [item.id, item.sphId]));
  const batches = new Map<string, Map<string, number>>();
  for (const journey of journeys) {
    const sphId = sphByItem.get(journey.sphItemId);
    if (!sphId) continue;
    const key = journey.shipmentId ?? `batch-${journey.batchNo}`;
    const costs = batches.get(sphId) ?? new Map<string, number>();
    costs.set(key, Math.max(costs.get(key) ?? 0, totalShippingCosts(journey)));
    batches.set(sphId, costs);
  }
  return new Map([...batches].map(([sphId, costs]) =>
    [sphId, [...costs.values()].reduce((sum, cost) => sum + cost, 0)] as const));
}

export function invoiceCosts(invoice: { totalAmount: number; modalAmount: number; feeAmount: number; kodAmount: number }, ongkirAmount: number) {
  const { modalAmount, feeAmount, kodAmount } = invoice;
  const hppAmount = modalAmount + feeAmount + ongkirAmount + kodAmount;
  return { modalAmount, feeAmount, kodAmount, ongkirAmount, hppAmount, marginAmount: invoice.totalAmount - hppAmount };
}
