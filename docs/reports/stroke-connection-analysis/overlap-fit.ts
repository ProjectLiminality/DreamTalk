/**
 * Fit the stagger law directly from measured onsets.
 *
 * Sequential ("Single") predicts onset_k = t0 + C_k/v where C_k is the arc of
 * all longer strokes. Measured onsets are compressed relative to that: the
 * long strokes start too late and the short ones too early -- i.e. onset is
 * closer to a function of RANK than of cumulative length.
 *
 * Candidates:
 *   S1  onset = t0 + phi * C_k / v                (proportional stagger)
 *   S2  onset = t0 + DUR * rank_k / N             (uniform rank stagger)
 *   S3  onset = t0 + DUR * (C_k/TOTAL)^gamma      (power law on cum. fraction)
 */
import { readFileSync } from "fs"
const measured = JSON.parse(readFileSync("/private/tmp/claude-501/-Users-davidrug-RealDealVault-ProjectLiminality-DreamTalk/6c2f0ce6-31c0-4bce-aacb-bbcca3c5db79/scratchpad/itin2.json","utf8"))
const onset:Record<number,number>={}, lensOf:Record<number,number>={}
measured.forEach((fr:any)=>{ for(const r of fr.runs){ if(r.px<40) continue
  lensOf[r.sp]=r.len; if(onset[r.sp]===undefined) onset[r.sp]=fr.t } })
const k=(2/3)*(1280/1023)
const sps=Object.keys(onset).map(Number).sort((a,b)=>lensOf[b]-lensOf[a])
const L=sps.map(s=>lensOf[s]*k)
const TOTAL=L.reduce((a,b)=>a+b,0)
const C:number[]=[]; { let c=0; for(const l of L){ C.push(c); c+=l } }
const N=sps.length, T0=0.117, DUR=2.111
const meas=sps.map(s=>onset[s])
// onsets are quantized to the 0.2s frame grid: compare to the frame the model lands in
const rms=(pred:number[])=>Math.sqrt(pred.reduce((a,p,i)=>a+Math.pow(Math.ceil(Math.max(p,0.001)/0.2)*0.2-meas[i],2),0)/N)
const exact=(pred:number[])=>pred.filter((p,i)=>Math.abs(Math.ceil(Math.max(p,0.001)/0.2)*0.2-meas[i])<0.01).length

console.log("model                          rms(s)  exact-frame hits /"+N)
let best:any=null
for(const phi of [0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0]){
  const p=C.map(c=>T0+phi*c/10000); const r=rms(p)
  console.log(`S1 proportional phi=${phi.toFixed(1)}          ${r.toFixed(3)}   ${exact(p)}`)
  if(!best||r<best.r) best={n:`S1 phi=${phi}`,r,e:exact(p)}
}
{ const p=sps.map((_,i)=>T0+DUR*i/N); const r=rms(p)
  console.log(`S2 uniform rank                ${r.toFixed(3)}   ${exact(p)}`)
  if(r<best.r) best={n:"S2",r,e:exact(p)} }
for(const g of [0.3,0.4,0.5,0.6,0.7,0.8,1.0]){
  const p=C.map(c=>T0+DUR*Math.pow(c/TOTAL,g)); const r=rms(p)
  console.log(`S3 power gamma=${g.toFixed(1)}              ${r.toFixed(3)}   ${exact(p)}`)
  if(r<best.r) best={n:`S3 g=${g}`,r,e:exact(p)}
}
console.log(`\nbest: ${best.n}  rms=${best.r.toFixed(3)}s  exact ${best.e}/${N}`)
console.log("\nsp   len   C_k     meas   S3(0.5)  S2")
sps.forEach((s,i)=>{
  console.log(`sp${String(s).padStart(2)} ${L[i].toFixed(0).padStart(5)} ${C[i].toFixed(0).padStart(6)} ${meas[i].toFixed(1).padStart(6)} ${(T0+DUR*Math.pow(C[i]/TOTAL,0.5)).toFixed(2).padStart(8)} ${(T0+DUR*i/N).toFixed(2).padStart(5)}`)
})
