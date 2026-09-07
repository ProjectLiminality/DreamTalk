/**
 * STAGGERED model.
 *
 * S&T "Single" method with stroke_order draws stroke k over the window
 * [S_k, S_k + L_k/v]. That is the sequential model, already refuted.
 *
 * But the measured frames show many fronts at once. The reconciling model:
 * S&T staggers stroke STARTS by the ordering while letting each stroke run at
 * the same pen speed and OVERLAP its neighbours -- i.e. the "start delay" is
 * a fraction of the previous stroke's duration, not all of it.
 *
 * Sweep: overlap factor phi in [0,1]. phi=1 => strictly sequential (start of
 * k+1 = end of k). phi=0 => everything starts at once.
 *   S_k = phi * sum_{j<k} L_j / v
 * Total span = phi*(TOTAL - L_last)/v + L_last/v, so v is set so the whole
 * drawing still finishes in 2.111s.
 */
import { david } from "../../../core/vocabulary/Sketch/assets/david"
import { readFileSync } from "fs"
const SCALE=2/3, PX=1280/1023, k=SCALE*PX
const START=0.117, DUR=2.111
const measured = JSON.parse(readFileSync("/private/tmp/claude-501/-Users-davidrug-RealDealVault-ProjectLiminality-DreamTalk/6c2f0ce6-31c0-4bce-aacb-bbcca3c5db79/scratchpad/itin2.json","utf8"))

const lens = david.subpaths.map(f=>{
  const n=f.length/2; let L=0
  for(let j=1;j<n;j++) L+=Math.hypot(f[2*j]-f[2*j-2], f[2*j+1]-f[2*j-1])
  return L*k
})

const run = (order:"long_short"|"short_long"|"document", phi:number) => {
  let idx = lens.map((L,i)=>({L,i}))
  if(order==="long_short") idx.sort((a,b)=>b.L-a.L||a.i-b.i)
  if(order==="short_long") idx.sort((a,b)=>a.L-b.L||a.i-b.i)
  // find v so the last stroke ends at DUR
  let pre=0; const starts:number[]=[]
  for(const {L} of idx){ starts.push(phi*pre); pre+=L }
  const spanUnits = Math.max(...idx.map((x,j)=>starts[j]+x.L))
  const v = spanUnits/DUR
  const cov = (t:number) => {
    const o:Record<number,number>={}
    idx.forEach((x,j)=>{ o[x.i] = Math.max(0, Math.min(x.L, (t-START)*v - starts[j])) })
    return o
  }
  let hit=0, tot=0
  for(const fr of measured){
    const c1=cov(fr.t), c0=cov(fr.t-0.2)
    for(const r of fr.runs){
      if(r.px<40) continue
      tot+=r.px
      const lo=c0[r.sp]??0, hi=c1[r.sp]??0
      if(hi<=lo) continue
      const ov=Math.max(0, Math.min(hi,r.a1)-Math.max(lo,r.a0))
      hit += r.px*Math.min(1, ov/Math.max(1,r.a1-r.a0))
    }
  }
  return hit/tot
}
console.log("phi   long_short  short_long  document")
for(const phi of [0,0.05,0.1,0.15,0.2,0.25,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0]){
  console.log(`${phi.toFixed(2)}   ${run("long_short",phi).toFixed(4)}      ${run("short_long",phi).toFixed(4)}      ${run("document",phi).toFixed(4)}`)
}
