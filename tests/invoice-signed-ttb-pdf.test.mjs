import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { appendSignedTtb, validateSignedTtb } from "../app/invoice/signed-ttb-pdf.ts";

test("signed TTB PDF pages are appended after the invoice in source order", async () => {
  const invoice = await PDFDocument.create();
  invoice.addPage([595, 842]);
  const ttb = await PDFDocument.create();
  ttb.addPage([612, 792]);
  ttb.addPage([420, 595]);

  const combined = await appendSignedTtb(await invoice.save(), await ttb.save());
  const result = await PDFDocument.load(combined);

  assert.equal(result.getPageCount(), 3);
  assert.deepEqual(result.getPages().map((page) => page.getSize()), [
    { width: 595, height: 842 },
    { width: 612, height: 792 },
    { width: 420, height: 595 },
  ]);
});

test("invalid TTB uploads are rejected", async () => {
  await assert.rejects(validateSignedTtb(new TextEncoder().encode("not a document")),
    /PDF, JPG, atau PNG/);
});

test("a scanned PNG TTB is added as the last page", async () => {
  const invoice = await PDFDocument.create();
  invoice.addPage([595, 842]);
  const png = Uint8Array.from(Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl8YQAAAABJRU5ErkJggg==",
    "base64"
  ));
  const combined = await PDFDocument.load(await appendSignedTtb(await invoice.save(), png));
  assert.equal(combined.getPageCount(), 2);
  assert.deepEqual(combined.getPage(1).getSize(), { width: 595, height: 842 });
});
