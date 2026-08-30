export const migratableSphStatuses = [
  "cek_harga",
  "menunggu_pengiriman",
  "cancel",
] as const;

export type MigratableSphStatus = (typeof migratableSphStatuses)[number];

export type SphMigrationDocument = {
  customerCode: string;
  id: string;
  mm: string;
  paymentTerm: string;
  sphDate: string;
  sphNo: string;
  status: string;
  yy: string;
};

export type SphMigrationUpdate = {
  id: string;
  invoiceNo: string;
  paymentDueDate: string;
  sequence: number;
  sphDate: string;
  sphNo: string;
};

export function normalizedSphMigrationStatus(status: string) {
  const aliases: Record<string, string> = {
    cancelled: "cancel",
    draft: "cek_harga",
    invoiced: "menunggu_pengiriman",
    pending_invoice: "menunggu_pengiriman",
  };

  return aliases[status] ?? status;
}

export function isMigratableSphStatus(status: string) {
  return migratableSphStatuses.includes(
    normalizedSphMigrationStatus(status) as MigratableSphStatus
  );
}

export function invoiceNoFromMigratedSph(sphNo: string) {
  return sphNo.startsWith("SPH") ? `INV${sphNo.slice(3)}` : `INV-${sphNo}`;
}

export function assertValidTargetMonth(targetMonth: string) {
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    throw new Error("Bulan tujuan migrasi tidak valid.");
  }

  const [year, month] = targetMonth.split("-").map(Number);

  if (!Number.isInteger(year) || year < 2000 || year > 2099 || month < 1 || month > 12) {
    throw new Error("Bulan tujuan migrasi tidak valid.");
  }

  return {
    mm: String(month).padStart(2, "0"),
    year,
    yy: String(year).slice(-2),
  };
}

export function addDays(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split("-").map(Number);

  if (!year || !month || !day) {
    return dateValue;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function paymentDueDateFromTerm(sphDate: string, paymentTerm: string) {
  const topMatch = paymentTerm.match(/TOP\s*(\d+)/i);

  if (topMatch) {
    return addDays(sphDate, Number(topMatch[1]));
  }

  return sphDate;
}

function targetDateFromOriginal(originalDate: string, targetMonth: string) {
  const { year } = assertValidTargetMonth(targetMonth);
  const [, month] = targetMonth.split("-").map(Number);
  const day = Number(originalDate.slice(8, 10)) || 1;
  const lastDay = new Date(year, month, 0).getDate();

  return `${targetMonth}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function buildSphMigrationUpdates({
  documents,
  latestSequence,
  targetMonth,
}: {
  documents: SphMigrationDocument[];
  latestSequence: number;
  targetMonth: string;
}): SphMigrationUpdate[] {
  const { mm, yy } = assertValidTargetMonth(targetMonth);

  if (documents.length === 0) {
    throw new Error("Pilih minimal satu SPH untuk dimigrasi.");
  }

  const invalidStatus = documents.find((document) => !isMigratableSphStatus(document.status));

  if (invalidStatus) {
    throw new Error(
      `SPH ${invalidStatus.sphNo} tidak bisa dimigrasi karena statusnya bukan Cek Harga, Menunggu Pengiriman, atau Cancel.`
    );
  }

  const alreadyInTarget = documents.find(
    (document) => document.yy === yy && document.mm === mm
  );

  if (alreadyInTarget) {
    throw new Error(`SPH ${alreadyInTarget.sphNo} sudah berada di bulan tujuan.`);
  }

  return [...documents]
    .sort((a, b) => a.sphDate.localeCompare(b.sphDate) || a.sphNo.localeCompare(b.sphNo))
    .map((document, index) => {
      const sequence = latestSequence + index + 1;
      const sphNo = `SPH${yy}${mm}${String(sequence).padStart(3, "0")}${document.customerCode}`;
      const sphDate = targetDateFromOriginal(document.sphDate, targetMonth);

      return {
        id: document.id,
        invoiceNo: invoiceNoFromMigratedSph(sphNo),
        paymentDueDate: paymentDueDateFromTerm(sphDate, document.paymentTerm),
        sequence,
        sphDate,
        sphNo,
      };
    });
}
