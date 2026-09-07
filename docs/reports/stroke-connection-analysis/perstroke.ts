/**
 * Per-subpath completion curves, measured.
 *
 * Rather than fit a model, READ the data: for each subpath, what fraction of
 * its arc is inked at each frame? If S&T ran "Single" sequentially, each
 * subpath's curve would be a step from 0 to 1 inside one contiguous window.
 * If "All", every curve rises together. The shape of these curves IS the rule.
 */
import { readFileSync } from "fs"
const measured = JSON.parse(readFileSync("/private/tmp/claude-501/-Users-davidrug-RealDealVault-ProjectLiminality-DreamTalk/6c2f0ce6-31c0-4bce-aacb-bbcca3c5db79/scratchpad/itin2.json","utf8"))

// accumulate inked arc per subpath over time
const cum: Record<number, number[]> = {}
const lensOf: Record<number, number> = {}
const ts = measured.map((f:any)=>f.t)
measured.forEach((fr:any, fi:number)=>{
  for(const r of fr.runs){
    if(r.px<40) continue
    lensOf[r.sp]=r.len
    ;(cum[r.sp] ??= new Array(measured.length).fill(0))[fi] += (r.a1-r.a0)
  }
})
const order = Object.keys(cum).map(Number).sort((a,b)=>lensOf[b]-lensOf[a])
console.log("sp   len(svg)  cumulative inked fraction per frame (t=0.2..2.4)")
console.log("                " + ts.map((t:number)=>t.toFixed(1).padStart(5)).join(""))
for(const sp of order){
  let acc=0
  const row = cum[sp].map(v=>{ acc+=v; return Math.min(1,acc/lensOf[sp]) })
  console.log(`sp${String(sp).padStart(2)} ${lensOf[sp].toFixed(0).padStart(7)}   ` + row.map(v=>v.toFixed(2).padStart(5)).join(""))
}
