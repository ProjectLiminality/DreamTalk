/**
 * Predict the pen's itinerary under a candidate stroke set + long_short order,
 * and score it against the MEASURED itinerary from the reference frames.
 *
 * Model: constant screen-pixel speed, strokes drawn one after another in
 * length-descending order, starting at t=START, at SPEED px/s.
 * For each reference frame interval [t-0.2, t], emit which (subpath, arc)
 * regions the pen covers. Compare to itinerary.json's measured regions.
 */
import { david } from "../../../core/vocabulary/Sketch/assets/david"
import { readFileSync } from "fs"

const SCALE = 2/3, PX = 1280/1023, k = SCALE*PX
const SPEED = 10000, START = 0.117

type P = { x:number; y:number }
type Poly = { src:number[]; pts:P[]; srcArc:{sp:number;a0:number;a1:number;rev:boolean}[] }

// Build polys carrying provenance: which source subpath + arc range each run is.
const build = (tol: number): Poly[] => {
  const polys: Poly[] = david.subpaths.map((f,i) => {
    const n=f.length/2, pts:P[]=[]
    for(let j=0;j<n;j++) pts.push({x:f[2*j]*k, y:f[2*j+1]*k})
    let L=0; for(let j=1;j<n;j++) L+=Math.hypot(pts[j].x-pts[j-1].x, pts[j].y-pts[j-1].y)
    return { src:[i], pts, srcArc:[{sp:i,a0:0,a1:L,rev:false}] }
  })
  const closedQ = (p:Poly)=>Math.hypot(p.pts[0].x-p.pts.at(-1)!.x,p.pts[0].y-p.pts.at(-1)!.y)<0.5
  if (tol <= 0) return polys
  let work = polys.filter(p=>!closedQ(p)); const cl = polys.filter(closedQ)
  const revArc=(s:Poly["srcArc"])=>[...s].reverse().map(r=>({...r,rev:!r.rev}))
  for(;;){
    let best:any=null
    for(let a=0;a<work.length;a++) for(let b=a+1;b<work.length;b++){
      const A=work[a],B=work[b]
      const c=[{d:Math.hypot(A.pts.at(-1)!.x-B.pts[0].x,A.pts.at(-1)!.y-B.pts[0].y),ra:false,rb:false},
               {d:Math.hypot(A.pts.at(-1)!.x-B.pts.at(-1)!.x,A.pts.at(-1)!.y-B.pts.at(-1)!.y),ra:false,rb:true},
               {d:Math.hypot(A.pts[0].x-B.pts[0].x,A.pts[0].y-B.pts[0].y),ra:true,rb:false},
               {d:Math.hypot(A.pts[0].x-B.pts.at(-1)!.x,A.pts[0].y-B.pts.at(-1)!.y),ra:true,rb:true}]
      for(const x of c) if(x.d<tol && (!best||x.d<best.d)) best={...x,a,b}
    }
    if(!best) break
    const A=work[best.a],B=work[best.b]
    const merged:Poly={src:[...A.src,...B.src],
      pts:[...(best.ra?[...A.pts].reverse():A.pts), ...(best.rb?[...B.pts].reverse():B.pts)],
      srcArc:[...(best.ra?revArc(A.srcArc):A.srcArc), ...(best.rb?revArc(B.srcArc):B.srcArc)]}
    work=work.filter((_,i)=>i!==best.a&&i!==best.b); work.push(merged)
  }
  return [...work, ...cl]
}

const plen=(p:P[])=>{let L=0;for(let j=1;j<p.length;j++)L+=Math.hypot(p[j].x-p[j-1].x,p[j].y-p[j-1].y);return L}

const tol = Number(process.argv[2] ?? 3.5)
const strokes = build(tol).map(p=>({...p, L:plen(p.pts)}))
strokes.sort((a,b)=>b.L-a.L)

// Walk the pen: cumulative arc -> (stroke, offset)
const total = strokes.reduce((s,x)=>s+x.L,0)
const measured = JSON.parse(readFileSync("/private/tmp/claude-501/-Users-davidrug-RealDealVault-ProjectLiminality-DreamTalk/6c2f0ce6-31c0-4bce-aacb-bbcca3c5db79/scratchpad/itinerary.json","utf8"))

// map an offset within a stroke back to (source subpath, source arc)
const backmap = (st:any, off:number) => {
  let acc=0
  for(const r of st.srcArc){
    const seg=Math.abs(r.a1-r.a0)
    if(acc+seg>=off){ const u=(off-acc)/(seg||1); const a = r.rev ? r.a1-(r.a1-r.a0)*u : r.a0+(r.a1-r.a0)*u; return {sp:r.sp, a} }
    acc+=seg
  }
  const last=st.srcArc.at(-1); return {sp:last.sp, a:last.rev?last.a0:last.a1}
}

console.log(`TOL=${tol} strokes=${strokes.length} total=${total.toFixed(0)}px duration=${(total/SPEED).toFixed(3)}s`)
console.log(`\n${"frame".padStart(8)} ${"t".padStart(5)}  PREDICTED regions                                  |  MEASURED regions`)
let hitAll=0, nAll=0
for(const m of measured){
  const t1=m.t, t0=t1-0.2
  const s0=Math.max(0,(t0-START)*SPEED), s1=Math.min(total,(t1-START)*SPEED)
  // collect predicted (sp, arc-range)
  const pred: Record<number,[number,number]> = {}
  let acc=0
  for(const st of strokes){
    const a=Math.max(s0,acc), b=Math.min(s1,acc+st.L)
    if(b>a){ const step=Math.max(1,(b-a)/60)
      for(let s=a;s<=b;s+=step){ const {sp,a:sa}=backmap(st,s-acc)
        if(!pred[sp]) pred[sp]=[sa,sa]; else {pred[sp][0]=Math.min(pred[sp][0],sa);pred[sp][1]=Math.max(pred[sp][1],sa)} } }
    acc+=st.L
    if(acc>s1) break
  }
  const predSet=new Set(Object.keys(pred).map(Number))
  const measSet=new Set(m.rows.filter((r:any)=>r.n>=40).map((r:any)=>r.sp))
  const inter=[...measSet].filter(x=>predSet.has(x as number)).length
  hitAll+=inter; nAll+=measSet.size
  const P=Object.entries(pred).map(([sp,[a,b]])=>`sp${sp}:[${a.toFixed(0)}-${b.toFixed(0)}]`).join(" ")
  const M=m.rows.filter((r:any)=>r.n>=40).map((r:any)=>`sp${r.sp}:[${r.a0.toFixed(0)}-${r.a1.toFixed(0)}]`).join(" ")
  console.log(`${m.frame.padStart(8)} ${t1.toFixed(1).padStart(5)}  ${P.padEnd(50)} | ${M}`)
}
console.log(`\nsubpath-set recall: ${hitAll}/${nAll} = ${(100*hitAll/nAll).toFixed(1)}%`)
