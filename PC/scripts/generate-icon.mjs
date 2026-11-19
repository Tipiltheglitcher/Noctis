import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.resolve(__dirname, '../build');
fs.mkdirSync(buildDir, { recursive: true });

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp(v, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function sdRoundedBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// Signed distance to capsule segment AB with radius r
function sdCapsule(px, py, ax, ay, bx, by, r) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h) - r;
}

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

function samplePixel(u, v) {
  const bgDist = sdRoundedBox(u, v, 0.9, 0.9, 0.36);
  const bgAlpha = 1 - smoothstep(-0.015, 0.015, bgDist);
  if (bgAlpha <= 0.001) return [0, 0, 0, 0];

  // Deep obsidian backdrop with subtle luminous indigo/violet nocturnal aurora
  const glow1 = Math.exp(-((u - 0.34) ** 2 + (v + 0.38) ** 2) * 2.1);
  const glow2 = Math.exp(-((u + 0.42) ** 2 + (v - 0.44) ** 2) * 2.8);

  let r = 9 + 28 * glow1 + 10 * glow2;
  let g = 9 + 18 * glow1 + 14 * glow2;
  let b = 14 + 78 * glow1 + 36 * glow2;

  // Rim light along squircle border
  const rim = Math.exp(-(((bgDist + 0.025) / 0.022) ** 2));
  const topBias = clamp(0.68 - v * 0.45, 0.15, 1.0);
  r += rim * 52 * topBias;
  g += rim * 50 * topBias;
  b += rim * 82 * topBias;

  // Sleek geometric "N" glyph (left vertical, luminous diagonal, right vertical)
  const leftBar = sdCapsule(u, v, -0.31, -0.38, -0.31, 0.38, 0.095);
  const rightBar = sdCapsule(u, v, 0.31, -0.38, 0.31, 0.38, 0.095);
  const diagBar = sdCapsule(u, v, -0.29, -0.36, 0.29, 0.36, 0.092);

  // Drop shadow behind N
  const shadowDist = Math.min(
    sdCapsule(u, v - 0.04, -0.31, -0.38, -0.31, 0.38, 0.095),
    sdCapsule(u, v - 0.04, 0.31, -0.38, 0.31, 0.38, 0.095),
    sdCapsule(u, v - 0.04, -0.29, -0.36, 0.29, 0.36, 0.092)
  );
  const shadow = 1 - smoothstep(-0.04, 0.15, shadowDist);
  r *= 1 - shadow * 0.48;
  g *= 1 - shadow * 0.48;
  b *= 1 - shadow * 0.48;

  // White pillars
  const pillarsDist = Math.min(leftBar, rightBar);
  const pillarsMask = 1 - smoothstep(-0.014, 0.014, pillarsDist);
  if (pillarsMask > 0) {
    const shade = clamp(1 - (v + 0.45) * 0.14, 0.85, 1);
    r = r * (1 - pillarsMask) + 246 * shade * pillarsMask;
    g = g * (1 - pillarsMask) + 246 * shade * pillarsMask;
    b = b * (1 - pillarsMask) + 255 * shade * pillarsMask;
  }

  // Luminous violet-indigo diagonal bar (signature Noctis accent)
  const diagGlow = Math.exp(-Math.max(diagBar, 0) * 7.0) * 0.35;
  r += diagGlow * 139;
  g += diagGlow * 116;
  b += diagGlow * 255;

  const diagMask = 1 - smoothstep(-0.014, 0.014, diagBar);
  if (diagMask > 0) {
    const t = clamp((u + 0.35) / 0.7, 0, 1);
    const dr = 165 * (1 - t) + 124 * t;
    const dg = 148 * (1 - t) + 104 * t;
    const db = 255;
    r = r * (1 - diagMask) + dr * diagMask;
    g = g * (1 - diagMask) + dg * diagMask;
    b = b * (1 - diagMask) + db * diagMask;
  }

  // Subtle crescent / star dot accent top-right
  const starDist = sdCircle(u, v, 0.48, -0.48, 0.055);
  const starMask = 1 - smoothstep(-0.012, 0.012, starDist);
  if (starMask > 0) {
    r = r * (1 - starMask) + 180 * starMask;
    g = g * (1 - starMask) + 165 * starMask;
    b = b * (1 - starMask) + 255 * starMask;
  }

  return [
    Math.round(clamp(r, 0, 255)),
    Math.round(clamp(g, 0, 255)),
    Math.round(clamp(b, 0, 255)),
    Math.round(clamp(bgAlpha * 255, 0, 255)),
  ];
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const ss = 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rr = 0, gg = 0, bb = 0, aa = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const u = ((x + (sx + 0.5) / ss) / size) * 2 - 1;
          const v = ((y + (sy + 0.5) / ss) / size) * 2 - 1;
          const [r, g, b, a] = samplePixel(u, v);
          rr += r * a;
          gg += g * a;
          bb += b * a;
          aa += a;
        }
      }
      const idx = (y * size + x) * 4;
      const samples = ss * ss;
      rgba[idx] = aa > 0 ? Math.round(rr / aa) : 0;
      rgba[idx + 1] = aa > 0 ? Math.round(gg / aa) : 0;
      rgba[idx + 2] = aa > 0 ? Math.round(bb / aa) : 0;
      rgba[idx + 3] = Math.round(aa / samples);
    }
  }
  return encodePNG(size, size, rgba);
}

function buildICO(pngEntries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngEntries.length, 4);

  const dirEntries = [];
  let offset = 6 + pngEntries.length * 16;

  for (const { size, png } of pngEntries) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngEntries.map((e) => e.png)]);
}

const sizes = [16, 32, 48, 64, 128, 256];
const entries = sizes.map((size) => ({ size, png: renderIcon(size) }));
const png512 = renderIcon(512);

fs.writeFileSync(path.join(buildDir, 'icon.png'), png512);
fs.writeFileSync(path.join(buildDir, 'icon.ico'), buildICO(entries));
console.log('[generate-icon] Created Noctis build/icon.png and build/icon.ico');
