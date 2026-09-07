// Which subpath ENDPOINTS coincide in screen space? That is what S&T's
// "Connect: Match to World" (OUTLINEMAT_CONNECTIIONZ=3, "only connect
// strokes that touch") chains together, and JOIN_ANGLE_LIMIT=PI means no
// corner is too sharp to join across.
import { david } from "../../../core/vocabulary/Sketch/assets/david"
const SCALE = 2/3, PX = 1280/1023, k = SCALE*PX, CX=640, CY=360
const ends = david.subpaths.map((f,i)=>{
  const n=f.length/2
  const P=(j:number)=>({x:CX+f[2*j]*k, y:CY-f[2*j+1]*k})
  let L=0; for(let j=1;j<n;j++) L+=Math.hypot(f[2*j]-f[2*j-2], f[2*j+1]-f[2*j-1])
  return {i, start:P(0), end:P(n-1), lenPx:L*k, n,
          closed: Math.hypot(f[0]-f[2*n-2], f[1]-f[2*n-1])*k < 0.5}
})
const d=(a:any,b:any)=>Math.hypot(a.x-b.x,a.y-b.y)
console.log("=== subpath endpoints (screen px) ===")
for(const e of ends) console.log(`sp${String(e.i).padStart(2)} len=${e.lenPx.toFixed(0).padStart(5)}px ${e.closed?"CLOSED":"open  "} start=(${e.start.x.toFixed(1)},${e.start.y.toFixed(1)}) end=(${e.end.x.toFixed(1)},${e.end.y.toFixed(1)})`)
console.log("\n=== endpoint pairs within 6px (candidate joins) ===")
const pairs:any[]=[]
for(let a=0;a<ends.length;a++) for(let b=a+1;b<ends.length;b++){
  if(ends[a].closed||ends[b].closed) continue
  for(const [ta,pa] of [["S",ends[a].start],["E",ends[a].end]] as const)
    for(const [tb,pb] of [["S",ends[b].start],["E",ends[b].end]] as const){
      const dd=d(pa,pb); if(dd<6) pairs.push({a:ends[a].i,ta,b:ends[b].i,tb,dd})
    }
}
pairs.sort((x,y)=>x.dd-y.dd)
for(const p of pairs) console.log(`sp${p.a}.${p.ta} <-> sp${p.b}.${p.tb}   d=${p.dd.toFixed(2)}px`)
console.log(`\ntotal candidate joins: ${pairs.length}`)
