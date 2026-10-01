export type PaidInvoice = {
  createdAt: string;
  invoiceDate: string;
  paidAmount: number;
  paymentDueDate: string | null;
  paymentTerm: string;
  processedAt: string | null;
  sphId: string;
  status: string;
  totalAmount: number;
};

export type DeliveryItem = { id: string; quantity: number; sphId: string };
export type DeliveryJourney = {
  customerReceived: boolean;
  customerReceivedAt: string | null;
  quantity: number;
  sphItemId: string;
};

export type PaymentCategory = "COD" | "CBD" | "On Due" | "Overdue";

export type PaymentSummary = Record<PaymentCategory, { amount: number; count: number }>;

function jakartaDate(value: string) {
  const timestamp = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(date);
}

export function completedDeliveryDates(items: DeliveryItem[], journeys: DeliveryJourney[]) {
  const receivedByItem = new Map<string, { quantity: number; lastDate: string }>();
  for (const journey of journeys) {
    if (!journey.customerReceived || !journey.customerReceivedAt) continue;
    const received = receivedByItem.get(journey.sphItemId) ?? { quantity: 0, lastDate: "" };
    received.quantity += journey.quantity;
    const receivedDate = jakartaDate(journey.customerReceivedAt);
    if (receivedDate > received.lastDate) received.lastDate = receivedDate;
    receivedByItem.set(journey.sphItemId, received);
  }

  const itemsBySph = new Map<string, DeliveryItem[]>();
  for (const item of items) {
    const sphItems = itemsBySph.get(item.sphId) ?? [];
    sphItems.push(item);
    itemsBySph.set(item.sphId, sphItems);
  }

  const completed = new Map<string, string>();
  for (const [sphId, sphItems] of itemsBySph) {
    if (sphItems.every((item) =>
      item.quantity > 0 &&
      (receivedByItem.get(item.id)?.quantity ?? 0) >= item.quantity &&
      receivedByItem.get(item.id)?.lastDate
    )) {
      completed.set(sphId, sphItems.reduce((latest, item) => {
        const receivedDate = receivedByItem.get(item.id)!.lastDate;
        return receivedDate > latest ? receivedDate : latest;
      }, ""));
    }
  }
  return completed;
}

function addCalendarDays(startDate: string, days: number) {
  const date = new Date(`${startDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function summarizeMonthlyPayments(
  invoices: PaidInvoice[],
  month: string,
  completedDeliveryBySph = new Map<string, string>()
): PaymentSummary {
  const summary: PaymentSummary = {
    COD: { amount: 0, count: 0 },
    CBD: { amount: 0, count: 0 },
    "On Due": { amount: 0, count: 0 },
    Overdue: { amount: 0, count: 0 },
  };

  for (const invoice of invoices) {
    if (
      invoice.status !== "done" ||
      !invoice.processedAt ||
      invoice.totalAmount <= 0 ||
      invoice.paidAmount < invoice.totalAmount
    ) {
      continue;
    }

    const paidDate = jakartaDate(invoice.processedAt);
    if (!paidDate.startsWith(month)) continue;

    const term = invoice.paymentTerm.trim().toUpperCase();
    let category: PaymentCategory | null = null;

    if (term === "CBD") {
      const createdDate = jakartaDate(invoice.createdAt);
      if (createdDate) category = paidDate <= addCalendarDays(createdDate, 2) ? "CBD" : "Overdue";
    } else if (term === "COD") {
      const completedDate = completedDeliveryBySph.get(invoice.sphId);
      category = completedDate && paidDate > addCalendarDays(completedDate, 2)
        ? "Overdue"
        : "COD";
    } else if (/^TOP\s*\d+(?:\s*HARI)?$/.test(term)) {
      const days = Number(term.match(/\d+/)?.[0]);
      const dueDate = invoice.paymentDueDate?.slice(0, 10) || addCalendarDays(invoice.invoiceDate, days);
      if (dueDate) category = paidDate <= dueDate ? "On Due" : "Overdue";
    }

    if (category) {
      summary[category].amount += Math.min(invoice.paidAmount, invoice.totalAmount);
      summary[category].count += 1;
    }
  }

  return summary;
}
