/**
 * Test the "ALL strokes advance together" model against the measured itinerary.
 *
 * S&T's OUTLINEMAT_ANIMATE_STROKE_METHOD: 0="Single" (one stroke at a time),
 * 1="All" (every stroke advances simultaneously). pydeation passes "single",
 * but the measured frames show up to 15 separate ink fronts growing at once.
 *
 * Model A (all, proportional): every stroke's completion fraction advances
 *   together; a stroke of length L inks L*du per step => long strokes ink
 *   faster. Total rate constant.
 * Model B (all, equal-rate): every stroke advances at the SAME px/s; short
 *   strokes finish early, long ones keep going.
 *
 * Score = pixel-weighted overlap of predicted vs measured arc intervals.
 */
import { david } from "../../../core/vocabulary/Sketch/assets/david"
import { readFileSync } from "fs"
const SCALE=2/3, PX=1280/1023, k=SCALE*PX
const measured = JSON.parse(readFileSync("/private/tmp/claude-501/-Users-davidrug-RealDealVault-ProjectLiminality-DreamTalk/6c2f0ce6-31c0-4bce-aacb-bbcca3c5db79/scratchpad/itin2.json","utf8"))

const lens = david.subpaths.map(f=>{
  const n=f.length/2; let L=0
  for(let j=1;j<n;j++) L+=Math.hypot(f[2*j]-f[2*j-2], f[2*j+1]-f[2*j-1])
  return L*k
})
const TOTAL = lens.reduce((a,b)=>a+b,0)

const scoreModel = (name:string, covered:(t:number)=>Record<number,[number,number]>) => {
  let hit=0, tot=0
  const detail:string[]=[]
  for(const fr of measured){
    const c1=covered(fr.t), c0=covered(fr.t-0.2)
    let fh=0, ft=0
    for(const r of fr.runs){
      if(r.px<40) continue
      tot+=r.px; ft+=r.px
      const a=c0[r.sp], b=c1[r.sp]
      if(!b) continue
      // newly covered interval on this subpath between the two times
      const lo = a ? a[1] : b[0], hi = b[1]
      const ov = Math.max(0, Math.min(hi, r.a1) - Math.max(lo, r.a0))
      const s = r.px * Math.min(1, ov/Math.max(1, r.a1-r.a0))
      hit+=s; fh+=s
    }
    detail.push(`${fr.t.toFixed(1)}:${(fh/Math.max(1,ft)).toFixed(2)}`)
  }
  console.log(`${name.padEnd(34)} score=${(hit/tot).toFixed(4)}   ${detail.join(" ")}`)
  return hit/tot
}

const START=0.117, DUR=2.111
// A: proportional completion, all strokes together
scoreModel("A all/proportional", (t)=>{
  const u=Math.max(0,Math.min(1,(t-START)/DUR))
  const o:Record<number,[number,number]>={}
  lens.forEach((L,i)=>{ o[i]=[0, L*u] })
  return o
})
// B: equal px/s on every stroke; total px/s = 10000 spread over strokes
for (const SP of [10000/37, 100, 200, 300, 500, 800]) {
  scoreModel(`B all/equal-rate ${SP.toFixed(0)}px/s`, (t)=>{
    const s=Math.max(0,(t-START))*SP
    const o:Record<number,[number,number]>={}
    lens.forEach((L,i)=>{ o[i]=[0, Math.min(L,s)] })
    return o
  })
}
console.log(`\ntotal arc = ${TOTAL.toFixed(0)}px; 37 strokes; longest ${Math.max(...lens).toFixed(0)}px`)
