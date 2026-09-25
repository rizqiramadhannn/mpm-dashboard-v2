export type DailyMessage = {
  sentAt: string;
  senderId: string;
  senderName: string;
  body: string;
  mediaMime: string;
  mediaStatus: string;
};

const PERIODS = [
  { label: "00.00–05.59", from: 0, to: 6 },
  { label: "06.00–11.59", from: 6, to: 12 },
  { label: "12.00–17.59", from: 12, to: 18 },
  { label: "18.00–23.59", from: 18, to: 24 },
];

function hourWib(iso: string) {
  return new Date(new Date(iso).getTime() + 7 * 3600000).getUTCHours();
}

export function summarizeDailyMessages(items: DailyMessage[]) {
  const periods = PERIODS.map((period) => ({
    label: period.label,
    messages: items.filter((item) => {
      const hour = hourWib(item.sentAt);
      return hour >= period.from && hour < period.to;
    }).length,
  }));
  const images = items.filter((item) => item.mediaMime.startsWith("image/")).length;
  const pdfs = items.filter((item) => item.mediaMime === "application/pdf").length;
  const mediaFailures = items.filter((item) => item.mediaStatus === "unavailable" || item.mediaStatus === "too-large").length;
  const senders = new Map<string, { name: string; messages: number }>();
  for (const item of items) {
    if (!item.senderId) continue;
    const current = senders.get(item.senderId) || { name: item.senderName || item.senderId, messages: 0 };
    current.messages++;
    senders.set(item.senderId, current);
  }
  const topSenders = [...senders.values()].sort((a, b) => b.messages - a.messages).slice(0, 5);
  const texts = items.filter((item) => item.body.trim());
  const count = Math.min(texts.length, 12);
  const excerpts = Array.from({ length: count }, (_, index) => {
    const position = count === 1 ? 0 : Math.round(index * (texts.length - 1) / (count - 1));
    const item = texts[position];
    return { time: item.sentAt, sender: item.senderName, text: item.body.slice(0, 300) };
  });
  const busiest = periods.reduce((best, period) => period.messages > best.messages ? period : best, periods[0]);
  const overview = items.length
    ? String(items.length) + " pesan dari " + String(senders.size) + " pengirim. Aktivitas terbanyak pada " + busiest.label +
      " WIB (" + String(busiest.messages) + " pesan). " + String(images) + " gambar, " + String(pdfs) +
      " PDF, dan " + String(mediaFailures) + " media gagal disimpan."
    : "Belum ada pesan tersimpan untuk tanggal ini.";
  return { messages: items.length, participants: senders.size, images, pdfs, mediaFailures, periods, topSenders, overview, excerpts };
}
