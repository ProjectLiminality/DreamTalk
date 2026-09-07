/**
 * CYLINDER CHECK — does the long_short rule predict the observed arc order?
 *
 * The near cap is broken at the two silhouette generators into:
 *   camera-facing arc, sweep = thetaB - thetaA  (= 2*acos(r/d), always < pi)
 *   away-facing arc,   sweep = 2pi - (thetaB - thetaA)         (always > pi)
 *
 * Since acos(r/d) < pi/2 for all d > r, the camera-facing arc is ALWAYS
 * shorter than the away-facing one, for EVERY pose. So a pure long_short
 * rule on arc length predicts AWAY-facing first universally -- it cannot
 * produce S06's camera-facing-first reading. Shown here numerically.
 */
import { silhouetteAngles } from "../../../core/src/render/silhouette"
const deg=(r:number)=>(r*180/Math.PI).toFixed(1)

console.log("d/r    spread=acos(r/d)  camera-facing sweep  away-facing sweep  longer")
for (const dr of [1.05, 1.2, 1.5, 2, 3, 5, 10, 100, 1000]) {
  const a = silhouetteAngles(dr, 0, 1)!
  const cam = a.thetaB - a.thetaA
  const away = Math.PI*2 - cam
  console.log(`${String(dr).padStart(5)}  ${deg(Math.acos(1/dr)).padStart(15)}  ${deg(cam).padStart(19)}  ${deg(away).padStart(17)}  ${cam>away?"camera":"AWAY"}`)
}
console.log("\nacos(r/d) is in (0, pi/2) for all d>r, so the camera-facing sweep")
console.log("2*acos(r/d) is in (0, pi): the away-facing arc is ALWAYS the longer one.")
console.log("=> long_short on arc length predicts AWAY-facing first for every pose.")
console.log("   Matches S01 (away first). Does NOT match S06 (camera first).")
