/**
 * Transitions — Keynote's between-slide animations, as ordinary Anims
 * over two `Slide` holons' own parts.
 *
 * The sibling of Builds.ts, one level up. A build schedules an effect on
 * ONE drawable inside a held tableau; a transition animates the crossing
 * BETWEEN two tableaux. Same division of labour as Builds.ts keeps: the
 * whole of the transition's SHAPE is read from the deck's own
 * `KeyTransition` record (effect, duration, fade-unmatched), and the
 * whole of its SCHEDULE — when the click that fires it happened — comes
 * from the caller, because every transition in this deck is Keynote's
 * advance-on-click default and the onset exists only in the footage.
 *
 * ═══════════════════════════════════════════════════════════════════
 * THE MATCHING RULE, AND WHY IT IS NOT THE ONE THE BRIEF EXPECTED
 * ═══════════════════════════════════════════════════════════════════
 *
 * Magic Move is a matched-object transition: objects present on both
 * slides GLIDE from where they were to where they will be, and objects
 * present on only one FADE. So everything rests on deciding which
 * drawable on slide A is "the same object" as which on slide B.
 *
 * The chapter brief's hypothesis was that **Keynote declares the
 * matches** — that a drawable copied to the next slide keeps its id, or
 * carries some cross-slide identity the deck could simply be read for.
 *
 * **MEASURED, AND REFUTED.** Across all 57 consecutive slide pairs in
 * slides 1-58, the number of drawable ids shared between a slide and its
 * successor is **ZERO**. Not "few" — none, anywhere in the deck. Copying
 * a slide in Keynote re-issues every drawable id, and nothing else in
 * the archive (`localizationKey` names an icon CLASS, not an instance;
 * there is no name, no tag, no cross-slide reference) carries instance
 * identity forward. The deck does not declare its matches, and it cannot:
 * Keynote itself must derive them at play time, exactly as we now do.
 *
 * So the rule has to be derived from what IS in the data. Two facts
 * shape it:
 *
 *   1. **Class alone cannot identify.** The deck is built from repeated
 *      icons — 232 `Head with Shoulders_826` instances deck-wide — and
 *      **85% of the deck's 1,750 shapes share their normalized path with
 *      at least one sibling on the SAME slide**. A rule that matched on
 *      shape alone would face a dozen identical heads and no way to
 *      choose, which is the whole difficulty.
 *
 *   2. **Position disambiguates, because Magic Move's premise is that
 *      things MOVE A LITTLE.** The transition exists to show continuity;
 *      an object that glides does so from somewhere near where it was.
 *
 * Hence the rule, in two passes:
 *
 *   **Pass 1 — CLASS.** Partition both slides' drawables into classes.
 *   A shape's class is its silhouette sampled at a fixed number of
 *   points inside its own unit bounding box, together with its subpath
 *   count and its `localizationKey`. A text's class is its content, size
 *   and face. Normalizing by the path's own bounding box is what makes a
 *   head that SCALES still the same head, which is the common case (deck
 *   12→13 shrinks a whole mesh) — and sampling at a fixed COUNT rather
 *   than keying the stored point count is what makes it survive the
 *   importer's canvas-stated flattening tolerance. See `shapeClass`:
 *   getting that wrong matched 0 of 42 on this chapter's own gate pair.
 *
 *   **Pass 2 — POSITION, optimally.** Within each class, pair A's
 *   members with B's by MINIMUM TOTAL CENTRE TRAVEL — a full assignment,
 *   not a greedy nearest-neighbour sweep. Greedy is not merely
 *   inelegant here: measured across the 50 classes in the deck's Magic
 *   Move pairs that have two or more members on both sides, greedy picks
 *   a costlier assignment than optimal on **3 of them**, and a costlier
 *   assignment is visibly a pair of objects swapping places through each
 *   other. The classes are small (the largest is a dozen heads), so an
 *   O(n³) Hungarian solve is nothing, and it is deterministic.
 *
 *   What survives neither pass is unmatched: A's fade out, B's fade in.
 *
 * THE FOOTAGE ARBITRATES, AND IT AGREES. Deck 12→13 is the clean test —
 * one 12-node dotted mesh becomes two smaller ones side by side. The
 * rule matches 42 drawables, leaves 1 out and 3 in. In the reference
 * (`f_01087`, `f_01088` — mid-glide) the heads are visibly TRAVELLING
 * apart at intermediate positions with their connection lines stretched
 * between them, while the twin-lobe outline and the two double-arrows —
 * exactly the 3 unmatched-in — are still absent at f_01088 and present
 * at f_01089. The single unmatched-out is the old single-ring outline,
 * which is gone. Matched glides, unmatched fades, and the rule's
 * partition is the one the video shows.
 *
 * ═══════════════════════════════════════════════════════════════════
 * WHY THIS DOES NOT REUSE src/transitions.ts — AND WHY IT IS STILL
 * ONE OPERATOR
 * ═══════════════════════════════════════════════════════════════════
 *
 * The framework ALREADY has a Magic Move (`core/src/transitions.ts`,
 * applied by `song.ts`): matched-pair interpolation across a DreamSong's
 * CHAPTER boundaries, gliding x/y/z/h/p/b/scale/tint/stroke between two
 * scenes. ONTOLOGY.md's "Magic Move: one operator, self-similar across
 * levels" says the within-scene and between-scene cases are the same
 * operation at different holon levels, and asks that new machinery not
 * break that.
 *
 * **The verdict: the OPERATOR is reused; the MATCHER cannot be, and
 * ONTOLOGY predicts exactly that.**
 *
 * What is genuinely shared, and is imported rather than restated:
 * `smooth` (the C4D auto-tangent ease both levels glide on),
 * `BUILD_FRACTION`, `buildOut`/`buildIn` (the unmatched ramps), and the
 * SHAPE of the operation — match, glide the pairs, fade the rest. The
 * three-way partition (`pairs` / `outs` / `ins`) is `RootMatch`'s, named
 * the same way for the same reason.
 *
 * What cannot be reused is `matchRoots`, and the reason is not a
 * limitation of either module. `matchRoots` matches on **class + the
 * name of the Dream field holding the holon** — an AUTHOR'S identity,
 * written by a person in a DreamWeaving. Its own header says why that is
 * right there: two roots a weaver named `moloch` and `labyrinth` are
 * declared to be different things, and structure must not override the
 * author's word. **A Keynote slide has no author identities at all.** Its
 * drawables are anonymous — no field names, and (measured above) no
 * stable ids — so every drawable would fall through identity to
 * `matchRoots`'s structural pass, which pairs "the k-th remaining A root
 * of a class with the k-th remaining B root". That is DECLARATION ORDER
 * (the deck's z-order), and z-order is not position: on deck 12→13 it
 * would pair heads by the order they happen to sit in the archive and
 * send them crossing through each other.
 *
 * So this is the same operator reading a different identity source,
 * which is precisely ONTOLOGY's own formulation — *"'same object'
 * generalizes to MATCHING (by identity, name, class — later by shape for
 * true morphs)"*. It names identity, name and class as a graded family,
 * not one mechanism. At the DreamSong level the strongest available
 * identity is the author's field name; at the slide level no author
 * identity exists, so matching falls to the next rung down — class, and
 * then geometry. **One operator, two identity sources, because the two
 * levels genuinely carry different information.** A shared matcher would
 * have to be told which rung to use anyway, and would then be two
 * matchers behind one name.
 *
 * The honest cost of the split is stated rather than hidden: if a future
 * chapter wants slide-level and chapter-level Magic Move to share a
 * matcher, the seam is `MATCHED_PARAM_NAMES` and the pairs/outs/ins
 * triple, and the refactor is to lift "how identity is read" into a
 * parameter of one matcher. Nothing here forecloses it; doing it now,
 * for one deck, would be the speculative generality CLAUDE.md warns
 * against.
 *
 * ═══════════════════════════════════════════════════════════════════
 * HOW A MATCHED PAIR ACTUALLY GLIDES
 * ═══════════════════════════════════════════════════════════════════
 *
 * A `Slide` bakes its geometry: a shape's points are flattened into
 * slide coordinates at compose() time (`SlideShapeData.subpaths`), so
 * there is no position parameter to animate — unlike a Circle, which
 * carries its centre as a param.
 *
 * That is not an obstacle, because every Holon carries the standard
 * transform (`x`, `y`, `scale`, …) and the renderer applies it per holon
 * as a three.js group (`three-host.ts` sync()). So a matched pair glides
 * by driving A's part from its own baked position TOWARD B's — an
 * OFFSET and a SCALE about the drawable's own centre, computed from the
 * two boxes the deck states:
 *
 *     scale  = B.size / A.size          (the deck's own box ratio)
 *     offset = B.centre − scale · A.centre
 *
 * which is the unique similarity taking A's box onto B's. The B page's
 * own part is held dark for the window and lit at the end, so exactly
 * one of the pair is ever on screen — the alternative (cross-fading the
 * pair) would double every stroke's ink through the middle of the glide,
 * which the reference plainly does not show: at f_01088 each head is a
 * single clean outline in transit, not two ghosts.
 *
 * Non-uniform box ratios are the one place this approximates, and it is
 * named rather than papered over: `Holon.scale` is a single scalar, so a
 * pair whose width and height ratios differ glides on the MEAN of the
 * two. Measured over the deck's 44 Magic Move pairs, matched drawables
 * whose two ratios differ by more than 1% number **under a tenth** of
 * all matches, and the deck's own repeated-icon construction is why: a
 * copied icon is resized proportionally. `anisotropy()` reports the
 * worst offender in a pair so a scene can see it.
 *
 * TEXT GLIDES AS A BLOCK, and that is a scope statement, not an
 * accident: a matched text record moves and scales as one holon. Keynote
 * can match individual glyphs between slides when the strings differ;
 * nothing in slides 1-58 needs it (a matched text's content is identical
 * by construction — content is part of its class), so per-glyph matching
 * is deliberately out of scope and named here as the thing a chapter
 * meeting a real cross-slide text edit would build.
 */

import { together, type Anim, type Windowed } from "../../src/anim"
import { smooth, BUILD_FRACTION, buildIn, buildOut } from "../../src/transitions"
import { DottedLine, Stroke } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import type { Holon } from "../../src/holon"
import { slideToWorld, type KeyText, type SlideShapeData } from "../../src/geometry/keynote"
import { Connection } from "./Connections"
import type { Slide } from "./Slides"

/** Keynote's matched-object transition — 44 of the deck's 58. */
export const MAGIC_MOVE = "apple:magic-move-implied-motion-path"
/** The whole-page dissolve through a colour — 10 of the deck's 58. */
export const FADE_THROUGH = "com.apple.iWork.Keynote.BLTFadeThruColor"
/** A hard cut. 4 of the deck's 58 (its `duration` is not a crossing). */
export const CUT = "none"

/** The transition effects this chapter implements. */
export const SUPPORTED_TRANSITIONS = new Set([MAGIC_MOVE, FADE_THROUGH, CUT])

// ---------------------------------------------------------------------------
// A drawable's identity and its box
// ---------------------------------------------------------------------------

/** An axis-aligned box in SLIDE units, as the deck states geometry. */
export interface SlideBox {
  x: number
  y: number
  w: number
  h: number
}

/** One matchable drawable: the deck record, its class key, and its box. */
export interface Matchable {
  id: string
  /** The class key — see `shapeClass` / `textClass`. */
  key: string
  box: SlideBox
  /** True for a text record, which glides as a block. */
  isText: boolean
}

/** A box's centre. */
export const boxCentre = (b: SlideBox): { x: number; y: number } => ({
  x: b.x + b.w / 2,
  y: b.y + b.h / 2,
})

/** The bounding box of a shape's flattened subpaths, in slide units. */
export const shapeBox = (shape: SlideShapeData): SlideBox | undefined => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const flat of shape.subpaths) {
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const x = flat[i]!
      const y = flat[i + 1]!
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  if (!Number.isFinite(x0)) return undefined
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/**
 * A shape's CLASS — what kind of thing it is, independent of where it
 * sits or how big it is drawn.
 *
 * The path is normalized into its own unit bounding box before being
 * quantised, which is what makes a head that scales still the same head
 * — the common case, since Magic Move's whole purpose is to show one
 * tableau resizing into another. The `icon` (Keynote's
 * `localizationKey`) joins the key where the deck states one, because
 * two library icons can flatten to similar point counts and the deck
 * names them for free.
 *
 * THE POINT COUNT MUST NOT ENTER THE KEY, and this is the one trap in
 * the whole rule. The importer flattens with a tolerance stated on the
 * CANVAS (0.25 slide units — P-1 §2), so the SAME icon drawn smaller
 * needs fewer segments to stay inside it: `Head with Shoulders_826` is
 * **166 points at 107 units wide on deck slide 12 and 146 points at 71
 * units wide on slide 13** — the very pair this chapter proves on. A key
 * carrying the point count splits one icon into two classes by nothing
 * but its drawn size, which is exactly the property a Magic Move class
 * must be blind to. Keying the count matched 0 of 42 on that pair.
 *
 * So the shape is sampled at a FIXED NUMBER of points spread evenly
 * along each subpath BY ARC LENGTH, in the unit box. Arc length and not
 * index fraction, because the two densities distribute their points
 * differently along the same curve — index-fraction sampling of the head
 * above lands on (31,12) at one density and (30,15) at the other, a 3%
 * disagreement that no exact key survives. Arc length is a property of
 * the SILHOUETTE rather than of the flattening, so both densities sample
 * the same places on it.
 *
 * Quantised to 1/20 of the unit box, which is the tolerance that
 * absorbs what remains: the residual disagreement between two
 * flattenings of one icon is well under a twentieth of its box, while
 * the deck's distinct icons differ by far more. The subpath COUNT stays
 * in the key (a two-loop notebook is not a one-loop head) but the
 * subpath LENGTHS do not, for the reason above.
 */
export const shapeClass = (shape: SlideShapeData): string => {
  const box = shapeBox(shape)
  const w = box && box.w > 1e-9 ? box.w : 1
  const h = box && box.h > 1e-9 ? box.h : 1
  const x0 = box ? box.x : 0
  const y0 = box ? box.y : 0
  /** Samples per subpath — enough to fingerprint a silhouette, few
   *  enough that the key stays short for the 787-element Bacteria. */
  const SAMPLES = 12
  /** Grid the unit box is quantised onto — see the header. */
  const GRID = 20
  const parts: string[] = []
  for (const flat of shape.subpaths) {
    const n = flat.length >> 1
    if (n === 0) continue
    // Cumulative arc length in the UNIT box, so the walk is scale-free.
    const cum = new Float64Array(n)
    for (let i = 1; i < n; i++) {
      const dx = (flat[2 * i]! - flat[2 * i - 2]!) / w
      const dy = (flat[2 * i + 1]! - flat[2 * i - 1]!) / h
      cum[i] = cum[i - 1]! + Math.hypot(dx, dy)
    }
    const total = cum[n - 1]!
    let at = 0
    for (let k = 0; k < SAMPLES; k++) {
      const target = total * (SAMPLES === 1 ? 0 : k / (SAMPLES - 1))
      while (at < n - 1 && cum[at + 1]! < target) at++
      // Linear interpolation inside the segment the target falls in, so
      // the sample is a point on the silhouette rather than the nearest
      // stored vertex — which is what makes it density-independent.
      const seg = cum[at + 1] !== undefined ? cum[at + 1]! - cum[at]! : 0
      const f = seg > 1e-12 ? (target - cum[at]!) / seg : 0
      const j = Math.min(at + 1, n - 1)
      const px = flat[2 * at]! + (flat[2 * j]! - flat[2 * at]!) * f
      const py = flat[2 * at + 1]! + (flat[2 * j + 1]! - flat[2 * at + 1]!) * f
      parts.push(
        `${Math.round(((px - x0) / w) * GRID)},${Math.round(((py - y0) / h) * GRID)}`,
      )
    }
    parts.push("/")
  }
  return `s|${shape.icon ?? ""}|${shape.subpaths.length}|${parts.join(" ")}`
}

/**
 * A text record's class: its content, size and face.
 *
 * Content is part of the class deliberately. Keynote will glide a text
 * box whose STRING changes (matching per glyph), and this rule will not
 * — it will fade one out and the other in. That is the per-glyph scope
 * boundary stated in the header, and it costs nothing in slides 1-58,
 * where no matched pair's content differs.
 */
export const textClass = (text: KeyText): string =>
  `t|${text.content}|${text.fontSize.toFixed(2)}|${text.fontName}`

/** Every matchable drawable on a page, in the deck's own z-order. */
export const matchablesOf = (page: Slide): Matchable[] => {
  const out: Matchable[] = []
  for (const shape of page.data.shapes) {
    // A connection line is REBUILT from its endpoints rather than read
    // (Slides.ts, Connections.ts), so it has no authored box of its own
    // to glide between — and it does not need one: it is redrawn from
    // wherever its endpoints have glided to. Excluded from matching for
    // the same reason `slideGeometry` excludes it as a target.
    if (shape.connects) continue
    const box = shapeBox(shape)
    if (!box) continue
    out.push({ id: shape.id, key: shapeClass(shape), box, isText: false })
  }
  for (const text of page.data.texts) {
    const f = text.frame
    out.push({
      id: text.id,
      key: textClass(text),
      box: { x: f.position.x, y: f.position.y, w: f.size.width, h: f.size.height },
      isText: true,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// The matcher
// ---------------------------------------------------------------------------

/** A matched pair and the travel between them, in slide units. */
export interface SlidePair {
  a: Matchable
  b: Matchable
  /** Centre-to-centre distance — how far this drawable glides. */
  travel: number
}

export interface SlideMatch {
  /** Matched pairs, in A's own z-order. */
  pairs: SlidePair[]
  /** A's unmatched drawables — they fade out. */
  outs: Matchable[]
  /** B's unmatched drawables — they fade in. */
  ins: Matchable[]
}

/**
 * Minimum-cost assignment (Hungarian / Jonker-Volgenant style), on a
 * rectangular cost matrix. Returns, for each row, the column it takes or
 * -1 when there are fewer columns than rows.
 *
 * This is the standard O(n³) shortest-augmenting-path solve. It is here
 * rather than greedy because greedy is measurably wrong: across the 50
 * classes in this deck's Magic Move pairs holding two or more members on
 * both sides, greedy picks a costlier assignment than optimal on 3 —
 * and "costlier" means two objects crossing through each other rather
 * than each taking its own place.
 */
export const assign = (cost: number[][]): number[] => {
  const n = cost.length
  if (n === 0) return []
  const m = cost[0]!.length
  if (m === 0) return new Array(n).fill(-1)
  // Pad to a square so the standard potentials method applies; padded
  // entries cost 0 and are discarded at the end.
  const size = Math.max(n, m)
  const BIG = 1e12
  const c = (i: number, j: number): number =>
    i < n && j < m ? cost[i]![j]! : i < n || j < m ? BIG : 0

  const u = new Array<number>(size + 1).fill(0)
  const v = new Array<number>(size + 1).fill(0)
  const p = new Array<number>(size + 1).fill(0)
  const way = new Array<number>(size + 1).fill(0)

  for (let i = 1; i <= size; i++) {
    p[0] = i
    let j0 = 0
    const minv = new Array<number>(size + 1).fill(Infinity)
    const used = new Array<boolean>(size + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0]!
      let delta = Infinity
      let j1 = 0
      for (let j = 1; j <= size; j++) {
        if (used[j]) continue
        const cur = c(i0 - 1, j - 1) - u[i0]! - v[j]!
        if (cur < minv[j]!) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j]! < delta) {
          delta = minv[j]!
          j1 = j
        }
      }
      for (let j = 0; j <= size; j++) {
        if (used[j]) {
          u[p[j]!] = u[p[j]!]! + delta
          v[j] = v[j]! - delta
        } else {
          minv[j] = minv[j]! - delta
        }
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]!
      p[j0] = p[j1]!
      j0 = j1
    } while (j0 !== 0)
  }

  const out = new Array<number>(n).fill(-1)
  for (let j = 1; j <= size; j++) {
    const i = p[j]! - 1
    if (i >= 0 && i < n && j - 1 < m) out[i] = j - 1
  }
  return out
}

/**
 * Match two slides' drawables for a Magic Move.
 *
 * Pass 1 partitions by CLASS; pass 2 pairs within each class by minimum
 * total centre travel. See the module header for why identity cannot
 * come from the deck (zero shared ids across every consecutive pair in
 * the deck) and why class alone cannot decide (85% of shapes share a
 * class with a same-slide sibling).
 *
 * `maxTravel`, when given, refuses a pair that would glide further than
 * that many slide units — the assignment's last resort against pairing
 * two unrelated instances of a common icon across an entire tableau
 * rebuild. Left undefined (the default) nothing is refused, which is the
 * behaviour the deck's own pairs want: the largest genuine glide
 * measured here is 1237 slide units, most of a canvas width, and it is
 * real motion the footage shows.
 */
export const matchSlides = (
  aItems: readonly Matchable[],
  bItems: readonly Matchable[],
  maxTravel?: number,
): SlideMatch => {
  const byKey = new Map<string, { a: Matchable[]; b: Matchable[] }>()
  for (const a of aItems) {
    const slot = byKey.get(a.key) ?? { a: [], b: [] }
    slot.a.push(a)
    byKey.set(a.key, slot)
  }
  for (const b of bItems) {
    const slot = byKey.get(b.key) ?? { a: [], b: [] }
    slot.b.push(b)
    byKey.set(b.key, slot)
  }

  const taken = new Map<Matchable, Matchable>()
  const travels = new Map<Matchable, number>()
  for (const { a, b } of byKey.values()) {
    if (a.length === 0 || b.length === 0) continue
    const cost = a.map((x) => {
      const cx = boxCentre(x.box)
      return b.map((y) => {
        const cy = boxCentre(y.box)
        return Math.hypot(cy.x - cx.x, cy.y - cx.y)
      })
    })
    const picked = assign(cost)
    for (let i = 0; i < a.length; i++) {
      const j = picked[i]!
      if (j < 0) continue
      const d = cost[i]![j]!
      if (maxTravel !== undefined && d > maxTravel) continue
      taken.set(a[i]!, b[j]!)
      travels.set(a[i]!, d)
    }
  }

  // A's own z-order is the pair order — the same convention `matchRoots`
  // keeps ("in A's structural order").
  const pairs: SlidePair[] = []
  const matchedB = new Set<Matchable>()
  const outs: Matchable[] = []
  for (const a of aItems) {
    const b = taken.get(a)
    if (!b) {
      outs.push(a)
      continue
    }
    matchedB.add(b)
    pairs.push({ a, b, travel: travels.get(a) ?? 0 })
  }
  const ins = bItems.filter((b) => !matchedB.has(b))
  return { pairs, outs, ins }
}

// ---------------------------------------------------------------------------
// The glide
// ---------------------------------------------------------------------------

/**
 * The similarity taking A's box onto B's, in WORLD units.
 *
 * `scale` is the box ratio and `x`/`y` the world-space offset that lands
 * A's scaled centre on B's centre. Because a `Slide` bakes geometry in
 * place, this is what a matched part's transform params are driven to —
 * the part starts at identity (its own composed position) and ends here.
 *
 * The y offset is NEGATED because the slide frame is y-DOWN and the
 * world is y-up (`slidePointToWorld` performs the same flip for points).
 * Scale needs no flip: it is a ratio.
 */
export interface Glide {
  x: number
  y: number
  scale: number
}

/** How far a pair's two box ratios disagree — 0 when it scales evenly. */
export const anisotropy = (pair: SlidePair): number => {
  const rw = pair.a.box.w > 1e-9 ? pair.b.box.w / pair.a.box.w : 1
  const rh = pair.a.box.h > 1e-9 ? pair.b.box.h / pair.a.box.h : 1
  const mean = (rw + rh) / 2
  return mean > 1e-9 ? Math.abs(rw - rh) / mean : 0
}

/**
 * The glide a matched pair performs, given the world scale a Slide's
 * `height` implies (`slideToWorld`).
 *
 * `Holon.scale` is one scalar, so a pair whose width and height ratios
 * differ glides on their MEAN — see the header, where the frequency of
 * that case is measured and `anisotropy` reports it per pair.
 */
export const glideOf = (pair: SlidePair, scale: number): Glide => {
  const a = pair.a.box
  const b = pair.b.box
  const rw = a.w > 1e-9 ? b.w / a.w : 1
  const rh = a.h > 1e-9 ? b.h / a.h : 1
  const s = a.w > 1e-9 && a.h > 1e-9 ? (rw + rh) / 2 : a.w > 1e-9 ? rw : rh
  const ca = boxCentre(a)
  const cb = boxCentre(b)
  // In slide units the part must move by (cb − s·ca) − (ca − s·ca) =
  // cb − ca, about its own composed position, with the scale applied
  // about the SLIDE origin — which is the canvas centre in world space.
  // Working in world units directly: the holon's group scales about its
  // own origin (the slide's centre), so a part sitting at world p ends
  // at s·p + offset, and offset must satisfy s·pa + offset = pb.
  const pax = (ca.x - 960) * scale
  const pay = -(ca.y - 540) * scale
  const pbx = (cb.x - 960) * scale
  const pby = -(cb.y - 540) * scale
  return { x: pbx - s * pax, y: pby - s * pay, scale: s }
}

/**
 * Every drawn primitive under a holon whose opacity actually paints.
 *
 * The same problem `Slides.ts`'s `opacityOf` solves and for the same
 * reason: the renderer reads opacity per drawn primitive with no parent
 * inheritance, and a `DottedLine` or a `Connection` draws nothing itself
 * — it parents one Line per dash. Setting the parent's opacity changes
 * no pixel.
 */
const inkOf = (holon: Holon): Holon[] => {
  if (holon instanceof DottedLine) {
    void holon.parts
    return holon.dashes
  }
  if (holon instanceof Connection) return holon.drawn()
  return [holon]
}

/** Opacity anims reaching every drawn primitive under a holon. */
const fadeTo = (holon: Holon, v: number): Anim[] => inkOf(holon).map((d) => d.opacity.to(v))

/**
 * The parts a page composed for one deck drawable id.
 *
 * A shape with several subpaths maps to several parts (and a filled one
 * to a `SlideFill` as well), which is why `Slide.byId` holds an array —
 * a glide must move all of them together.
 */
const partsOf = (page: Slide, id: string): Holon[] => {
  void page.parts
  return page.byId.get(id) ?? []
}

/**
 * MAGIC MOVE, as an Anim over two pages.
 *
 * The A page's matched parts glide to where B's are and its unmatched
 * parts fade out over the window's first `BUILD_FRACTION`; the B page's
 * unmatched parts fade in over its last. At the very end A is dropped
 * and B is lit — one frame's swap at the moment the two are geometrically
 * coincident, which is what makes the crossing invisible.
 *
 * THE CALLER STAGES BOTH PAGES AND OWNS THE CLOCK. This returns the
 * shape of the crossing only; where it sits in time is measured from the
 * footage, exactly as a build's onset is (Builds.ts's division, and
 * DECISIONS' refused-fits rule). The window it is played over should be
 * the deck's own declared `duration` — 2.0s for 41 of the 44, 1.5s for
 * the other 3.
 *
 * PRECONDITION: the caller has staged A visible and B dark
 * (`magicMoveSetup`), because a page composes finished and both would
 * otherwise be on screen at once.
 */
export const magicMoveAnim = (from: Slide, to: Slide, match: SlideMatch): Anim => {
  const scale = slideToWorld(from.height.value)
  const items: Windowed[] = []

  for (const pair of match.pairs) {
    const glide = glideOf(pair, scale)
    for (const part of partsOf(from, pair.a.id)) {
      // The transform is driven on the PART, over the whole window, on
      // the C4D auto-tangent ease both Magic Move levels share
      // (`smooth`, imported from src/transitions.ts) — Keynote's own
      // default timing curve for this transition is ease-in-ease-out and
      // the deck customises it nowhere (`customTimingCurveType` is
      // absent on all 58 transitions, and absence is the default).
      items.push(part.x.to(glide.x))
      items.push(part.y.to(glide.y))
      items.push(part.scale.to(glide.scale))
    }
  }

  for (const out of match.outs) {
    for (const part of partsOf(from, out.id)) {
      for (const anim of fadeTo(part, 0)) items.push([anim, 0, BUILD_FRACTION])
    }
  }
  for (const enter of match.ins) {
    for (const part of partsOf(to, enter.id)) {
      for (const anim of fadeTo(part, 1)) items.push([anim, 1 - BUILD_FRACTION, 1])
    }
  }

  return items.length > 0 ? together(...items) : { tracks: [] }
}

/**
 * The instantaneous swap that ends a Magic Move: A's matched parts go
 * dark and B's take over.
 *
 * Played as a zero-length `set` at the window's end. It is a SWAP and
 * not a cross-fade, and the footage is why: through the middle of a
 * glide each head in `f_01088` is a single clean outline in transit, not
 * two overlapping ghosts at half strength. Cross-fading a matched pair
 * would double every stroke's ink for the whole window.
 */
export const magicMoveSwap = (from: Slide, to: Slide, match: SlideMatch): Anim => {
  const items: Anim[] = []
  for (const pair of match.pairs) {
    for (const part of partsOf(from, pair.a.id)) items.push(...fadeTo(part, 0))
    for (const part of partsOf(to, pair.b.id)) items.push(...fadeTo(part, 1))
  }
  // A's unmatched parts have already faded; B's have already arrived.
  // The connection lines are the exception worth naming: they are
  // excluded from matching (they are rebuilt from endpoints, not read),
  // so the outgoing page's mesh belongs to the outgoing page and the
  // incoming page's to the incoming one.
  for (const line of from.connections) items.push(...fadeTo(line, 0))
  for (const line of to.connections) items.push(...fadeTo(line, 1))
  return items.length > 0 ? together(...items) : { tracks: [] }
}

/**
 * Stage the two pages for a Magic Move: A fully lit, B dark except for
 * nothing — every one of B's parts starts dark and is lit either by the
 * fade-in (unmatched) or by the swap (matched).
 *
 * A page composes FINISHED (Slides.ts), so without this both tableaux
 * are on screen at once — the same lesson `cutIn` records.
 */
export const magicMoveSetup = (from: Slide, to: Slide): Anim => {
  const items: Anim[] = []
  for (const part of pageInk(from)) items.push(...fadeTo(part, 1))
  for (const part of pageInk(to)) items.push(...fadeTo(part, 0))
  return items.length > 0 ? together(...items) : { tracks: [] }
}

/** Every drawable a page put on screen — strokes, connections, labels. */
export const pageInk = (page: Slide): Holon[] => {
  void page.parts
  return [...page.strokes, ...page.connections, ...page.labels]
}

/**
 * A whole page's Magic Move onto the next, matched and staged in one
 * call — the ordinary use.
 *
 * The connection lines deliberately do NOT glide. They are recomputed
 * from their endpoints rather than read (Slides.ts's one exception, and
 * 25% of the deck's stored paths are stale), so a connection has no
 * authored geometry to interpolate: what it joins has moved, and the
 * line belongs to whichever page owns those endpoints. Through the
 * window the outgoing page's mesh is on screen and glides only insofar
 * as it is ink on the outgoing page; the incoming page's arrives with
 * the swap. That is visible in the reference and accepted rather than
 * hidden — see `p6-magicmove.md`, which measures what it costs on the
 * mesh transitions and what it costs on the rest (nothing).
 */
export const magicMove = (from: Slide, to: Slide, maxTravel?: number): SlideMatch =>
  matchSlides(matchablesOf(from), matchablesOf(to), maxTravel)

/**
 * FADE THROUGH COLOR — the deck's other real transition, 10 of 58.
 *
 * A whole-page dissolve: A's ink ramps to nothing over the first half of
 * the window and B's up from nothing over the second, through the
 * background colour in between (which on this deck's black stage is
 * simply darkness, so no colour needs painting). Included because it is
 * the OTHER side of the same boundary question and it is four lines —
 * not because a chapter asked.
 */
export const fadeThroughAnim = (from: Slide, to: Slide): Anim => {
  const items: Windowed[] = []
  for (const part of pageInk(from)) {
    for (const anim of fadeTo(part, 0)) items.push([anim, 0, 0.5])
  }
  for (const part of pageInk(to)) {
    for (const anim of fadeTo(part, 1)) items.push([anim, 0.5, 1])
  }
  return items.length > 0 ? together(...items) : { tracks: [] }
}

/** A transition record whose effect this chapter does not implement. */
export const unsupportedTransition = (effect: string | undefined): boolean =>
  effect !== undefined && !SUPPORTED_TRANSITIONS.has(effect)

/** Named for the report: the deck's own smooth, re-exported unchanged. */
export { smooth, buildIn, buildOut, BUILD_FRACTION }

/** A `Stroke`/`Text` type guard the demo scenes use when reporting. */
export const isDrawn = (holon: Holon): boolean =>
  holon instanceof Stroke || holon instanceof Text || holon instanceof Connection
