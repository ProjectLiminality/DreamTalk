/**
 * Web3Song.ts — A DreamSong
 *
 * "Liminal Consulting — Decentralizing Web3 Insights" (2024), whole: the
 * seventeen shots as chapters of ONE composition, carrying David's own
 * voice-over. Like OriginsPitch there is no global offset: song time T IS
 * video time, so reference frame refs/web3/frames/f_000NN sits at T ≈ NN and
 * the song's 171.0s is the video's 170.97s.
 *
 * THE CHAPTERS, AND WHERE EACH WINDOW CAME FROM
 *
 * Every boundary below was read off the final render at 4fps (frames
 * extracted from LiminalConsultingWeb3Final.mov, 0.25s apart), not taken from
 * the recon's 1fps table:
 *
 *   ch  shots  scene               in      window          into it
 *    1   1     Shot01Globe          0.00    0.00 –   4.50   —
 *    2   2–3   YinYang (+dive)      4.00    4.00 –  21.50   crossfade 0.5
 *    3   4–5   Web2 (retimed)      19.75   19.75 –  31.75   crossfade 1.75
 *    4   6     Shot06Web3Word      30.75   30.75 –  46.75   crossfade 1.0
 *    5   7–8   Clarity (retimed)   45.00   45.00 –  61.50   crossfade 1.75
 *    6   9     Shot09Quote         61.50   61.50 –  78.75   cut
 *    7  10–11  NodeNet (retimed)   78.75   78.75 –  94.50   cut
 *    8  12     Shot12Vitruvian     93.75   93.75 – 108.05   crossfade 0.75
 *    9  13     Light (retimed)    105.30  105.30 – 120.40   slide 2.75
 *   10  14     Callback (retimed) 117.85  117.85 – 130.50   dip 2.55
 *   11  15     Hero (retimed)     130.00  130.00 – 146.80   crossfade 0.5
 *   12  16     Portrait (retimed) 144.25  144.25 – 158.75   slide 2.55
 *   13  17     Closing (retimed)  158.75  158.75 – 171.00   cut
 *
 * THE THREE MOVES BETWEEN SHOTS, measured at 30fps:
 *
 *  - The DIVE (19.6–21.5): the yin-yang never stops spinning — four turns
 *    and a fifth from 11.0, still at full speed (YinYang.ts) — and the
 *    camera dollies straight in on the figure's CENTRE, not on the blue
 *    node, while the crossfade into Web2 (19.75–21.5, DIVE_FADE) dims it to black. The
 *    blue node swells and swings across in front of the camera, off-centre
 *    and moving, which is what makes it read as a dive into it. Web2's
 *    camera starts where the dive ends, so the crossfade's one camera keeps
 *    going in rather than pulling back; it resets to the front in the black.
 *  - The two PUSHES (105.3–108.05, 144.25–146.8): `slide()` (src/song.ts)
 *    carries the outgoing scene up and off the top while the next rises from
 *    below, butted edge to edge, on the film's own push curve (PUSH); the
 *    first also dissolves through it (PUSH1_DISSOLVE). The portrait
 *    arrives whole — ring and plate already there, as the frames have
 *    them — and its words come after it lands.
 *
 * RETIMED, NOT REBUILT. Six set-pieces were scored standalone at their own
 * pace, which the final render does not keep. Each is subclassed below with
 * an unfold() that keeps every holon and changes only WHEN things happen,
 * measured from the frames. The set-pieces themselves are untouched.
 *
 * THE VOICE-OVER
 *
 * David's fourteen recordings (Video/Audio/01_…14_*.m4a) were placed by
 * cross-correlating each against the final mix's audio — chunk by chunk, so
 * that the edits inside a take showed up as jumps in its offset. Several
 * takes were cut in the original edit (01 loses its false start, 02 its
 * retake of 01, 04 is three pieces with tightened gaps, 06 is one of three
 * "Vitalik put it best"s), so the cache holds the USED pieces, each imported
 * under the exact words it says (scripts/import-voice.ts, voice "David").
 * Each line's slot is the measured length of its recording, stated in the
 * score — never read from audio at play time.
 *
 * Two recordings are NOT placed, because they are not in the final mix:
 * 07_if_the_thing (David reading the quote — the mix correlates with
 * VitalikQuote.mp3 at 63.3s instead) and 14_I_would_love (an alternate take;
 * 13 already says those words). The Vitalik quote keeps the voice the Quote
 * holon already carries — that choice is David's and is not made here.
 * No soundtrack: the 3Blue1Brown score is David's call too.
 */

import { DreamSong } from "../../src/song"
import { crossfade, slide } from "../../src/transitions"
import { together } from "../../src/anim"
import { Create, FadeIn, FadeOut } from "../../src/verbs"
import { Write } from "../../src/parts/text"
import { TAU } from "../../src/constants"
import { DEFAULT_DISTANCE } from "../../src/dream"
import { Circle, Line } from "../../src/parts/primitives"
import { c4dEaseWith, ease } from "../../src/timeline"
import { Shot01GlobeDream } from "./Shot01Globe"
import { YinYangDream } from "./YinYang"
import { Web2DisintegratingDream } from "./Web2Disintegrating"
import { Shot06Web3WordDream } from "./Shot06Web3Word"
import { ClarityFieldDream, CLARITY_RADIUS, HERO_RING_RADIUS } from "./ClarityField"
import { Shot09QuoteDream } from "./Shot09Quote"
import { NodeNetworkDream } from "./NodeNetwork"
import { Shot12VitruvianDream } from "./Shot12Vitruvian"
import { LightSpreadDream, SPIN_END } from "./LightSpread"
import { Shot14CallbackDream } from "./Shot14Callback"
import { Shot15HeroDream } from "./Shot15Hero"
import { PortraitCardDream } from "./PortraitCard"
import { ClosingDream } from "./Closing"

// --- the dive (19.6–21.5) ----------------------------------------------

/**
 * The dive, measured at 30fps by fitting each node's ring per frame: the
 * camera never leaves the figure's centre — node separation and ring sizes
 * agree on one magnification, and the centre they imply stays within 0.5px
 * of the frame's. It DOLLIES straight in, its distance falling on one C4D
 * ease-in from 19.6 to 21.5 to 0.15 of where it stood (×1.3 by 20.4, ×2.3 by
 * 21.0), arriving at full speed as the crossfade dims it out. It reads as a
 * dive into the blue node because that node is swelling and swinging in
 * front of it — the spin is still at full speed — not because the camera
 * aims at it.
 */
const DIVE_START = 15.6 // local; the chapter opens at 4.0 → song 19.6
const DIVE_SPAN = 1.9
/** The camera's distance at the end of the dive, as a fraction of its own. */
const DIVE_DEPTH = 0.15
/**
 * The dive's fade to black, measured as screen brightness (the frame's
 * brightest lines, 30fps): it begins at 19.75 and eases in — 0.92 at 20.5,
 * 0.72 at 20.9, 0.37 at 21.3, black at 21.5 — one C4D ease-in, left tangent
 * 0.85 (RMS 0.5%). It is the crossfade into Web2, whose picture is still
 * dark until 22.
 */
const DIVE_FADE_START = 19.75
const DIVE_FADE = { smoothing: { left: 0.85, right: 0 }, screen: true }
/** The figure's own framing (YinYangDream: zoom 0.82). */
const YINYANG_ZOOM = 0.82
/** The dive's camera distance at song t (the yin-yang chapter opens at 4.0). */
const diveRadius = (t: number) =>
  DEFAULT_DISTANCE * (1 - (1 - DIVE_DEPTH) * ease("easeIn", (t - 4 - DIVE_START) / DIVE_SPAN))

/**
 * The two pushes' tangents, measured off both at 30fps (the outgoing and
 * incoming pictures' offsets, by correlation): one Keynote curve, eased in
 * 0.4 and out 0.45 — longer than the 1–1.5s the quarter-second frames
 * suggested, which is why they seemed to start "faster": they had already
 * started. RMS under 1% of a frame-height on each.
 */
const PUSH = { left: 0.4, right: 0.45 }

/**
 * The first push also DISSOLVES: split at the seam, the Vitruvian's
 * brightest line and the globe's sum to one all the way through — one
 * fading out as the other fades in, 105.5–107.6 on a 0.35/0.35 curve
 * (RMS 1%, measured as screen brightness), so both stand at about half
 * as they pass. The second push keeps full brightness throughout.
 */
/**
 * Into the callback, measured at 10fps: not a cross but a DIP through
 * black — the lit globe goes 117.85–119.05 (tangents 0.4/0.05) and only
 * then does the field come in, 119.05–120.4 (tangents 0/0.5), both read as
 * screen brightness (RMS ~1%).
 */
const CALLBACK_DIP = {
  dip: 1.2 / 2.55,
  smoothing: { left: 0.4, right: 0.05 },
  inSmoothing: { left: 0, right: 0.5 },
  screen: true,
}

const PUSH1_DISSOLVE = { start: 0.2, end: 2.3, smoothing: { left: 0.35, right: 0.35 }, screen: true }

/** Shots 2–3, and the dive out of them (the dim is the crossfade into Web2,
 *  which opens at 19.75). */
class YinYangShot extends YinYangDream {
  override unfold() {
    // Scored first, at its absolute place, then the cursor goes back to 0
    // for the figure's own beats.
    this.wait(DIVE_START)
    this.play(this.observer.radius.to(DEFAULT_DISTANCE * DIVE_DEPTH, { easing: "easeIn" }), DIVE_SPAN)
    this.wait(-(DIVE_START + DIVE_SPAN))
    super.unfold()
  }
}

// --- the retimed set-pieces ---------------------------------------------

/**
 * Shots 4–5: fades in whole at 21.75–23, holds, collapses from 25.25. Its window
 * opens at 19.75, under the dive's fade (DIVE_FADE): its camera RETRACES
 * the dive, so the crossfade's single camera keeps travelling inward
 * instead of pulling back out, and resets to the front in the black at 21.5.
 */
class Web2Shot extends Web2DisintegratingDream {
  override unfold() {
    this.observer.look("front")
    // The crossfade lerps the two cameras, so this one runs the dive's own
    // curve, keyed every 50ms, and the lerp changes nothing.
    this.set(this.observer.zoom.to(YINYANG_ZOOM), this.observer.radius.to(diveRadius(DIVE_FADE_START)))
    this.stage(this.lattice)
    const steps = Math.round((21.5 - DIVE_FADE_START) / 0.05)
    for (let i = 1; i <= steps; i++) {
      const t = DIVE_FADE_START + (i * (21.5 - DIVE_FADE_START)) / steps
      this.play(this.observer.radius.to(diveRadius(t), { easing: "linear" }), (21.5 - DIVE_FADE_START) / steps)
    }
    this.set(this.observer.zoom.to(1), this.observer.radius.to(DEFAULT_DISTANCE))
    // The lattice fades in whole, 21.75–23.0; the base starts to give at
    // 25.25 and the release front climbs at a near-constant pace (0.1 of
    // the height by 26, 0.33 by 28, 0.65 by 31) — linear, and it would
    // finish at 37, long after the cut.
    this.wait(0.25)
    this.play(this.assemble.creation.to(1, { easing: "linear" }), 1.25)
    this.wait(2.25)
    this.play(this.collapse.creation.to(1, { easing: "linear" }), 11.8)
  }
}

/**
 * Shots 7–8, measured at 30fps: the field fades up FRAME-FILLING behind the
 * word (45.05–45.45), holds a beat, then the whole of it — lattice, halo and
 * the ringlets themselves — contracts like a picture shrinking: 2.945× its
 * rest size at 45.70 down to rest at 47.75, C4D tangents 0.1/0.65 (RMS 1%
 * on the halo's median radius). The word shrinks with it (Shot06Word).
 * The clarity disc arrives 50–51.5.
 */
const FIELD_SPAN = 2.75 // the burst, 45.0–47.75
const FIELD_FROM = 2.945
const fieldScale = (t: number) =>
  t < 45.7 ? FIELD_FROM : 1 + (FIELD_FROM - 1) * (1 - c4dEaseWith((t - 45.7) / 2.05, 0.1, 0.65))

/**
 * Shot 6, ending as the frames do: once the field begins to contract
 * (45.70) the word shrinks with it — the same picture drawn in — until the
 * crossfade has taken it (46.75). Stated as camera zoom keys, 50ms apart.
 */
class Web3WordShot extends Shot06Web3WordDream {
  override unfold() {
    const offset = 30.75
    this.wait(45.7 - offset)
    let at = 45.7
    for (let t = 45.75; t <= 46.75 + 1e-9; t += 0.05) {
      this.play(this.observer.zoom.to(fieldScale(t) / FIELD_FROM, { easing: "linear" }), t - at)
      at = t
    }
    this.wait(-(at - offset))
    super.unfold()
  }
}

class ClarityShot extends ClarityFieldDream {
  protected override spreadAt(b: number): number {
    return fieldScale(45 + FIELD_SPAN * b)
  }
  protected override ringScale(b: number): number {
    return this.spreadAt(b)
  }
  protected override fadeAt(b: number): number {
    return Math.max(0, Math.min(1, (FIELD_SPAN * b - 0.05) / 0.4))
  }

  override unfold() {
    this.stageField()
    this.play(this.burst.creation.to(1, { easing: "linear" }), FIELD_SPAN)
    this.wait(2.25)
    this.play(this.clarity.creation.to(1), 1.5)
    this.wait(10)
  }
}

/**
 * Shots 10–11, as the frames show them (re-read at 1280w):
 *
 *  - 78.75–80.5  the clarity disc's dots are a tight cluster that EXPANDS
 *                into the node cloud (a camera pull-back, ease-out);
 *  - 85.5–86.5   the four crystals draw on ALL AT ONCE, one inside another
 *                at the centre, the icosahedron ~2.5× its final size and
 *                the others nested inside it — the "dense
 *                graph" is the four solids superimposed, not a mesh of the
 *                cloud — while the cloud's own dots fade (86–87);
 *  - 88.5–89.4   they part into a compact 2×2 about the centre (octahedron
 *                and icosahedron above at ±142, y +145; tetrahedron and cube
 *                below, y −128) and shrink to rest, turning throughout.
 *
 * The near-neighbour mesh the standalone scene wires is not staged.
 */
const NODE_IN = 78.75
/** How large each crystal stands while superimposed (oct, ico, tet, cube):
 *  the icosahedron is the outer cage, the others nest inside it. */
const OVERLAP = [1.6, 2.5, 1.2, 1.0]
const QUADS: readonly (readonly [number, number])[] = [
  [-142, 145],
  [142, 145],
  [-142, -128],
  [142, -128],
]

class NodeShot extends NodeNetworkDream {
  override unfold() {
    const crystals = [this.octa, this.icosa, this.tetra, this.cube]
    const rest = crystals.map((c) => c.radius.value)
    const edges = crystals.flatMap((c) => [...c.walk()].filter((h): h is Line => h instanceof Line))
    this.observer.look("front")
    this.set(
      this.observer.zoom.to(0.2),
      ...crystals.flatMap((c, i) => [c.x.to(0), c.y.to(0), c.radius.to(rest[i]! * OVERLAP[i]!)]),
      ...edges.map((l) => l.creation.to(0)),
    )
    this.stage(this.cloud)
    for (const c of crystals) this.stage(c)

    // The cluster expands into the cloud (78.75–80.5).
    this.play(
      together(
        [this.gather.creation.to(1), 0, 0.25],
        this.observer.zoom.to(1, { easing: "easeOut" }),
      ),
      1.75,
    )
    this.wait(85.5 - NODE_IN - 1.75)

    // The crystals draw on, superimposed (85.5–86.5); the cloud fades (86–87).
    this.play(
      together(
        ...crystals.map((c) => FadeIn(c)),
        ...edges.map((l) => l.creation.to(1)),
        [this.crystallise.creation.to(1), 0.5, 1],
      ),
      1.5,
    )
    this.wait(88.5 - 87)

    // They part into the 2×2 and come to rest (88.5–89.4).
    this.play(
      together(
        ...crystals.flatMap((c, i) => [
          c.x.to(QUADS[i]![0]),
          c.y.to(QUADS[i]![1]),
          c.radius.to(rest[i]!),
        ]),
      ),
      0.9,
    )
    this.wait(94.5 - 89.4)

    // Turning throughout, from the moment they appear.
    this.wait(-(94.5 - 85.5))
    this.play(
      together(...crystals.map((c) => c.spin.to(TAU * 0.5, { easing: "linear" }))),
      94.5 - 85.5,
    )
  }
}

/**
 * Shot 13: it rises under the Vitruvian (the slide, 105.3–108.05), the
 * outline globe turns 106–110.5, the insight ignites and floods
 * 110.5–113, the arcs wrap it 113–118. The standalone scene holds the
 * cursor for its placeholder narration before the arcs, which pushed them
 * past this chapter's cut; the song's timing is the frames'.
 */
class LightShot extends LightSpreadDream {
  override unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    this.outline.spin.follow(this.fill.spin.map((s) => s))
    for (const h of [this.fill, this.outline, this.hotspot, this.arcs]) this.stage(h)
    // It rises from 105.3, the push's start; its beats still start at 106.
    this.wait(0.7)
    // One continuous turn under all three beats (the frames never pause it).
    this.play(
      together(
        this.spin.creation.to(1, { easing: "linear" }),
        this.fill.spin.to(SPIN_END, { easing: "linear" }),
        [this.ignite.creation.to(1), 4.5 / 12, 7 / 12],
        // The land is lit at once; how much of it shows is the light's
        // spread (LightSpread.lightTheLand), not a flood.
        [this.fill.landOpacity.to(1), 4.4 / 12, 4.7 / 12],
        [this.spread.creation.to(1, { easing: "linear" }), 7 / 12, 1],
      ),
      12,
    )
    this.wait(2)
  }
}

/**
 * Shot 14, the swell re-measured at 4fps (the ring's radius, 1280w): it
 * starts at 123.0, not 125, and accelerates — 89px at 124.5, 131 at 126.5,
 * 177 at 128, 237 at 129.75 — stopping short of the hero's ring, which the
 * hero's own camera then carries the last 7% (HeroShot). The disc does not
 * empty as it grows: its lattice and dots stay, dimming only a little.
 */
const SWELL: readonly (readonly [number, number])[] = [
  [123.0, 75], [123.75, 81], [124.5, 89], [125.0, 99], [125.5, 109], [126.0, 119],
  [126.5, 131], [127.0, 145], [127.5, 159], [128.0, 177], [128.5, 193], [129.0, 209],
  [129.5, 227], [129.75, 237],
]
const CALLBACK_IN = 117.85
/** A screen colour handed to the host decoded (it encodes tints for display). */
const seenColor = (r: number, g: number, b: number) => {
  const d = (v: number) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return { r: d(r), g: d(g), b: d(b) }
}

/** The expand value at which the disc stands `px` pixels in radius. */
/**
 * The hero opens at this zoom (its ring 237px, not 253), and the callback's
 * camera eases there over the swell, so that under their crossfade — one
 * camera for both pictures — the swollen ring and the hero's ring coincide.
 */
const HERO_OPEN_ZOOM = 237 / 253
const callbackZoom = (t: number) => 1 - (1 - HERO_OPEN_ZOOM) * Math.max(0, Math.min(1, (t - 123) / 6.75))

const expandFor = (px: number, t: number): number => {
  const units = px / (1.28 * callbackZoom(t))
  const u = Math.max(0, Math.min(1, (units - CLARITY_RADIUS) / (HERO_RING_RADIUS - CLARITY_RADIUS)))
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (mid * mid * (3 - 2 * mid) < u) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

class CallbackShot extends Shot14CallbackDream {
  protected override dotFade(e: number): number {
    return 1 - 0.3 * e
  }
  /** Inside the swelling ring the lattice stays; the halo outside it goes
   *  (gone by 129.5 in the frames). */
  protected override fieldFade(e: number, r: number): number {
    return r < this.discRadius(e) ? 1 - 0.3 * e : 1 - Math.min(1, Math.max(0, (e - 0.2) / 0.55))
  }
  /** The ring is fully red by ~129.25 (e ≈ 0.75), lavender at 128. */
  protected override ringRed(e: number): number {
    const u = Math.min(1, Math.max(0, (e - 0.4) / 0.35))
    return u * u * (3 - 2 * u)
  }
  /**
   * The swollen disc is not dark between its lattice lines: the frames'
   * floor inside it is a dim red haze (~(25,8,6) on screen at 128–129.75,
   * flat across the disc — measured radially, it has no falloff), rising as
   * the disc swells. Ours was black there, ~10 levels darker throughout.
   */
  haze = new Circle({
    radius: this.expand.creation.map((e) => this.discRadius(e)),
    tint: seenColor(28, 9, 7),
    stroke: 0,
    fillOpacity: this.expand.creation.map((e) => {
      const u = Math.min(1, Math.max(0, e / 0.4))
      return u * u * (3 - 2 * u)
    }),
  })

  override unfold() {
    this.stage(this.haze)
    this.stageField()
    this.set(this.burst.creation.to(1), this.clarity.creation.to(1))
    this.wait(SWELL[0]![0] - CALLBACK_IN)
    this.play(this.observer.zoom.to(HERO_OPEN_ZOOM, { easing: "linear" }), 6.75)
    this.wait(-6.75)
    for (let i = 1; i < SWELL.length; i++) {
      const [t, px] = SWELL[i]!
      this.play(this.expand.creation.to(expandFor(px, t), { easing: "linear" }), t - SWELL[i - 1]![0])
    }
    this.wait(130.5 - 129.75)
  }
}

/**
 * Shot 15, arriving as the frames show (4fps, 130–133): it crossfades in
 * over the swollen disc (130.0–130.5) and comes up SLOWLY — the bloom eases
 * up over three seconds, the land is grey until ~131 and white by 131.5 —
 * while its camera carries the ring the last stretch (237 → 253px), easing
 * out by 133.
 */
class HeroShot extends Shot15HeroDream {
  constructor() {
    super()
    // Measured at 135s: ring (252,93,75), lattice (109,46,39) on screen —
    // handed over decoded, as the host encodes tints for display.
    this.ring.tint.value = seenColor(252, 93, 75)
    for (const h of this.lattice.members) (h as Circle).tint.value = seenColor(150, 58, 50)
    // The bloom, re-fitted to the frame's radial profile at 135s (its
    // whiteness 134/104/77/55/37/23/11 at 120–180px): a touch wider and
    // fainter in the middle than the standalone's.
    const n = this.bloom.members.length
    this.bloom.members.forEach((h, i) => {
      const c = h as Circle
      c.radius.value = (c.radius.value / (1.02 + i * 0.04)) * (1.02 + i * 0.046)
    })
    this.bloomLevel = (i: number) => 0.42 * (1 - i / n) ** 2.6
  }

  private bloomLevel = (_i: number) => 0

  override unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(HERO_OPEN_ZOOM))
    this.stage(this.bloom)
    this.stage(this.lattice)
    this.stage(this.rays)
    this.stage(this.globe)
    this.stage(this.ring)
    const bloomLevels = this.bloom.members.map((h, i) =>
      h.opacity.to(this.bloomLevel(i), { easing: "easeOut" }),
    )
    this.play(
      together(
        this.observer.zoom.to(1, { easing: "easeOut" }),
        [together(this.globe.landOpacity.to(1, { easing: "linear" }), this.globe.oceanOpacity.to(1)), 0, 0.5],
        together(...bloomLevels),
        // Brighter than the standalone 0.55: its tint is now the decoded (darker) red.
        together(...this.lattice.members.map((h) => h.opacity.to(0.9))),
        [together(...this.rays.members.map((h) => h.opacity.to(0.85))), 0.05, 0.6],
        this.globe.spin.to(0.1, { easing: "linear" }),
      ),
      3,
    )
    this.play(this.globe.spin.to(-0.25, { easing: "linear" }), 13.8)
  }
}

/**
 * Shot 16: it rises in WHOLE under the hero (the slide, 144.25–146.8 — ring
 * and photograph already there in every frame of the push), the words at
 * 146–147, held to 156.5, gone by 157.25.
 */
class PortraitShot extends PortraitCardDream {
  override unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(1))
    for (const h of [this.plate, this.ring, this.label, this.note]) this.stage(h)
    this.set(this.ring.creation.to(1), this.plate.opacity.to(1))
    this.wait(1.75)
    this.play(together(FadeIn(this.label), [FadeIn(this.note), 0.3, 1]), 1)
    this.wait(9.5)
    this.play(
      together(FadeOut(this.ring), FadeOut(this.plate), FadeOut(this.label), FadeOut(this.note)),
      0.75,
    )
  }
}

/**
 * Shot 17, in the order the frames show — blue circle (158.75–160), the A
 * (160–161), THEN the red circle (161–162.5), the title (163.5–165) — and it
 * holds to the end of the film. The standalone scene draws both circles
 * together and fades out; the final render does neither.
 */
/**
 * Re-measured at 1280w (2026-10-04): the logo is drawn 0.786× as large as
 * the standalone (blue ring 155.5px in radius, centred 70px above the
 * frame's middle), the title centred 210px below it at the same width as
 * before. And the order and pace, at 2fps:
 *
 *   158.75–159.5  the blue ring FADES in, whole (it is not drawn);
 *   160.0–161.0   the A's two legs draw up from their feet together;
 *   161.0–162.0   the red ring draws;
 *   162.6–164.25  the title writes (ink width 67/161/325/549px of 587 at
 *                 162.75/163/163.5/164).
 */
const CLOSING_ZOOM = 0.786
const TITLE_Y = -222
const TITLE_SIZE = 80

class ClosingShot extends ClosingDream {
  /** The A's right leg, drawn up from its foot beside the left. */
  rightLeg: Line

  constructor() {
    super()
    // The title is Manim's serif in the final render.
    this.title.font = "Times-Roman"
    this.title.size.value = TITLE_SIZE
    this.title.y.value = TITLE_Y
    const [footL, apex, footR] = this.mark.points
    this.mark.points = [footL!, apex!]
    this.rightLeg = new Line({ points: [footR!, apex!], tint: this.mark.tint, stroke: this.mark.stroke })
  }

  override unfold() {
    this.observer.look("front")
    this.set(this.observer.zoom.to(CLOSING_ZOOM))
    this.stage(this.rightLeg)
    this.play(FadeIn(this.blue), 0.75)
    this.wait(0.5)
    this.play(together(Create(this.mark), Create(this.rightLeg)), 1)
    this.play(Create(this.red), 1)
    this.wait(0.6)
    this.play(Write(this.title), 1.65)
    this.wait(6.75)
  }
}

// --- the voice-over -----------------------------------------------------

/**
 * Every line of the final mix: [start (s), stated length (s), words, voice].
 * Start = where the piece sits in the mix (cross-correlation, see header);
 * length = the imported piece's ffprobe duration.
 */
export const WEB3_VOICEOVER: readonly (readonly [number, number, string, string?])[] = [
  [3.94, 6.3, "As most of us can feel by now, we are living through an unprecedented period in human history."],
  [11.01, 7.9, "Never before have our collective challenges seemed more daunting, and our dreams of a more beautiful world seemed more within reach."],
  [20.27, 9.2, "As the era of centralization is coming to an end, with our top-down control structures slowly but surely disintegrating under their own weight,"],
  [29.47, 4.03, "A new culture has emerged around the idea of Web3,"],
  [33.51, 5.8, "seeking to direct this enormous potential towards a more beautiful and decentralized future."],
  [40.41, 12.2, "However, as of now, the understanding of how these decentralized technologies this collective genius is creating actually work remains centralized to a comparably small class of developers,"],
  [52.95, 6.9, "constituting one of the most crucial remaining bottlenecks for building a more resilient and decentralized future."],
  [60.47, 2.0, "Vitalik put it best:"],
  // The quote, in the voice the Quote holon carries — the exact line and
  // voice QuoteDemo speaks, so the recording already in the cache answers.
  [63.28, 7.93, "\"If the thing technically runs on 50,000 computers but only 42 people know how it works, your decentralization-index is not 50,000 — it's 42.\"", "VitalikButerin"],
  [73.3, 2.7, "So, how do we address this issue?"],
  [77.62, 5.7, "The by far most effective means for spreading the light of understanding are visual metaphors."],
  [83.97, 2.9, "Symbols that help people connect the dots"],
  [87.5, 3.95, "and perceive the clarity behind the complexity."],
  [93.36, 8.87, "A visual way of communicating ideas, much more fundamental than the many different languages spoken around the world today."],
  [102.36, 2.6, "A universal language"],
  [105.71, 1.75, "for a universal movement,"],
  [107.48, 10.96, "not limited by superficial differences in location or cultural background, but united by the greater cause of serving all of mankind."],
  [118.45, 16.89, "By upgrading our capacity to communicate these profound ideas with clarity, we can effectively widen the circle of understanding and thus unleash this movement's full potential in bringing about the more beautiful world our hearts know is possible."],
  [136.27, 20.18, "If you are holding a piece of this puzzle that has the potential to change the world but as of now is not being widely understood as such, I would love to help you communicate your unique innovation to this space so it can naturally attract the minds and resources that will help you make it a reality."],
]

/** David's voice — the name the recordings were imported under. */
export const DAVID_VOICE = "David"

export class Web3Dream extends DreamSong {
  constructor() {
    super([
      { scene: Shot01GlobeDream, span: 4.5 }, //            0.00 –   4.50
      [{ scene: YinYangShot, span: 17.5 }, crossfade(0.5)], //  4.00 –  21.50 (dive)
      [{ scene: Web2Shot, span: 12 }, crossfade(1.75, DIVE_FADE)], // 19.75 – 31.75
      [{ scene: Web3WordShot, span: 16 }, crossfade(1)], // 30.75 – 46.75
      [{ scene: ClarityShot, span: 16.5 }, crossfade(1.75)], // 45.00 –  61.50
      { scene: Shot09QuoteDream, span: 17.25 }, //          61.50 –  78.75
      { scene: NodeShot, span: 15.75 }, //                  78.75 –  94.50
      [{ scene: Shot12VitruvianDream, span: 14.3 }, crossfade(0.75)], // 93.75 – 108.05
      [{ scene: LightShot, span: 15.1 }, slide(2.75, PUSH, PUSH1_DISSOLVE)], // 105.30 – 120.40 (push up)
      [{ scene: CallbackShot, span: 12.65 }, crossfade(2.55, CALLBACK_DIP)], // 117.85 – 130.50
      [{ scene: HeroShot, span: 16.8 }, crossfade(0.5)], //   130.00 – 146.80
      [{ scene: PortraitShot, span: 14.5 }, slide(2.55, PUSH)], // 144.25 – 158.75 (push up)
      { scene: ClosingShot, span: 12.25 }, //               158.75 – 171.00
    ])
  }

  /**
   * The voice-over is the SONG's score, not any chapter's: the chapters'
   * own placeholder say() lines are not carried (DreamSong places clips,
   * not narration). Placed first, at absolute times, then the cursor is
   * returned to 0 for the chapters.
   */
  override unfold(): void {
    let cursor = 0
    for (const [start, duration, text, voice] of WEB3_VOICEOVER) {
      this.wait(start - cursor)
      cursor = start
      this.say(text, { voice: voice ?? DAVID_VOICE, duration })
    }
    this.wait(-cursor)
    super.unfold()
  }
}
