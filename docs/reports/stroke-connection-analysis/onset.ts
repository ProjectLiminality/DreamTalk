/**
 * ONSET ORDER — the decisive table.
 *
 * For each subpath: the frame at which its ink first appears, against its
 * length rank. If S&T orders whole strokes long_short, onset rank must equal
 * length rank. Spearman correlation quantifies it.
 */
import { readFileSync } from "fs"
const measured = JSON.parse(readFileSync("/private/tmp/claude-501/-Users-davidrug-RealDealVault-ProjectLiminality-DreamTalk/6c2f0ce6-31c0-4bce-aacb-bbcca3c5db79/scratchpad/itin2.json","utf8"))
const onset: Record<number, number> = {}
const lensOf: Record<number, number> = {}
measured.forEach((fr:any)=>{
  for(const r of fr.runs){
    if(r.px<40) continue
    lensOf[r.sp]=r.len
    if(onset[r.sp]===undefined) onset[r.sp]=fr.t
  }
})
const sps=Object.keys(onset).map(Number)
const byLen=[...sps].sort((a,b)=>lensOf[b]-lensOf[a])
const byOnset=[...sps].sort((a,b)=>onset[a]-onset[b]||lensOf[b]-lensOf[a])
const lenRank=new Map(byLen.map((s,i)=>[s,i]))
const onRank=new Map(byOnset.map((s,i)=>[s,i]))
console.log("sp   len   lenRank  firstInk  onsetRank  delta")
for(const s of byLen)
  console.log(`sp${String(s).padStart(2)} ${lensOf[s].toFixed(0).padStart(5)} ${String(lenRank.get(s)).padStart(8)} ${onset[s].toFixed(1).padStart(9)} ${String(onRank.get(s)).padStart(10)} ${String(onRank.get(s)!-lenRank.get(s)!).padStart(6)}`)
// Spearman on (lenRank, onset time)
const n=sps.length
const d2=sps.reduce((a,s)=>a+Math.pow(lenRank.get(s)!-onRank.get(s)!,2),0)
console.log(`\nn=${n}  Spearman rho(lengthRank, onsetRank) = ${(1-6*d2/(n*(n*n-1))).toFixed(4)}`)
// Also: onset time vs cumulative length of longer strokes (the sequential prediction)
let cum=0
console.log("\nsequential prediction: onset_k = 0.117 + (sum of longer strokes)/10000 s")
console.log("sp    len   cumBefore  predOnset  measOnset  err")
const k=(2/3)*(1280/1023)
for(const s of byLen){
  const pred=0.117+cum*k/10000
  console.log(`sp${String(s).padStart(2)} ${lensOf[s].toFixed(0).padStart(6)} ${(cum*k).toFixed(0).padStart(10)} ${pred.toFixed(2).padStart(10)} ${onset[s].toFixed(1).padStart(10)} ${(onset[s]-pred).toFixed(2).padStart(6)}`)
  cum+=lensOf[s]
}
