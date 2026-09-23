import assert from "node:assert/strict";
import test from "node:test";

import { createSphPdf } from "../app/sph/download/[id]/route.ts";

const document = {
  additionalInfo: "",
  amountInWords: "Satu juta rupiah",
  customerDetailLine1: "Alamat baris pertama",
  customerDetailLine2: "Alamat baris kedua",
  customerDetailLine3: "Alamat baris ketiga",
  customerName: "Customer PDF Test",
  deliveryDate: "2026-09-30",
  etaDate: "2026-10-01",
  franco: "Bahodopi",
  paymentTerm: "CBD",
  pdfSphDate: null,
  sphDate: "2026-09-23",
  sphNo: "SPH2609054QJM",
  staticSnapshotJson: null,
  totalAmount: 1_000_000,
};

function items(count) {
  return Array.from({ length: count }, (_, index) => ({
    lineNo: index + 1,
    partName: `Item regression pagination ${index + 1}`,
    partNumber: `PART-${String(index + 1).padStart(2, "0")}`,
    quantity: 1,
    totalPrice: 100_000,
    unitPrice: 100_000,
    uom: "PCS",
  }));
}

function pdfText(count) {
  return Buffer.from(createSphPdf(document, items(count))).toString("latin1");
}

test("SPH PDF keeps a short item list on one page", () => {
  const pdf = pdfText(2);
  assert.match(pdf, /\/Type \/Pages \/Kids \[[^\]]+\] \/Count 1/);
  assert.match(pdf, /Halaman 1 dari 1/);
});

test("SPH PDF paginates long item lists and keeps the final section", () => {
  const pdf = pdfText(10);
  assert.match(pdf, /\/Type \/Pages \/Kids \[[^\]]+\] \/Count 2/);
  assert.match(pdf, /LANJUTAN/);
  assert.match(pdf, /PART-10/);
  assert.match(pdf, /Rekening Pembayaran/);
  assert.match(pdf, /Halaman 2 dari 2/);
  assert.equal((pdf.match(/Hormat Kami/g) ?? []).length, 1);
});
