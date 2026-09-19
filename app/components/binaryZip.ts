type BinaryZipFile = {
  content: Uint8Array;
  name: string;
};

function crc32(bytes: Uint8Array) {
  let crc = -1;

  for (const byte of bytes) {
    crc ^= byte;

    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ -1) >>> 0;
}

function writeUint16(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

export function createBinaryZip(files: BinaryZipFile[]) {
  if (files.length > 0xffff) {
    throw new Error("Jumlah file ZIP melebihi batas.");
  }

  const encoder = new TextEncoder();
  const entries = files.map((file) => {
    const name = encoder.encode(file.name);

    if (name.length > 0xffff || file.content.length > 0xffffffff) {
      throw new Error(`File ${file.name} terlalu besar untuk ZIP.`);
    }

    return { checksum: crc32(file.content), content: file.content, name, offset: 0 };
  });
  const localSize = entries.reduce(
    (total, entry) => total + 30 + entry.name.length + entry.content.length,
    0
  );
  const centralSize = entries.reduce(
    (total, entry) => total + 46 + entry.name.length,
    0
  );
  const output = new Uint8Array(localSize + centralSize + 22);
  let offset = 0;

  for (const entry of entries) {
    entry.offset = offset;
    writeUint32(output, offset, 0x04034b50);
    writeUint16(output, offset + 4, 20);
    writeUint16(output, offset + 6, 0x0800);
    writeUint16(output, offset + 8, 0);
    writeUint16(output, offset + 10, 0);
    writeUint16(output, offset + 12, 0);
    writeUint32(output, offset + 14, entry.checksum);
    writeUint32(output, offset + 18, entry.content.length);
    writeUint32(output, offset + 22, entry.content.length);
    writeUint16(output, offset + 26, entry.name.length);
    writeUint16(output, offset + 28, 0);
    output.set(entry.name, offset + 30);
    output.set(entry.content, offset + 30 + entry.name.length);
    offset += 30 + entry.name.length + entry.content.length;
  }

  const centralOffset = offset;

  for (const entry of entries) {
    writeUint32(output, offset, 0x02014b50);
    writeUint16(output, offset + 4, 20);
    writeUint16(output, offset + 6, 20);
    writeUint16(output, offset + 8, 0x0800);
    writeUint16(output, offset + 10, 0);
    writeUint16(output, offset + 12, 0);
    writeUint16(output, offset + 14, 0);
    writeUint32(output, offset + 16, entry.checksum);
    writeUint32(output, offset + 20, entry.content.length);
    writeUint32(output, offset + 24, entry.content.length);
    writeUint16(output, offset + 28, entry.name.length);
    writeUint16(output, offset + 30, 0);
    writeUint16(output, offset + 32, 0);
    writeUint16(output, offset + 34, 0);
    writeUint16(output, offset + 36, 0);
    writeUint32(output, offset + 38, 0);
    writeUint32(output, offset + 42, entry.offset);
    output.set(entry.name, offset + 46);
    offset += 46 + entry.name.length;
  }

  writeUint32(output, offset, 0x06054b50);
  writeUint16(output, offset + 4, 0);
  writeUint16(output, offset + 6, 0);
  writeUint16(output, offset + 8, entries.length);
  writeUint16(output, offset + 10, entries.length);
  writeUint32(output, offset + 12, centralSize);
  writeUint32(output, offset + 16, centralOffset);
  writeUint16(output, offset + 20, 0);

  return output;
}
