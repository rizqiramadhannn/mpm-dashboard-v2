export type ItemHistoryStatus = "waiting" | "deal" | "cancel";

export type SearchableItemHistoryRow = {
  customerName: string;
  partName: string;
  partNumber: string;
  sphNo: string;
  status: string;
};

export function itemHistoryStatus(status: string): ItemHistoryStatus {
  const normalized = status.trim().toLowerCase();

  if (normalized === "cancel" || normalized === "cancelled") {
    return "cancel";
  }

  if (
    normalized === "menunggu_pengiriman" ||
    normalized === "proses_pengiriman" ||
    normalized === "selesai" ||
    normalized === "pending_invoice" ||
    normalized === "invoiced"
  ) {
    return "deal";
  }

  return "waiting";
}

export function itemHistoryStatusLabel(status: string) {
  const labels: Record<ItemHistoryStatus, string> = {
    cancel: "Cancel",
    deal: "Deal",
    waiting: "Waiting",
  };

  return labels[itemHistoryStatus(status)];
}

export function itemHistoryMatchesQuery(row: SearchableItemHistoryRow, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    row.partNumber,
    row.partName,
    row.customerName,
    row.sphNo,
    itemHistoryStatusLabel(row.status),
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}
