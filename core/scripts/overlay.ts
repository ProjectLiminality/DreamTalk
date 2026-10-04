/**
 * overlay.ts — the recognizer's second look: the ink in black with the
 * reading it produced drawn over it in red, as a PNG a vision model can
 * compare at a glance ("does the red sit on the black?").
 *
 * Rendered here, on the daemon, from geometry alone — the ink's polylines
 * and the symbol's flattened outline (sketch/fit.ts symbolOutline), both in
 * page units — by a tiny rasteriser (round pens stamped along each
 * segment) and a minimal PNG encoder (RGB, filter 0, zlib). No canvas, no
 * image library. Pure; the tests decode what it writes.
 */

import { deflateSync } from "node:zlib"
import type { InkStroke } from "../sketch/protocol"

type Pt = { x: number; y: number }

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

const crc32 = (bytes: Uint8Array): number => {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const out = new Uint8Array(12 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** RGB pixels (w·h·3) → PNG bytes. */
export const encodePng = (rgb: Uint8Array, w: number, h: number): Uint8Array => {
  const raw = new Uint8Array(h * (1 + w * 3))
  for (let y = 0; y < h; y++) raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1)
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, w)
  dv.setUint32(4, h)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolour
  const parts = [
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array()),
  ]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) (out.set(p, o), (o += p.length))
  return out
}

/**
 * The ink (black) and the reading (red) inside `crop` (page units), the
 * image's longer side `maxSide` px. Base64 PNG.
 */
export const overlayPng = (
  strokes: readonly InkStroke[],
  outline: readonly (readonly Pt[])[],
  crop: { x: number; y: number; w: number; h: number },
  maxSide = 512,
): string => {
  const k = maxSide / Math.max(crop.w, crop.h)
  const w = Math.max(1, Math.round(crop.w * k))
  const h = Math.max(1, Math.round(crop.h * k))
  const rgb = new Uint8Array(w * h * 3).fill(255)
  const stamp = (cx: number, cy: number, r: number, c: readonly [number, number, number]) => {
    const r2 = r * r
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue
        const i = (y * w + x) * 3
        rgb[i] = c[0]
        rgb[i + 1] = c[1]
        rgb[i + 2] = c[2]
      }
  }
  const draw = (pts: readonly Pt[], r: number, c: readonly [number, number, number]) => {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)]!, b = pts[i]!
      const ax = (a.x - crop.x) * k, ay = (a.y - crop.y) * k
      const bx = (b.x - crop.x) * k, by = (b.y - crop.y) * k
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / Math.max(0.5, r * 0.6)))
      for (let s = 0; s <= n; s++) stamp(ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n, r, c)
    }
  }
  for (const s of strokes) draw(s.points, 1.6, [0, 0, 0])
  for (const pts of outline) draw(pts, 1.4, [230, 30, 30])
  return Buffer.from(encodePng(rgb, w, h)).toString("base64")
}
