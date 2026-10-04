/**
 * scribbles.ts — hand-drawn-looking ink, seeded: what a person draws for a
 * circle, a triangle, a flower… with the wobble, overshoot and gaps of a
 * real pen. Shared by test/sketch-fit.test.ts and the fit bench; not a test.
 */

import type { InkStroke, PenSample } from "../sketch/protocol"

/** mulberry32: a tiny seeded generator, so a scribble is the same every run. */
export const rng = (seed: number) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

type P = { x: number; y: number }
let ids = 0
const stroke = (pts: P[]): InkStroke => ({
  id: `ink-${++ids}`,
  points: pts.map((p, i): PenSample => ({ x: p.x, y: p.y, pressure: 0.5, t: i * 8 })),
})

/** A pen line through `pts`, sampled every ~4 units, with a hand's low-frequency drift. */
const pen = (pts: P[], rand: () => number, wobble: number): P[] => {
  const out: P[] = []
  const f1 = rand() * 6, f2 = rand() * 6
  let s = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!
    const L = Math.hypot(b.x - a.x, b.y - a.y)
    const n = Math.max(1, Math.round(L / 4))
    for (let k = 0; k < n; k++) {
      const u = k / n
      s += L / n
      out.push({
        x: a.x + (b.x - a.x) * u + wobble * Math.sin(s / 37 + f1) + (rand() - 0.5) * 0.8,
        y: a.y + (b.y - a.y) * u + wobble * Math.sin(s / 41 + f2) + (rand() - 0.5) * 0.8,
      })
    }
  }
  out.push(pts[pts.length - 1]!)
  return out
}

/** An ellipse loop (rx, ry, turned `rot`), started anywhere, over/undershooting its close. */
const loop = (cx: number, cy: number, rx: number, ry: number, rot: number, rand: () => number, wobble = 0.03): P[] => {
  const start = rand() * Math.PI * 2
  const sweep = Math.PI * 2 * (1 + (rand() - 0.4) * 0.12)
  const ph = rand() * 6
  const pts: P[] = []
  const n = 64
  for (let i = 0; i <= n; i++) {
    const t = start + (i / n) * sweep
    const k = 1 + wobble * Math.sin(3 * t + ph) + (rand() - 0.5) * wobble * 0.5
    const x = rx * k * Math.cos(t), y = ry * k * Math.sin(t)
    pts.push({ x: cx + x * Math.cos(rot) - y * Math.sin(rot), y: cy + x * Math.sin(rot) + y * Math.cos(rot) })
  }
  return pen(pts, rand, 0.6)
}

export const wobblyCircle = (seed: number, cx = 600, cy = 500, r = 120): InkStroke[] => {
  const rand = rng(seed)
  return [stroke(loop(cx, cy, r * (1 + (rand() - 0.5) * 0.1), r, rand() * 3, rand, 0.04))]
}

/** David's searching way: several overlapping passes whose average is the circle. */
export const searchedCircle = (seed: number, cx = 600, cy = 500, r = 120): InkStroke[] => {
  const rand = rng(seed)
  return Array.from({ length: 4 }, () =>
    stroke(loop(cx + (rand() - 0.5) * r * 0.08, cy + (rand() - 0.5) * r * 0.08, r * (1 + (rand() - 0.5) * 0.1), r * (1 + (rand() - 0.5) * 0.1), rand() * 3, rand)),
  )
}

/** A closed polygon drawn as one stroke (corners overshot) or one stroke per side. */
const polygon = (corners: P[], rand: () => number, perSide: boolean, size: number): InkStroke[] => {
  const j = (p: P): P => ({ x: p.x + (rand() - 0.5) * size * 0.06, y: p.y + (rand() - 0.5) * size * 0.06 })
  const cs = corners.map(j)
  if (!perSide) return [stroke(pen([...cs, cs[0]!, { x: cs[0]!.x + (cs[1]!.x - cs[0]!.x) * 0.06, y: cs[0]!.y + (cs[1]!.y - cs[0]!.y) * 0.06 }], rand, size * 0.012))]
  return cs.map((a, i) => {
    const b = cs[(i + 1) % cs.length]!
    const over = 0.05 + rand() * 0.05
    return stroke(pen([{ x: a.x - (b.x - a.x) * over, y: a.y - (b.y - a.y) * over }, { x: b.x + (b.x - a.x) * over, y: b.y + (b.y - a.y) * over }], rand, size * 0.01))
  })
}

export const roughTriangle = (seed: number, cx = 600, cy = 500, r = 130): InkStroke[] => {
  const rand = rng(seed)
  const rot = -Math.PI / 2 + (rand() - 0.5) * 0.3
  const corners = [0, 1, 2].map((k) => ({ x: cx + r * Math.cos(rot + (k * 2 * Math.PI) / 3), y: cy + r * Math.sin(rot + (k * 2 * Math.PI) / 3) }))
  return polygon(corners, rand, rand() < 0.5, r)
}

export const roughSquare = (seed: number, cx = 600, cy = 500, size = 220): InkStroke[] => {
  const rand = rng(seed)
  const rot = (rand() - 0.5) * 0.3
  const h = size / 2
  const corners = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, y]) => ({ x: cx + x! * Math.cos(rot) - y! * Math.sin(rot), y: cy + x! * Math.sin(rot) + y! * Math.cos(rot) }))
  return polygon(corners, rand, rand() < 0.5, size)
}

/** Seven equal wobbly circles on the hexagonal lattice. */
export const roughFlower = (seed: number, cx = 700, cy = 600, r = 80): InkStroke[] => {
  const rand = rng(seed)
  const rot = rand() * 0.4
  const centres = [{ x: cx, y: cy }, ...[0, 1, 2, 3, 4, 5].map((k) => ({ x: cx + r * Math.cos(rot + (k * Math.PI) / 3), y: cy + r * Math.sin(rot + (k * Math.PI) / 3) }))]
  return centres.map((c) => stroke(loop(c.x + (rand() - 0.5) * r * 0.1, c.y + (rand() - 0.5) * r * 0.1, r * (1 + (rand() - 0.5) * 0.12), r, rand() * 3, rand)))
}

/** The schoolbook cube: a front square, the back one shifted up-right, four edges joining them. */
export const roughCube = (seed: number, cx = 700, cy = 600, size = 200): InkStroke[] => {
  const rand = rng(seed)
  const h = size / 2
  const d = { x: size * (0.35 + rand() * 0.1), y: -size * (0.3 + rand() * 0.1) }
  const front = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, y]) => ({ x: cx - d.x / 2 + x!, y: cy - d.y / 2 + y! }))
  const back = front.map((p) => ({ x: p.x + d.x, y: p.y + d.y }))
  const ink = [...polygon(front, rand, false, size), ...polygon(back, rand, false, size)]
  for (let k = 0; k < 4; k++) ink.push(stroke(pen([front[k]!, back[k]!], rand, size * 0.008)))
  return ink
}

/** Two cap ellipses and the two sides joining them. */
export const roughCylinder = (seed: number, cx = 900, cy = 600, radius = 70, height = 220): InkStroke[] => {
  const rand = rng(seed)
  const minor = radius * (0.25 + rand() * 0.15)
  const top = cy - height / 2, bottom = cy + height / 2
  return [
    stroke(loop(cx, top, radius, minor, (rand() - 0.5) * 0.06, rand)),
    stroke(loop(cx, bottom, radius, minor, (rand() - 0.5) * 0.06, rand)),
    stroke(pen([{ x: cx - radius, y: top }, { x: cx - radius, y: bottom }], rand, 1.5)),
    stroke(pen([{ x: cx + radius, y: top }, { x: cx + radius, y: bottom }], rand, 1.5)),
  ]
}

/** A MindVirus as a hand draws one: a box, an eye on its face, and a wavy tail off its left. */
export const roughMindVirus = (seed: number, x = 900, y = 600, size = 160): { ink: InkStroke[]; tail: P[] } => {
  const rand = rng(seed)
  const h = size / 2
  const box = polygon([{ x: x - h, y: y - h }, { x: x + h, y: y - h }, { x: x + h, y: y + h }, { x: x - h, y: y + h }], rand, false, size)
  const eye = stroke(loop(x, y, size * 0.22, size * 0.22, 0, rand))
  const tail: P[] = []
  for (let i = 0; i <= 12; i++) tail.push({ x: x - h - size * 2.2 * (1 - i / 12), y: y + size * 0.25 * Math.sin(i * 1.1) })
  return { ink: [...box, eye, stroke(pen(tail, rand, 2))], tail }
}
