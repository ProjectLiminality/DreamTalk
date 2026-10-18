/**
 * Narrative — "a mechanical narrative constructed for the purpose of
 * manipulation" (narration 18:47): a perspective cube, standalone in a blue
 * ring (f5686, labelled "Narrative", opposite the red Vision; f5821 left,
 * "Narrative Engineering"), clapped over a head as the box of the boxed web
 * (f5146, f5221), held round a domesticated mind's head without its ring
 * (Mind, f7021), set in the manipulated lens (Worldview, f3541).
 *
 * COMPOSED, NEVER REDRAWN. The cube is `FoldableCube` at fold 1 — the
 * closed cup, its open side toward the viewer and its rim in this holon's
 * plane — with the cup's `taper` set so that, seen from the camera, its
 * back square shows the film's ratio to the front: the film draws it in
 * strong one-point perspective (see FoldableCube's header). The film's
 * cubes are drawings, each with its vanishing point at its own centre,
 * so an off-centre one is still dead front-on; a deep solid off-centre
 * is seen from the side by our one camera. So the cup is a shallow
 * relief (`depth` 0.02 of its edge): its walls lie nearly in the rim's
 * plane and the taper alone makes the perspective, wherever it sits.
 * The ring is a Circle with a black disc behind it, so a boxed head is
 * covered by its box (f5221). Only the ring and disc are this holon's own.
 *
 * MEASURED (1280×720, stroke centrelines):
 *
 *   BACK   the back square / the front: f5686 80.5/112 = 0.719 across,
 *          79.5/112 = 0.710 down; f5821 153/213 = 0.718 both ways → 0.716
 *          (f3541's narrative in the lens draws it deeper: 0.66 —
 *          Worldview passes its own `perspective`)
 *   RING   the ring's radius / the cube's front edge: f5686 90.9/112 =
 *          0.812; f5821 173.5/213 = 0.815 → 0.813. Ring and cube share
 *          their centre (f5686: 395.75 vs 395.5 px, 360 vs 360).
 *
 * Tints: the standalone and boxed narrative is a WHITE cube in a BLUE ring
 * (f5686, f5221); the cube round a domesticated mind's head is BLUE with no
 * ring (f7021, f5221's heads), and the domesticated eye's iris cube is blue
 * too (MolochEye). Both are `tint` / `ringTint` / `ring`.
 */

import { Circle, Null } from "../../src/parts/primitives"
import { color, completion, derive, length } from "../../src/params"
import { BLACK, BLUE, PI, WHITE } from "../../src/constants"
import { type Anim, restage, together } from "../../src/anim"
import { Create } from "../../src/verbs"
import { toggle, type StateSpace } from "../../src/automaton"
import { Layer } from "../Figure/Figure"
import { FoldableCube, taperFor } from "../FoldableCube/FoldableCube"

/** The construction's two measured ratios (see header). */
export const NARRATIVE = {
  /** Apparent back square / front square. */
  back: 0.716,
  /** Ring radius / cube front edge. */
  ring: 0.813,
  /** The relief's depth / its edge: shallow enough that the parallax of a
   *  symbol 600 units off-centre moves the back square < 1 px. */
  depth: 0.02,
} as const

/** The camera's distance to the symbol's plane at the framework's default
 *  observer (src/dream.ts: Observer.radius = 1500). */
export const DEFAULT_VIEW_DISTANCE = 1500

export class Narrative extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  /** The cube's front edge; the ring's radius derives from it. */
  size = length(112)
  /** 0 the bare cube … 1 in its ring (with the black disc that covers what it sits on). */
  ring = completion(1)
  /** The cube's ink: white standalone and boxed, blue round a mind's head. */
  tint = color(WHITE)
  ringTint = color(BLUE)
  /** The back square's apparent size relative to the front, seen front-on. */
  perspective = completion(NARRATIVE.back)
  /** The cube's depth as a fraction of its edge: a shallow relief, so that it
   *  reads front-on wherever it sits, as every film cube does (FoldableCube
   *  `depth`). 1 makes it a solid seen in true 3D. */
  depth = completion(NARRATIVE.depth)
  /** How far the camera is from the symbol's plane — what the cube's own
   *  foreshortening is computed against (the default observer's). */
  viewDistance = length(DEFAULT_VIEW_DISTANCE)
  /** Pen widths in screen px (f5686: ≈ 4 px each at that size). */
  stroke = length(2.4)
  ringStroke = length(3)

  /** Walkable (src/automaton.ts): the bare cube ↔ the ringed symbol. */
  override stateSpace(): StateSpace | undefined {
    if (this.ring.isBound) return undefined
    return { axes: [toggle("ring", this.ring, { off: ["bare", 0], on: ["ringed", 1], duration: 0.6, handles: [this] })] }
  }

  cube!: FoldableCube
  /** The black disc and the blue ring, each in its layer (presence = `ring`). */
  disc!: Layer
  ringLayer!: Layer
  circle!: Circle

  protected override compose(): void {
    const radius = derive(() => NARRATIVE.ring * this.size.value)
    const present = derive(() => this.ring.value)

    // Attach order is composite order: disc, cube, ring.
    this.disc = this.add(
      new Layer({ presence: present, members: [new Circle({ radius, tint: BLACK, stroke: 0, fillOpacity: 1 })] }),
    )
    this.cube = this.add(
      new FoldableCube({
        size: this.size,
        // The closed cup — bound, so the narrative's cube is not a walkable axis of its own.
        fold: derive(() => 1),
        depth: this.depth,
        taper: derive(() => taperFor(this.perspective.value, this.size.value, this.viewDistance.value, this.depth.value)),
        // Open side toward the viewer, its rim in this plane.
        p: PI / 2,
        z: derive(() => -this.size.value * this.depth.value),
        tint: this.tint,
        stroke: this.stroke,
      }),
    )
    this.circle = new Circle({ radius, tint: this.ringTint, stroke: this.ringStroke })
    this.ringLayer = this.add(new Layer({ presence: present, members: [this.circle] }))
  }

  /** The cube draws, the ring closes round it. */
  override createAnim(): Anim {
    void this.parts // compose() is lazy: the parts exist once it has run
    return together(
      restage(Create(this.disc), 0, 0.3),
      restage(Create(this.cube), 0, 0.8),
      restage(this.circle.creation.sequence(0, 1), 0.3, 1),
    )
  }
}
