/**
 * Build S&T's stroke set from david's subpaths under the hypothesis:
 *
 *   CONNECT = "Match to World" (OUTLINEMAT_CONNECTIIONZ=3): chain segments
 *   whose ENDPOINTS COINCIDE in world space.
 *   JOIN ANGLE LIMIT = 180 deg: no corner is too sharp to refuse a join.
 *   CLOSE CONNECTION = True: a chain returning to its own start closes.
 *
 * Greedy nearest-endpoint chaining under a tolerance, closed subpaths passed
 * through untouched (they have no free endpoints to offer).
 */
import { david } from "../../../core/vocabulary/Sketch/assets/david"

const SCALE = 2/3, PX = 1280/1023, k = SCALE*PX

type Poly = { src: number[]; pts: {x:number;y:number}[] }
const polys: Poly[] = david.subpaths.map((f, i) => {
  const n = f.length/2, pts = []
  for (let j = 0; j < n; j++) pts.push({ x: f[2*j]*k, y: f[2*j+1]*k })
  return { src: [i], pts }
})
const len = (p: {x:number;y:number}[]) => {
  let L = 0; for (let j = 1; j < p.length; j++) L += Math.hypot(p[j].x-p[j-1].x, p[j].y-p[j-1].y); return L
}
const isClosed = (p: Poly) => Math.hypot(p.pts[0].x-p.pts.at(-1)!.x, p.pts[0].y-p.pts.at(-1)!.y) < 0.5

const TOL = Number(process.argv[2] ?? 3.5)

// Greedy: repeatedly join the closest pair of free endpoints under TOL.
const open = polys.filter(p => !isClosed(p))
const closed = polys.filter(p => isClosed(p))
let work = [...open]
for (;;) {
  let best: any = null
  for (let a = 0; a < work.length; a++) for (let b = a+1; b < work.length; b++) {
    const A = work[a], B = work[b]
    const cand = [
      { d: Math.hypot(A.pts.at(-1)!.x-B.pts[0].x, A.pts.at(-1)!.y-B.pts[0].y), ra:false, rb:false },
      { d: Math.hypot(A.pts.at(-1)!.x-B.pts.at(-1)!.x, A.pts.at(-1)!.y-B.pts.at(-1)!.y), ra:false, rb:true },
      { d: Math.hypot(A.pts[0].x-B.pts[0].x, A.pts[0].y-B.pts[0].y), ra:true, rb:false },
      { d: Math.hypot(A.pts[0].x-B.pts.at(-1)!.x, A.pts[0].y-B.pts.at(-1)!.y), ra:true, rb:true },
    ]
    for (const c of cand) if (c.d < TOL && (!best || c.d < best.d)) best = { ...c, a, b }
  }
  if (!best) break
  const A = work[best.a], B = work[best.b]
  const pa = best.ra ? [...A.pts].reverse() : A.pts
  const pb = best.rb ? [...B.pts].reverse() : B.pts
  const merged: Poly = { src: [...(best.ra?[...A.src].reverse():A.src), ...(best.rb?[...B.src].reverse():B.src)], pts: [...pa, ...pb] }
  work = work.filter((_, i) => i !== best.a && i !== best.b)
  work.push(merged)
}

const all = [...work, ...closed]
const withLen = all.map(p => ({ ...p, L: len(p.pts), closed: isClosed(p) }))
withLen.sort((a,b) => b.L - a.L)
const tot = withLen.reduce((s,p)=>s+p.L, 0)
console.log(`TOL=${TOL}px -> ${all.length} strokes (from 37 subpaths); total ${tot.toFixed(0)}px`)
console.log("rank  len(px)  share  closed  subpaths chained")
withLen.forEach((p, r) => {
  console.log(`${String(r).padStart(4)} ${p.L.toFixed(0).padStart(7)} ${(100*p.L/tot).toFixed(2).padStart(6)}% ${p.closed?"  Z  ":"  -  "}  ${p.src.map(s=>"sp"+s).join(" > ")}`)
})
