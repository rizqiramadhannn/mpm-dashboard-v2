import assert from "node:assert/strict";
import test from "node:test";
import { createBinaryZip } from "../app/components/binaryZip.ts";

function uint16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function uint32(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

test("creates a valid uncompressed ZIP with UTF-8 invoice names", () => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const files = [
    { content: encoder.encode("invoice-one"), name: "INV-001.pdf" },
    { content: encoder.encode("invoice-two"), name: "INV-002-ç.pdf" },
  ];
  const zip = createBinaryZip(files);
  let offset = 0;

  for (const file of files) {
    assert.equal(uint32(zip, offset), 0x04034b50);
    assert.equal(uint16(zip, offset + 6), 0x0800);
    assert.equal(uint16(zip, offset + 8), 0);
    const size = uint32(zip, offset + 18);
    const nameLength = uint16(zip, offset + 26);
    const name = decoder.decode(zip.slice(offset + 30, offset + 30 + nameLength));
    const content = decoder.decode(
      zip.slice(offset + 30 + nameLength, offset + 30 + nameLength + size)
    );

    assert.equal(name, file.name);
    assert.equal(content, decoder.decode(file.content));
    offset += 30 + nameLength + size;
  }

  const endOffset = zip.length - 22;
  assert.equal(uint32(zip, endOffset), 0x06054b50);
  assert.equal(uint16(zip, endOffset + 8), files.length);
  assert.equal(uint16(zip, endOffset + 10), files.length);
});
