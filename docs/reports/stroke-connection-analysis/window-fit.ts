/**
 * THE MODEL THE DATA IMPLIES.
 *
 * Measured per-subpath curves show each stroke drawing over a WINDOW that
 * begins in length order and is long for long strokes. Read the windows
 * straight off the data: onset (first ink) and completion (last ink) per
 * subpath, then ask what law relates them.
 *
 * Sequential-single predicts: window_k = [C_k/v, (C_k+L_k)/v], disjoint.
 * Measured: windows OVERLAP heavily. How heavily?
 */
import { readFileSync } from "fs"
const measured = JSON.parse(readFileSync("/private/tmp/claude-501/-Users-davidrug-RealDealVault-ProjectLiminality-DreamTalk/6c2f0ce6-31c0-4bce-aacb-bbcca3c5db79/scratchpad/itin2.json","utf8"))
const first:Record<number,number>={}, last:Record<number,number>={}, lensOf:Record<number,number>={}, done:Record<number,number>={}
measured.forEach((fr:any)=>{ for(const r of fr.runs){ if(r.px<40) continue
  lensOf[r.sp]=r.len
  if(first[r.sp]===undefined) first[r.sp]=fr.t
  last[r.sp]=fr.t
  done[r.sp]=(done[r.sp]??0)+(r.a1-r.a0) } })
const k=(2/3)*(1280/1023)
const sps=Object.keys(first).map(Number).sort((a,b)=>lensOf[b]-lensOf[a])
console.log("sp    Lpx   onset  finish  span  L/span(px/s)   covered")
const rates:number[]=[]
for(const s of sps){
  const L=lensOf[s]*k, span=last[s]-first[s]+0.2
  const rate=L/span
  rates.push(rate)
  console.log(`sp${String(s).padStart(2)} ${L.toFixed(0).padStart(6)} ${first[s].toFixed(1).padStart(6)} ${last[s].toFixed(1).padStart(7)} ${span.toFixed(1).padStart(5)} ${rate.toFixed(0).padStart(12)}   ${(Math.min(1,done[s]/lensOf[s])).toFixed(2)}`)
}
const sorted=[...rates].sort((a,b)=>a-b)
console.log(`\nper-stroke draw rate px/s: median=${sorted[Math.floor(sorted.length/2)].toFixed(0)} min=${sorted[0].toFixed(0)} max=${sorted.at(-1)!.toFixed(0)}`)
// Sum of concurrent rates: if the TOTAL pen rate is 10000px/s, the sum of the
// rates of strokes active at a given time should be ~10000.
console.log("\nt    active strokes  sum of their rates")
for(const t of [0.2,0.4,0.6,0.8,1.0,1.2,1.4,1.6,1.8,2.0,2.2,2.4]){
  const act=sps.filter(s=>first[s]<=t&&last[s]>=t)
  const sum=act.reduce((a,s)=>a+lensOf[s]*k/(last[s]-first[s]+0.2),0)
  console.log(`${t.toFixed(1)}  ${String(act.length).padStart(3)}            ${sum.toFixed(0).padStart(7)}   [${act.map(s=>"sp"+s).join(" ")}]`)
}
