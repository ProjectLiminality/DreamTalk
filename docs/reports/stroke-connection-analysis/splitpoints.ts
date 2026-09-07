/**
 * What is the geometry AT the measured split points?
 *
 * The measured itinerary gives arc positions where the reference pen left a
 * subpath and (later) resumed it. If S&T splits on a geometric criterion, the
 * criterion must fire at those positions and not elsewhere.
 *
 * Prints, for each subpath, the turn angle profile at C4D-spline-point
 * resolution and the top turn-angle peaks, next to the measured boundaries.
 */
import { david } from "../../../core/vocabulary/Sketch/assets/david"
const SCALE=2/3, PX=1280/1023, k=SCALE*PX

// measured boundaries (arc px in screen space) per subpath, from itin2
const measured: Record<number, number[]> = {
  0: [340, 420, 440, 1380, 2520, 2760, 3660, 3700, 3740, 3820, 4080, 4220, 4280, 4440, 4460, 4840, 4960, 5000, 5420, 6120, 6180, 6300, 6440],
  3: [160, 520, 1100, 1580, 1900, 1880, 2080],
  8: [180, 400, 460, 680, 820, 920, 1020, 1060, 1420, 1440, 1620, 2040, 2120, 2140, 2180, 2280],
  11:[120, 260, 280, 420, 500, 580, 600, 660, 700, 900, 920, 980, 1960, 2060, 2080],
  2: [560, 1120, 1180],
  6: [300, 320, 460],
}

for (const [spS, bnds] of Object.entries(measured)) {
  const sp = Number(spS)
  const f = david.subpaths[sp]!
  const n = f.length/2
  const P = (j:number)=>({x:f[2*j]*k, y:f[2*j+1]*k})
  // arc + turn angle at each interior vertex
  const arcs:number[]=[0]; for(let j=1;j<n;j++){const a=P(j-1),b=P(j);arcs.push(arcs[j-1]+Math.hypot(b.x-a.x,b.y-a.y))}
  const turns:{arc:number;deg:number}[]=[]
  for(let j=1;j<n-1;j++){
    const a=P(j-1),b=P(j),c=P(j+1)
    const v1={x:b.x-a.x,y:b.y-a.y}, v2={x:c.x-b.x,y:c.y-b.y}
    const l1=Math.hypot(v1.x,v1.y), l2=Math.hypot(v2.x,v2.y)
    if(l1<1e-9||l2<1e-9) continue
    const cos=Math.max(-1,Math.min(1,(v1.x*v2.x+v1.y*v2.y)/(l1*l2)))
    turns.push({arc:arcs[j], deg: Math.acos(cos)*180/Math.PI})
  }
  const top=[...turns].sort((a,b)=>b.deg-a.deg).slice(0,14).sort((a,b)=>a.arc-b.arc)
  const L=arcs[n-1]
  console.log(`\n=== sp${sp}  len=${L.toFixed(0)}px  pts=${n} ===`)
  console.log(`  measured boundaries: ${bnds.join(", ")}`)
  console.log(`  top turn angles:     ${top.map(t=>`${t.arc.toFixed(0)}(${t.deg.toFixed(0)}deg)`).join(" ")}`)
  console.log(`  turns >90deg: ${turns.filter(t=>t.deg>90).length}   >60: ${turns.filter(t=>t.deg>60).length}   >45: ${turns.filter(t=>t.deg>45).length}  max=${Math.max(...turns.map(t=>t.deg)).toFixed(0)}deg`)
  // for each measured boundary, the largest turn within +-25px
  const near = bnds.map(b=>{
    const w=turns.filter(t=>Math.abs(t.arc-b)<=25)
    return `${b}:${w.length?Math.max(...w.map(t=>t.deg)).toFixed(0):"-"}`
  })
  console.log(`  max turn within +-25px of each boundary: ${near.join(" ")}`)
}
