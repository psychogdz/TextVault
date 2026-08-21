// Generates src/assets/icons/textvault.ico without external tools:
// draws a violet→blue gradient tile with a white "document" glyph as raw RGBA,
// encodes it as a valid PNG (zlib), and wraps sizes 16/32/48/256 into an ICO.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size) {
  const px = (x, y) => {
    // diagonal gradient: violet #8b7cf8 → sky #5d9ce8
    const t = Math.min(1, Math.max(0, (x + y) / (2 * size - 2)));
    const r = Math.round(0x8b + (0x5d - 0x8b) * t);
    const g = Math.round(0x7c + (0x9c - 0x7c) * t);
    const b = Math.round(0xf8 + (0xe8 - 0xf8) * t);
    return [r, g, b];
  };
  const rows = [];
  const m = Math.round(size * 0.20); // glyph vertical inset
  const docL = Math.round(size * 0.30), docR = Math.round(size * 0.70);
  const foldW = Math.round(size * 0.14);
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); // filter byte 0
    for (let x = 0; x < size; x++) {
      let [r, g, b, a] = [...px(x, y), 255];
      const inDoc = x >= docL && x < docR && y >= m && y < size - m;
      const line1 = inDoc && y >= Math.round(size * 0.40) && y < Math.round(size * 0.44);
      const line2 = inDoc && y >= Math.round(size * 0.52) && y < Math.round(size * 0.56);
      if (line1 || line2) { r = g = b = 255; }
      row.writeUInt8(r, 1 + x * 4);
      row.writeUInt8(g, 1 + x * 4 + 1);
      row.writeUInt8(b, 1 + x * 4 + 2);
      row.writeUInt8(a, 1 + x * 4 + 3);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const sizes = [16, 32, 48, 256];
const images = sizes.map((s) => ({ size: s, png: encodePng(s) }));

// ICO container with PNG-embedded entries
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(images.length, 4);

const entries = [];
const blobs = [];
let offset = 6 + 16 * images.length;
for (const img of images) {
  const e = Buffer.alloc(16);
  e[0] = img.size >= 256 ? 0 : img.size;
  e[1] = img.size >= 256 ? 0 : img.size;
  e[2] = 0; e[3] = 0;
  e.writeUInt16LE(1, 4);  // planes
  e.writeUInt16LE(32, 6); // bpp
  e.writeUInt32LE(img.png.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += img.png.length;
  entries.push(e);
  blobs.push(img.png);
}

const out = path.join(__dirname, '..', 'src', 'assets', 'icons', 'textvault.ico');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([header, ...entries, ...blobs]));
console.log('wrote', out, fs.statSync(out).size, 'bytes');
