/**
 * Density01.ts — A DreamWeaving
 *
 * "Project Liminality" (2023), the density peak: deck slides 11, 12 and
 * 13, video seconds 199.4 to 220.0. Thirty-five campfires kindling one
 * by one across the whole frame; then, on one click, seventy arrowed
 * lines striking through them at once; then the field collapsing by
 * Magic Move into a single social organism, which divides.
 *
 * Chapter P-10's gate, and the campaign's last build chapter. The row
 * called it DENSITY — "slide 11's 140 shapes / 70 connections / 105
 * groups / 105 builds in 15s is the performance ceiling, and 17 events
 * in 15s is the densest timing in the video. Everything else must work
 * first."
 *
 * Under the standing instruction that a row title is a hypothesis, the
 * census says the row is right about the SCALE and wrong about what is
 * hard in it. Nothing here strains the renderer. What deck 11 turned out
 * to be is the FIRING MODEL's discriminator — the one slide in the deck
 * that carries both of Keynote's two automatic-advance cases side by
 * side, under otherwise identical declarations, so that the footage can
 * tell them apart.
 *
 * WHAT THE CENSUS DEMANDED
 *
 * 1. THE STRUCTURE IS SEVEN CLUSTERS OF FIVE, NOT FOURTEEN OF SEVEN.
 *
 * The recon describes "a field of ~14 miniature social organisms, each
 * itself a 7-node dotted mesh". It is seven clusters of five nodes, each
 * a complete K5 — 7 x 10 = 70 lines over 35 nodes, exactly as P-4
 * predicted for this chapter from the other side. The seven clusters are
 * translated copies of one another to a maximum deviation of 0.0010
 * slide units, so the tableau is one cluster placed seven times.
 *
 * Each node is a group of a Fire_80 over two Head_652 icons — a campfire
 * with two people at it, the same motif slide 7 introduced at full size.
 * Every one of the 70 Head_652 carries a black fill, so every node
 * composes a SlideFill alongside its outline (P-5's capability, trusted
 * at this scale per the amendment); the fills are what keep the far
 * heads from showing through the near ones where clusters overlap.
 *
 * 2. THE LINES ARE P-4's MACHINERY UNCHANGED, AND ALL SEVENTY CARRY A HEAD.
 *
 * This is the slide P-1 flagged when it found arrowheads at all: 70 of
 * the deck's 142 end decorations are here, one on every line. All are
 * `simple arrow` — the filled triangle (0,0) (3,6) (6,0) with endPoint
 * (3,0) — so P-4's identity dispatch never has to reach its `filled
 * circle` or tail branches on this slide. That it was BUILT to is what
 * makes the 70 safe: a renderer that assumed one convention would have
 * been right here and silently wrong elsewhere.
 *
 * All 70 are quadratic, 2.0 wide, solid (no dash), with `outset` 10/10
 * at both ends. All 140 endpoints are GROUPS and every one resolves by
 * P-4's recursive union — zero fall through to a stored path.
 *
 * THE OUTSET VERDICT, which the brief asked for: 10/10 behaves. Every
 * one of the 70 corridors reaches a peak ink-hit rate of 1.000 in the
 * settled frame (mean 1.000 over 70 lines), sampled on the recomputed
 * path with both endpoint boxes excluded. There is no residual here of
 * the kind slide 8's 30/30 left OPEN at best-sd 11.3. That does not
 * settle slide 8 — a different outset value on a different geometry
 * class (lines to campfire GROUPS whose members' ellipse dominates the
 * silhouette) — but it does say the outset FIELD is read correctly and
 * that 11.3 was not a defect in how the field is applied. Slide 8's
 * residual stays open, and now with the narrower reading that whatever
 * it is, it is specific to that slide's geometry.
 *
 * 3. THE FIRING MODEL — THE CHAPTER'S REAL SUBJECT.
 *
 * Deck 11 declares 105 builds in 105 chunks: two clicks (chunk 0 and
 * chunk 35) and 103 automatic. Read through the rule the campaign had
 * settled — an automatic chunk fires one declared duration after its
 * predecessor — the 70-line cascade alone runs 69 x 2.25 + 2.25 =
 * 157.5 seconds. The segment is 15.0 seconds long.
 *
 * That looks exactly like P-9's truncation finding (deck 16 declares 24
 * Out builds that never fire), and the brief asked me to check it. IT IS
 * NOT TRUNCATION. All seventy lines are fully drawn and settled at
 * f_01064, t = 212.6s, with 1.4 seconds of hold to spare. Nothing is cut
 * off. The cascade simply is not a cascade.
 *
 * THE FIELD THAT SAYS SO is `referent` on the build chunk, which the
 * decoder was dropping. Its reading, established here and now carried in
 * the model (KeyBuildChunk.referent):
 *
 *     automatic + referent: true   — fires one declared duration after
 *                                    its predecessor (a step);
 *     automatic + referent: false  — fires WITH its referent, i.e.
 *                                    simultaneously, no step at all.
 *
 * Deck 11 is the discriminator because BOTH cases occur on ONE slide,
 * with the same `automatic: true`, the same `chunkId: 1`, the same click
 * structure — everything the campaign had been reading is identical
 * across the two groups, and only `referent` differs:
 *
 *     chunks 0-34    35 dissolve      all referent: true
 *     chunks 35-104  70 LineDraw      1 referent: true + 69 false
 *
 * MEASURED, per node, on each node's own box, in the deck's own declared
 * chunk order (frames 996-1074):
 *
 *     199.40 199.80 200.00 200.40 200.60 201.00 201.20 201.60 201.80
 *     202.20 202.40 202.80 203.00 203.40 203.60 204.00 204.20 204.60
 *     204.80 205.20 205.40 205.80 206.00 206.40 206.60 207.00 207.20
 *     207.60 207.80 208.20 208.40 208.80 209.00 209.40 209.60
 *
 * Thirty-five firings, in the declared order element for element, least-
 * squares step 0.3000s against a declared 0.30 — RATIO 1.0000, residual
 * sd 0.050s, a quarter of one frame interval. That is the sharpest
 * confirmation of the stepping rule anywhere in the campaign: 35 steps,
 * one slide, no pooling across slides.
 *
 * MEASURED, per line, on each line's own quadratic corridor with BOTH
 * endpoint node boxes excluded so a node's ink cannot be mistaken for a
 * line's (frames 1048-1069, 70 lines):
 *
 *     onsets span 211.20 to 211.60 — 0.40s TOTAL, two frame intervals,
 *     least-squares step in chunk order 0.0007s against a declared 2.25
 *     (ratio 0.0003), mean peak corridor hit-rate 1.000.
 *
 * Seventy lines firing inside two frames is not a 157-second chain. They
 * fire together, and `referent: false` is the deck saying so.
 *
 * IT RETRODICTS EVERY MEASUREMENT ON RECORD, which is what raises it
 * above a reading that merely fits this slide. Checked against each:
 *
 *   deck 8  (P-4): 10 chunks, all referent: true — steps. P-4 measured
 *                  ten firings ~0.5s apart. Agrees.
 *   deck 15 (P-5): all referent: true — steps. P-5 measured automatic
 *                  gaps at 0.995-1.008x declared. Agrees.
 *   deck 16 (P-9): chunks 1-11 and 13-23 are referent: FALSE, with
 *                  chunk 12 (true) between them. P-9 measured twelve
 *                  heads arriving together (sd 0.013s), twelve spokes
 *                  arriving together (sd 0.126s), and exactly ONE 2.0s
 *                  step separating the groups (1.900s measured). P-9 had
 *                  to account for this as "the model at a density where
 *                  twelve steps fit inside one frame". The field states
 *                  it outright, and the arithmetic is no longer a
 *                  coincidence of sampling.
 *   deck 43 (P-8): chunk 8 is referent: FALSE. P-8 reported precisely
 *                  this chunk as "ONE new-shape apparent exception
 *                  (fires WITH its predecessor) reported unresolved".
 *                  RESOLVED.
 *   deck 53 (P-7): chunks 1-2 are referent: FALSE. P-7 measured its two
 *                  LineDraws LEADING the fade-and-move by 0.68s where
 *                  the chunk list said they trail by 2.0s, and recorded
 *                  it as the campaign's second chunk-order exception.
 *                  RESOLVED — they are simultaneous, and the residual
 *                  0.68s is the ease, not the order.
 *   deck 56 (P-8): chunk 1's action-scale is referent: FALSE, firing
 *                  with the motion path. Same shape as P-7's three
 *                  bc-appear arrows, which P-7 explained through
 *                  effective duration.
 *   deck 59 (P-9): all 34 referent: true — 33 strict steps, which is
 *                  what P-9 measured. Agrees.
 *
 * So both standing chunk-order exceptions were the same fact, and P-7's
 * "effective duration" refinement was a correct description of a case
 * the format states directly. What it does NOT explain: deck 59's
 * unexplained 0.85-0.87x stepping ratio. Deck 11's own steps measure
 * 1.0000x, so that anomaly is untouched and stays open.
 *
 * 4. THE DRAW DIRECTION — A FALLBACK MEETING THE EDGE OF ITS PREMISE.
 *
 * None of the 105 builds declares a `direction`, so all seventy lines
 * take the absent-is-default path, and this chapter's first mid-draw
 * composite showed every one of them with our front and the reference's
 * as mirror images — P-4's exact signature for direction 53, arrived at
 * from the other side.
 *
 * It is not 53. `drawsReversed`'s fallback derives its answer from a
 * premise P-3 measured on deck 2: "the deck's connection lines run
 * between a centre and a periphery, and the footage shows them drawing
 * centre-outward". True of deck 2. Deck 11's lines run between two nodes
 * of one five-node cluster, so "further from the slide's centre" is
 * nearly a coin toss between two points a few dozen units apart.
 *
 * Measured, per line, at f_01055 (~0.4s into the 2.25s draw), corridor
 * sampled with both endpoint node boxes excluded:
 *
 *     draws from the `from` end : 56 / 70
 *     draws from the `to`   end :  0 / 70
 *     ambiguous                 : 14 / 70
 *     page-centre fallback agrees with the footage : 31 / 70
 *
 * Zero counter-examples in seventy lines, against a fallback performing
 * at chance. On this slide the stored order IS the draw order, and the
 * scene says so through `Slide.drawsInStoredOrder` rather than by
 * changing the fallback: two slides now disagree about the absent case
 * with footage behind each, and flipping the shared default on P-10's
 * evidence would move P-3's arc. The disagreement is left visible.
 *
 * 5. TWO DRAW-ON GAPS THESE FRAMES FOUND, NEITHER VISIBLE WHEN SETTLED.
 *
 * The connection draw-on distributed its dashes over uniform windows —
 * a LINEAR front where Keynote's is kEaseBoth. Measured on front
 * position over the 20 longest lines, duration held at the declared
 * 2.25 and only the offset free: eased fits at rms 0.0120 against
 * linear's 0.0617, 5.1x better, and pointwise the footage tracks the
 * eased curve (at t=211.2, eased predicts 0.405 and the measurement is
 * 0.397, where linear says 0.444). The campaign's EIGHTH independent
 * kEaseBoth confirmation, on a build class P-8 never used.
 *
 * And the arrowhead was drawn LAST, on the assumption that it "arrives
 * at the end of the shaft because that is where the shaft reaches it".
 * The footage carries it AT THE ADVANCING FRONT from the first frame.
 * Measured on the 25 longest lines: ink in the far 15% of each corridor
 * is 0.000 at every frame while the front advances 0.164 -> 0.540. A
 * head waiting at its final position would read ~1.0 there.
 *
 * Both were routed rather than changed here (they are P-4's files), both
 * have since landed, and both moved these frames as predicted — the two
 * mid-draw scores went from 0.8215/0.7890 on coverage_ours to
 * 0.9575/0.9586, and P-4's own long-standing deck-9 mid-draw FAIL
 * crossed to PASS on the same change. See p10-density.md §4.
 *
 * WHY THIS SCENE DERIVES ITS ONSETS RATHER THAN LISTING THEM
 *
 * Every prior chapter hand-listed a measured onset per build, which is
 * right when the onsets are independent measurements. Here they are not:
 * two clicks are measured from the footage, and the other 103 firings
 * follow from the deck's own declared structure through the rule above.
 * Listing 105 numbers would present 103 derivations as if they were 105
 * measurements, and would let a wrong rule hide inside a correct-looking
 * list. `firingTimes` below computes them, so the rule is what is on
 * trial and the two measured numbers are visibly the only free ones.
 *
 * Per the refused-fits rule: the two CLICKS are footage-measured (they
 * exist only in the footage — David clicking live), every DURATION is
 * read from the deck, and no duration was adjusted to make an onset
 * land.
 *
 * DECK 12 AND 13 — THE MAGIC MOVE THAT DIVIDES THE ORGANISM
 *
 * Both are held tableaux with ZERO builds, arrived at by Magic Move, so
 * like P-4's slide 14 they are pure geometry: 30 dotted lines each (two
 * K6 meshes), 12 `Head with Shoulders_826`, one red ring.
 *
 * What the census shows and the footage confirms is that deck 12's two
 * meshes are SUPERIMPOSED — its twelve head centres are six positions
 * each occupied twice, to the unit: (640,106) (856,237) (856,472)
 * (640,599) (425,472) (425,237), listed twice. So deck 12 draws as one
 * six-person organism, and decks 13 and 14 pull the two coincident
 * meshes apart. That is the content of this run of slides: one organism
 * dividing, told entirely through Magic Move on matched objects, with
 * not a single build.
 *
 * The scene renders their held states. The Magic Move BETWEEN them is
 * P-6's verb and is not reimplemented here; the frames scored are the
 * settled holds on either side, which is what the segment methodology
 * asks for anyway.
 *
 * THE BOUNDARIES, from this chapter's own sweep of frames 965-1145
 * (sweep, never landmark; the amendment's corollary that a boundary can
 * hide between near-identical slides is why decks 12/13/14 were
 * separated by SHAPE CENSUS — head-centre positions — rather than by
 * correlation):
 *
 *     deck 10 fades out 196.6-197.8; black 197.8-199.2 (ink exactly 0)
 *     deck 11  199.40 first ink (chunk 0) .. 213.4 last held frame
 *              nodes settle 209.8-210.2; lines 210.4-212.6; hold to 213.4
 *     deck 12  214.6 in .. 216.0, settled hold 215.4-216.0
 *     deck 13  216.2 Magic Move .. settled hold 218.4
 *     deck 14  220.0 on (P-4's, already corrected to 220.2-223.8)
 *
 * The recon's table gives slide 11 as 199.4-214.4 and slide 14 as
 * 219.4-227.0. The 199.4 start is confirmed exactly. The others move:
 * deck 11 is over by 214.2 (ink 0), and decks 12 and 13 have settled
 * holds the recon's row for "12" (214.4-217.0) and "13" (217.0-219.4)
 * only roughly bracket.
 *
 * THE SCENE RUNS ON VIDEO SECONDS, as Mesh01 and Arc01 do — `at(t)`
 * advances to video second t, so every number reads directly against
 * refs/pitch/pl02/frames5 (frame N is video second (N-1)/5).
 */

import { Dream, render } from "../../src/index"
import { together, type Anim } from "../../src/anim"
import { Slide } from "../../vocabulary/Slides/Slides"
import type { SlideData, KeyBuildChunk } from "../../src/geometry/keynote"
import { slide11, slide12, slide13 } from "../../vocabulary/Slides/assets/pl02/index"

/**
 * The two measured clicks on deck 11, and nothing else.
 *
 * `at` is the video second the chunk at `chunk` fires. Both are read off
 * the footage, and both by P-3's method where the ramp allows it —
 * invert the deck's OWN declared curve through the measured ink and
 * solve for the offset only, never for the duration.
 *
 * The first is the first ink in the frame after deck 10's fade to black
 * (f_00998, t = 199.40); a 0.30s dissolve sampled at 5 fps gives at most
 * two points on its ramp, so the frame itself is the measurement and
 * 0.2s is the honest resolution. The 35 steps that follow it land at
 * ratio 1.0000, which is the check on it.
 *
 * The second IS fitted properly, because seventy simultaneous 2.25s
 * draws give a clean ramp. The observable is each line's FRONT POSITION
 * — the furthest contiguous fraction of its own corridor that has lit —
 * averaged over the twenty longest lines, with the duration held at the
 * declared 2.25 and only the offset free:
 *
 *     eased  best onset 210.200s, rms 0.0120
 *     linear best onset 210.190s, rms 0.0617
 *
 * So 210.20, and Keynote's ease fits 5.1x better than linear on a build
 * class and a slide P-8 never used — the campaign's eighth independent
 * confirmation of kEaseBoth, thrown off by this measurement rather than
 * sought.
 *
 * TWO WRONG READINGS OF THIS ONSET ARE WORTH RECORDING, because both
 * produced a plausible number:
 *
 * The ink DEPARTS the settled 22,656 plateau at f_01053 (210.4), and
 * reading that frame as the onset puts the click 0.2s late — an eased
 * build's visible start is not its onset, since a 2.25s ramp has
 * revealed only 4% of its length there.
 *
 * Fitting TOTAL INK instead of front position gives 210.145 and a worse
 * separation (2.3x rather than 5.1x), because ink is not proportional to
 * drawn length here: the arrowhead rides at the advancing front from the
 * first frame (see the DIRECTION section), so every line contributes a
 * head's worth of ink before it has any length. Fitting the contaminated
 * observable moved the answer by 0.055s and looked fine doing it.
 */
const CLICKS: readonly { chunk: number; at: number }[] = [
  { chunk: 0, at: 199.4 }, // the 35-node dissolve cascade opens
  { chunk: 35, at: 210.2 }, // …and every one of the 70 lines strikes at once
]

/**
 * The firing model, applied: turn a chunk list into a firing time each.
 *
 * A click chunk takes its measured time. An automatic chunk with
 * `referent: true` fires one predecessor-duration later. An automatic
 * chunk with `referent: false` fires WITH its referent — the most recent
 * chunk that was not itself a `referent: false` follower — so a run of
 * them all share one instant rather than each inheriting the last.
 *
 * P-7's refinement is kept: the wait is the predecessor's EFFECTIVE
 * duration, which for an instantaneous build is zero. Nothing on these
 * three slides is instantaneous, so it does not bite here; it is
 * expressed rather than assumed so that the function states the whole
 * rule and not the part this slide happens to need.
 */
export const firingTimes = (
  chunks: readonly KeyBuildChunk[],
  clicks: readonly { chunk: number; at: number }[],
): Map<string, number> => {
  const at = new Map<string, number>()
  const clickAt = new Map(clicks.map((c) => [c.chunk, c.at]))
  /** When the current referent fired, and how long it runs. */
  let referentTime = 0
  let referentDuration = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!
    if (!chunk.automatic) {
      // A click. Its time is measured; nothing derives it.
      referentTime = clickAt.get(i) ?? referentTime
      referentDuration = chunk.duration
    } else if (chunk.referent) {
      // A step: one effective duration after the referent.
      referentTime = referentTime + referentDuration
      referentDuration = chunk.duration
    }
    // else: referent false — fires WITH the referent, which means both
    // `referentTime` and `referentDuration` stay put, so the NEXT step
    // still measures from the referent rather than from this follower.
    at.set(chunk.build, referentTime)
  }
  return at
}

/** The pages, with the video seconds each is cut in and out at. */
const PAGES: readonly {
  data: SlideData
  clicks: readonly { chunk: number; at: number }[]
  from: number
  to: number
}[] = [
  { data: slide11, clicks: CLICKS, from: 199.4, to: 213.4 },
  { data: slide12, clicks: [], from: 215.4, to: 216.0 },
  { data: slide13, clicks: [], from: 218.4, to: 219.8 },
]

/**
 * Reference frames, one settled and two mid-cascade per the methodology.
 *
 * The mid-cascade frames are chosen to test the two firing cases against
 * each other: f_01030 sits 26 nodes into the 35-step cascade (a settled
 * frame cannot see a step at all), and f_01055/f_01057 sit 0.6 and 1.0s
 * into the seventy simultaneous draws, where a stepped reading would
 * have drawn one line and a simultaneous reading draws seventy part-way.
 * Those are where a wrong firing model is visible and nowhere else.
 *
 * They also caught both draw-on gaps in §4 — the linear front and the
 * arrowhead's position — neither of which any settled frame can see.
 */
export const SCORED = [
  { frame: 1030, seg: 11, at: 205.8 }, // MID-STEP: 26 of 35 nodes
  { frame: 1051, seg: 11, at: 210.0 }, // the 35 nodes settled, before the lines
  { frame: 1055, seg: 11, at: 210.8 }, // MID-DRAW: 70 lines together, ~0.3 in
  { frame: 1057, seg: 11, at: 211.2 }, // MID-DRAW: 70 lines together, ~0.45 in
  { frame: 1064, seg: 11, at: 212.6 }, // deck 11 settled: all 70 lines in
  { frame: 1080, seg: 12, at: 215.8 }, // deck 12 settled hold
  { frame: 1093, seg: 13, at: 218.4 }, // deck 13 settled hold
] as const

export class Density01Dream extends Dream {
  pages = PAGES.map((p) => {
    const page = new Slide({ data: p.data })
    // Deck 11's seventy lines declare no `direction`, and the page-centre
    // fallback's premise does not hold on them — see the header's
    // DIRECTION section and Slide.drawsInStoredOrder. Measured here:
    // 56 of 70 draw from the stored `from` end, 0 from the `to` end.
    // Decks 12 and 13 have no builds at all, so the flag is deck 11's.
    if (p.data.index === 11) page.drawsInStoredOrder = true
    return page
  })

  /** The scene cursor in VIDEO seconds. */
  #now = 0

  /** Play an Anim at an ABSOLUTE video second (Mesh01's fix). */
  private playAt(anim: Anim, at: number, runTime: number): void {
    const clip = this.play(anim, runTime)
    clip.start = at
    this.#now = Math.max(this.#now, at + runTime)
  }

  /** A cut — a zero-duration step at an absolute video second. */
  private setAt(at: number, ...anims: Anim[]): void {
    for (const anim of anims) {
      const clip = this.play(anim, 0)
      clip.start = at
    }
    this.#now = Math.max(this.#now, at)
  }

  unfold() {
    this.observer.look("front")

    for (const page of this.pages) {
      this.setAt(0, page.creation.to(1), page.visible(false), page.preBuild())
    }

    for (let i = 0; i < PAGES.length; i++) {
      const spec = PAGES[i]!
      const page = this.pages[i]!

      this.setAt(spec.from, page.cutIn())
      if (i > 0) this.setAt(spec.from, this.pages[i - 1]!.visible(false))

      const chunks = spec.data.buildChunks ?? []
      if (chunks.length === 0) continue
      const times = firingTimes(chunks, spec.clicks)

      // Group by firing instant. On deck 11 that yields 35 groups of one
      // (the stepping dissolves) and ONE group of seventy (the lines) —
      // the shape of the tableau's timing, made structural rather than
      // transcribed.
      const byInstant = new Map<number, string[]>()
      for (const chunk of chunks) {
        const t = times.get(chunk.build)
        if (t === undefined) continue
        const group = byInstant.get(t)
        if (group) group.push(chunk.build)
        else byInstant.set(t, [chunk.build])
      }

      for (const [at, group] of [...byInstant].sort((a, b) => a[0] - b[0])) {
        const anims: Anim[] = []
        let span = 1
        for (const id of group) {
          const record = spec.data.builds.find((b) => b.id === id)
          if (!record) continue
          const chunk = chunks.find((c) => c.build === id)
          // The DURATION is the deck's; the ONSET is derived from the
          // deck's structure and the two measured clicks.
          span = chunk?.duration ?? record.duration ?? 1
          anims.push(page.build(record))
        }
        if (anims.length === 0) continue
        this.playAt(together(...anims), at, span)
      }
    }

    // The last page holds to the end of its segment; `wait` moves the
    // cursor but adds no clip, so the timeline needs a parked one.
    const last = this.play({ tracks: [] }, 0)
    last.start = 220.0
    this.#now = Math.max(this.#now, 220.0)
  }
}

if (import.meta.main) render(Density01Dream)
