/**
 * Quantitative test of the reversal-split hypothesis.
 *
 * H: S&T splits a chained polyline wherever the turn angle exceeds THETA.
 * Predict the resulting stroke set, order long_short, walk at 10000px/s from
 * t=0.117, and compare the pen's predicted position to the MEASURED itinerary.
 *
 * Score = fraction of measured ink (weighted by pixel count) whose (subpath,
 * arc) region is covered by the prediction for that same frame.
 */
import { david } from "../../../core/vocabulary/Sketch/assets/david"
import { readFileSync } from "fs"
const SCALE=2/3, PX=1280/1023, k=SCALE*PX
const SPEED=10000, START=0.117

type Seg = { sp:number; a0:number; a1:number; L:number }

const build = (theta:number): Seg[] => {
  const out: Seg[] = []
  david.subpaths.forEach((f, sp) => {
    const n=f.length/2
    const P=(j:number)=>({x:f[2*j]*k, y:f[2*j+1]*k})
    const arcs=[0]; for(let j=1;j<n;j++){const a=P(j-1),b=P(j);arcs.push(arcs[j-1]+Math.hypot(b.x-a.x,b.y-a.y))}
    const cuts=[0]
    if (theta < 180) for(let j=1;j<n-1;j++){
      const a=P(j-1),b=P(j),c=P(j+1)
      const v1={x:b.x-a.x,y:b.y-a.y}, v2={x:c.x-b.x,y:c.y-b.y}
      const l1=Math.hypot(v1.x,v1.y), l2=Math.hypot(v2.x,v2.y)
      if(l1<1e-9||l2<1e-9) continue
      const deg=Math.acos(Math.max(-1,Math.min(1,(v1.x*v2.x+v1.y*v2.y)/(l1*l2))))*180/Math.PI
      if(deg>theta) cuts.push(arcs[j])
    }
    cuts.push(arcs[n-1])
    for(let i=1;i<cuts.length;i++){
      const L=cuts[i]-cuts[i-1]
      if(L>1e-6) out.push({sp, a0:cuts[i-1], a1:cuts[i], L})
    }
  })
  return out
}

const measured = JSON.parse(readFileSync("/private/tmp/claude-501/-Users-davidrug-RealDealVault-ProjectLiminality-DreamTalk/6c2f0ce6-31c0-4bce-aacb-bbcca3c5db79/scratchpad/itin2.json","utf8"))

const score = (theta:number, order:"long_short"|"short_long"|"document") => {
  let segs = build(theta)
  if (order !== "document") {
    const sign = order==="long_short" ? -1 : 1
    segs = segs.map((s,i)=>({s,i})).sort((a,b)=>sign*(a.s.L-b.s.L)||a.i-b.i).map(x=>x.s)
  }
  const total = segs.reduce((a,s)=>a+s.L,0)
  // cumulative start offset per segment
  const starts:number[]=[]; let acc=0
  for(const s of segs){ starts.push(acc); acc+=s.L }

  let hit=0, tot=0
  for(const fr of measured){
    const t1=fr.t, t0=t1-0.2
    const s0=Math.max(0,(t0-START)*SPEED), s1=Math.min(total,(t1-START)*SPEED)
    // predicted covered (sp -> intervals)
    const cov: Record<number, [number,number][]> = {}
    for(let i=0;i<segs.length;i++){
      const st=starts[i], en=st+segs[i].L
      if(en<=s0||st>=s1) continue
      const s=segs[i]
      const u0=(Math.max(s0,st)-st)/s.L, u1=(Math.min(s1,en)-st)/s.L
      const A=s.a0+(s.a1-s.a0)*u0, B=s.a0+(s.a1-s.a0)*u1
      ;(cov[s.sp] ??= []).push([Math.min(A,B), Math.max(A,B)])
    }
    for(const r of fr.runs){
      if(r.px<40) continue
      tot+=r.px
      const iv=cov[r.sp]
      if(!iv) continue
      // overlap fraction of the measured run
      let ov=0
      for(const [a,b] of iv) ov += Math.max(0, Math.min(b,r.a1)-Math.max(a,r.a0))
      hit += r.px * Math.min(1, ov/Math.max(1,r.a1-r.a0))
    }
  }
  return {theta, order, nSeg:segs.length, longest:Math.max(...segs.map(s=>s.L)), total, dur:total/SPEED, score:hit/tot}
}

console.log("theta  order        segs  longest   dur(s)  itinerary-score")
for (const order of ["long_short","short_long","document"] as const)
  for (const theta of [180, 150, 135, 120, 110, 100, 90, 80, 70, 60, 50, 45, 40, 30])
    { const r=score(theta,order)
      console.log(`${String(r.theta).padStart(5)}  ${order.padEnd(12)} ${String(r.nSeg).padStart(4)} ${r.longest.toFixed(0).padStart(8)} ${r.dur.toFixed(3).padStart(7)}  ${r.score.toFixed(4)}`) }
