/**
 * What DOES differ between S01's pose and S06's?
 *
 * S06 is p=PI/2: the cylinder axis points AT the camera (or nearly), so the
 * cap is seen nearly face-on and its projected ellipse is nearly a circle.
 * S01 is p=0.4: the axis is near-vertical on screen, so the cap is seen edge-on
 * and its projected ellipse is a thin sliver.
 *
 * The candidate discriminator DECISIONS names: "which side of the cap's
 * projected ellipse the silhouette generators land on". Quantify: the
 * ellipse's minor-axis foreshortening = |cos(angle between cap normal and
 * view direction)|, and where the generators sit on it.
 *
 * Note pydeation's stroke_order for solids is the DEFAULT "bottom_top"
 * (object.py:90), NOT long_short -- so the cylinder is ordered by SCREEN Y,
 * not by length. That is the real reason the Sketch finding does not
 * transfer: the two phenomena run different stroke_order modes.
 */
const deg=(r:number)=>(r*180/Math.PI).toFixed(1)
// cap normal is the cylinder's local +Y; view dir is world -z from camera at +z.
// After pitch p (about x), the local +Y maps to (0, cos p, sin p) in world.
for (const [name,p] of [["S01",0.4],["S06",Math.PI/2]] as const) {
  const n = {x:0, y:Math.cos(p), z:Math.sin(p)}
  const view = {x:0,y:0,z:1}      // toward camera
  const c = n.x*view.x+n.y*view.y+n.z*view.z
  console.log(`${name} p=${p.toFixed(3)}: cap normal=(0,${n.y.toFixed(3)},${n.z.toFixed(3)})  n.view=${c.toFixed(3)}`)
  console.log(`   angle(normal, camera) = ${deg(Math.acos(Math.abs(c)))}  ellipse minor/major = ${Math.abs(c).toFixed(3)}`)
  console.log(`   cap seen ${Math.abs(c)>0.7?"FACE-ON (fat ellipse)":"EDGE-ON (thin sliver)"}`)
  console.log(`   measured first arc: ${name==="S01"?"AWAY-facing":"CAMERA-facing"}`)
  console.log()
}
console.log("So the two measured scenes sit at OPPOSITE extremes of cap foreshortening,")
console.log("and their arc orders are opposite. That is consistent with a rule keyed on")
console.log("the projected ellipse -- but two data points cannot fix its threshold.")
