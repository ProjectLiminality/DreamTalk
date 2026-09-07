// Export david's subpaths PROJECTED to reference screen pixels, as JSON,
// so the frame analysis (python/PIL) can map lit pixels to arc positions.
//
// Framing (docs/reports/origins-vocabulary.md + core/demo/origins/Scene00.ts):
//   scale 2/3 on the SVG's own units; TwoDScene ortho zoom 1 frames 1023
//   world units across a 1280px render => 1.25122 px/world-unit.
//   david.ts is already centered and y-flipped.
import { david } from "../../../core/vocabulary/Sketch/assets/david"

const SCALE = 2 / 3
const PX_PER_UNIT = 1280 / 1023
const CX = 1280 / 2, CY = 720 / 2
const k = SCALE * PX_PER_UNIT

const out = david.subpaths.map((f, i) => {
  const n = f.length / 2
  const pts: number[] = []
  for (let j = 0; j < n; j++) {
    pts.push(CX + f[2*j] * k, CY - f[2*j+1] * k)   // screen y grows downward
  }
  return { i, pts }
})
console.log(JSON.stringify(out))
