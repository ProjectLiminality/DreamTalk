/**
 * Checkpoint capture — Magic Move within a scene (ONTOLOGY.md "Magic
 * Move", case 1; EDITOR-V5 "Checkpoint capture").
 *
 * The live layer already holds exactly the posed-vs-timeline diff: every
 * overridden param with its value IS the pose. Capture turns that diff
 * into ONE semantic op (appendCheckpoint) that writes a transition clip
 * into the DreamWeaving after the clip the playhead sits in — and the
 * daemon's reload round-trip then releases the pose naturally, because
 * the remount builds a fresh (empty) override store while the timeline
 * now plays INTO the captured pose. Committing a pose IS authoring
 * animation; nothing here adds a second ontology.
 *
 * Three pure functions carry the logic (testable without a browser):
 * holonPathOf spells a holon the way the scene's own code does,
 * captureTargets filters the overrides against the timeline's values at
 * t, and placementAt maps the playhead to the play() statement the new
 * clip follows. mountCheckpoint is only the affordance: one quiet chip
 * riding the playhead, visible exactly when a capturable pose exists
 * while paused; cmd+K captures from the keyboard.
 */

import type { Dream } from "../src/dream"
import type { Holon } from "../src/holon"
import type { Clip } from "../src/timeline"
import type { Overrides } from "./overrides"
import { anchorOf, type SourceAnchor } from "./anchors"

export interface CaptureTarget {
  /** The param as the scene's code addresses it: `this.circle.x`. */
  path: string
  value: number | boolean
}

export interface Placement {
  placement: "after" | "before" | "end"
  anchor?: SourceAnchor
}

/**
 * The field-name chain from the Dream to a holon — `circle`,
 * `pair.left`, `fan.blades[1]` — or undefined where no hand-written name
 * reaches it (an anonymous part must not be mis-addressed). The names
 * come from the objects themselves, exactly as the outline reads them.
 */
export const holonPathOf = (dream: object, holon: Holon): string | undefined => {
  const segments: string[] = []
  let node: Holon = holon
  while (node.parent) {
    const segment = segmentIn(node.parent, node)
    if (!segment) return undefined
    segments.unshift(segment)
    node = node.parent
  }
  const root = segmentIn(dream, node)
  if (!root) return undefined
  segments.unshift(root)
  return segments.join(".")
}

/** The property (or indexed array slot) `owner` knows `holon` by. */
const segmentIn = (owner: object, holon: Holon): string | undefined => {
  for (const [key, value] of Object.entries(owner)) {
    if (value === holon) return key
    if (Array.isArray(value)) {
      const i = value.indexOf(holon)
      if (i >= 0) return `${key}[${i}]`
    }
  }
  return undefined
}

/** Positions land on the centi-unit (the drag's own rounding); angles keep radians honest. */
const roundFor = (kind: string, v: number): number =>
  kind === "angle" ? Math.round(v * 1e4) / 1e4 : Math.round(v * 1e2) / 1e2

/**
 * The pose as code-addressable targets: every live override whose value
 * actually differs from what the timeline (or, for a param time never
 * touches, the value it displaced) would show at t. Colors and params
 * without a spellable path are skipped — a capture must never write an
 * address nobody gave.
 */
export const captureTargets = (
  dream: Dream,
  overrides: Overrides,
  t: number,
): CaptureTarget[] => {
  const timeline = dream.build()
  const targets: CaptureTarget[] = []
  for (const entry of overrides.entries()) {
    const { param, value, displaced } = entry
    if (typeof value !== "number" && typeof value !== "boolean") continue
    const owner = param.owner as Holon | undefined
    if (!owner || !param.name) continue
    const holonPath = holonPathOf(dream, owner)
    if (!holonPath) continue
    const baseline = overrides.animates(param) ? timeline.valueAt(param, t) : displaced
    if (typeof value === "boolean") {
      if (value === baseline) continue
      targets.push({ path: `this.${holonPath}.${param.name}`, value })
      continue
    }
    const rounded = roundFor(param.kind, value)
    if (typeof baseline === "number" && roundFor(param.kind, baseline) === rounded) continue
    targets.push({ path: `this.${holonPath}.${param.name}`, value: rounded })
  }
  return targets
}

/**
 * Where the checkpoint goes: after the play() the playhead is inside (or
 * has last passed — a wait belongs to the clip before it), before the
 * first play() when the playhead precedes them all, at the end of
 * unfold() when nothing is anchored. Only play() clips carry anchors —
 * set() instants never place a checkpoint.
 */
export const placementAt = (clips: readonly Clip[], t: number): Placement => {
  const anchored = clips
    .map((clip) => ({ clip, anchor: anchorOf(clip as unknown as object) }))
    .filter((c): c is { clip: Clip; anchor: SourceAnchor } => c.anchor !== undefined)
  if (anchored.length === 0) return { placement: "end" }
  let landed: { clip: Clip; anchor: SourceAnchor } | undefined
  for (const candidate of anchored) {
    if (candidate.clip.start <= t + 1e-9) landed = candidate
  }
  if (landed) return { placement: "after", anchor: landed.anchor }
  return { placement: "before", anchor: anchored[0]!.anchor }
}

// --- The affordance ---------------------------------------------------------

export interface CheckpointOpts {
  dream: Dream
  overrides: Overrides
  /** #track — the chip positions itself on the same axis as the playhead. */
  track: HTMLElement
  isPlaying: () => boolean
  currentT: () => number
  /** The scene's own file — the op target when no clip anchor names one. */
  sceneFile: () => string
  send: (op: Record<string, unknown>) => void
  signal: AbortSignal
}

export interface CheckpointHandle {
  /** Re-derive visibility and position — called from the paint path. */
  sync(): void
  /** The current pose as the op would spell it — headless verification. */
  targets(): CaptureTarget[]
  /** Where a capture would land, with the clip/anchor map — diagnostics. */
  placement(): Record<string, unknown>
  /** Send the op for the current pose; resolves to it, or undefined. */
  capture(duration?: number): Promise<Record<string, unknown> | undefined>
  dispose(): void
}

export const mountCheckpoint = (opts: CheckpointOpts): CheckpointHandle => {
  const { dream, overrides, track, signal } = opts
  const duration = dream.duration

  // A remount mounts afresh into the same #track — never two chips.
  track.querySelector("#capchip")?.remove()
  const chip = document.createElement("button")
  chip.id = "capchip"
  chip.textContent = "capture pose ⌘K"
  chip.title = "write this pose into the scene as a transition clip (cmd+K)"
  track.appendChild(chip)

  // The timeline's own axis: origin at the earliest clip (a scene may
  // start before zero), so the chip and the playhead agree on where t is.
  const earliest = dream.clips.reduce((min, c) => Math.min(min, c.start), 0)
  const span = (duration > 0 ? duration : 1) - earliest
  const frac = (t: number): number => (t - earliest) / span

  let sent = false

  const poseExists = (): boolean =>
    !opts.isPlaying() && !sent && captureTargets(dream, overrides, opts.currentT()).length > 0

  const sync = () => {
    const on = poseExists()
    chip.style.display = on ? "" : "none"
    if (!on) return
    // Clamped to stay readable at the edges; centred on the playhead.
    const f = Math.max(0.05, Math.min(0.95, frac(opts.currentT())))
    chip.style.left = `${f * 100}%`
  }

  const capture = async (
    clipSeconds = 1,
  ): Promise<Record<string, unknown> | undefined> => {
    if (opts.isPlaying() || sent) return undefined
    const t = opts.currentT()
    const targets = captureTargets(dream, overrides, t)
    if (targets.length === 0) return undefined
    const { placement, anchor } = placementAt(dream.clips, t)
    const file = anchor?.file ?? opts.sceneFile()
    let baseHash: string | undefined
    try {
      const res = await fetch(`/api/source?file=${encodeURIComponent(file)}`)
      if (res.ok) baseHash = ((await res.json()) as { hash: string }).hash
    } catch {}
    const op: Record<string, unknown> = {
      type: "op",
      op: "appendCheckpoint",
      file,
      placement,
      anchor: anchor ? { start: anchor.start, end: anchor.end } : undefined,
      targets,
      duration: clipSeconds,
      baseHash,
    }
    opts.send(op)
    // The reload round-trip remounts with a fresh override store — that IS
    // the release. Until it lands, the chip just says the pose is on its way.
    sent = true
    chip.textContent = "captured"
    chip.classList.add("sent")
    return op
  }

  chip.addEventListener(
    "pointerdown",
    (e) => {
      // The track underneath scrubs on pointerdown — a capture must not
      // also move the playhead out from under its own pose.
      e.stopPropagation()
      void capture()
    },
    { signal },
  )
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.code === "KeyK" && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        void capture()
      }
    },
    { signal },
  )

  const unsubscribe = overrides.subscribe(sync)
  sync()

  return {
    sync,
    targets: () => captureTargets(dream, overrides, opts.currentT()),
    placement: () => ({
      t: opts.currentT(),
      ...placementAt(dream.clips, opts.currentT()),
      clips: dream.clips.map((c) => ({
        start: c.start,
        duration: c.duration,
        anchored: anchorOf(c as unknown as object) !== undefined,
      })),
    }),
    capture,
    dispose() {
      unsubscribe()
      chip.remove()
    },
  }
}
