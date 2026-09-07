// Profile david.svg's 37 subpaths: length, closure, bbox, point count.
import { david } from "../../../core/vocabulary/Sketch/assets/david"
const sp = david.subpaths
let tot = 0
const info = sp.map((f, i) => {
  const n = f.length / 2
  let L = 0
  for (let k = 1; k < n; k++) L += Math.hypot(f[2*k] - f[2*k-2], f[2*k+1] - f[2*k-1])
  const closed = Math.hypot(f[0] - f[2*n-2], f[1] - f[2*n-1]) < 1e-6
  tot += L
  let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9
  for (let k = 0; k < n; k++) { minx=Math.min(minx,f[2*k]); maxx=Math.max(maxx,f[2*k]); miny=Math.min(miny,f[2*k+1]); maxy=Math.max(maxy,f[2*k+1]) }
  return { i, n, L, closed, bbox: [minx,miny,maxx,maxy] }
})
console.log(`subpaths=${sp.length} totalArc=${tot.toFixed(2)}`)
const byLen = [...info].sort((a,b)=>b.L-a.L)
console.log("rank doc  pts    length   share  closed  bbox(x0,y0,x1,y1)")
byLen.forEach((r,rank)=>{
  console.log(`${String(rank).padStart(3)} sp${String(r.i).padStart(2)} ${String(r.n).padStart(4)} ${r.L.toFixed(1).padStart(8)} ${(100*r.L/tot).toFixed(2).padStart(6)}% ${r.closed?"  Z  ":"  -  "} ${r.bbox.map(v=>v.toFixed(0)).join(",")}`)
})
