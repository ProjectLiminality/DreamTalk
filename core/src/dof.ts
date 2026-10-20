/**
 * DEGREES OF FREEDOM — which of a scene's dimensions a viewer may move along.
 *
 * A hyperobject offers three kinds: the AXES of its walkable state space
 * (src/automaton.ts), the LEVELS its symbols unpack into (editor/nest.ts),
 * and the SLOTS it declares for a presenter (Dream.slots). A demo rarely
 * wants all of them: the mask switches some off. A switched-off one
 * disappears — an axis has no key, no handle, no hand target, no HUD row,
 * no place in the minimap; a level refuses to open; a slot does not recall —
 * and the scene holds that axis where it stands (at its home, `escape`,
 * when it has one). Nothing in the Dream knows: the mask sits over
 * gatherStateSpace, as rekey's masking does (an axis's `when` ANDed).
 *
 * IDS, stable and readable: `axis:<id>` (the gathered id, `grain#2` for a
 * repeat), `level:<name>` (the nest path's spelling, levelNameOf), `slot:<k>`
 * (1–9). A scene's default is `Dream.preset()`: ids to on/off, where
 * `axis:*`, `level:*`, `slot:*` and `*` set a whole kind (an exact id wins,
 * then its kind's `*`, then `*`; unnamed is on). The viewer's toggles are
 * kept as overrides of that preset — in localStorage and in the URL as
 * `&dof=-axis:grain,slot:3` (`-` off, bare on), so a link carries them.
 */

export type DofKind = "axis" | "level" | "slot"

/** A scene's default: ids (or `kind:*`, `*`) to on/off. Unnamed ids are on. */
export type DofPreset = Readonly<Record<string, boolean>>

/** One degree of freedom as the settings panel lists it. */
export interface Dof {
  id: string
  kind: DofKind
  label: string
  /** What it is listed under (an axis's owner, "levels", "slots"). */
  group: string
}

export const dofId = {
  axis: (id: string) => `axis:${id}`,
  level: (name: string) => `level:${name}`,
  slot: (k: number) => `slot:${k}`,
}

const kindOf = (id: string): string => id.slice(0, Math.max(0, id.indexOf(":")))

/** The live mask: the scene's preset with the viewer's toggles over it. */
export class DofMask {
  readonly preset: DofPreset
  readonly #own = new Map<string, boolean>()
  readonly #listeners = new Set<() => void>()
  /** Bumped on every change — a cheap "did it move?" for whoever caches. */
  version = 0

  constructor(preset: DofPreset = {}, overrides: Readonly<Record<string, boolean>> = {}) {
    this.preset = preset
    for (const [id, on] of Object.entries(overrides)) if (this.#preset(id) !== on) this.#own.set(id, on)
  }

  #preset(id: string): boolean {
    const p = this.preset
    return p[id] ?? p[`${kindOf(id)}:*`] ?? p["*"] ?? true
  }

  on(id: string): boolean {
    return this.#own.get(id) ?? this.#preset(id)
  }

  /** The automaton's question (AxisMask). */
  axisOn = (id: string): boolean => this.on(dofId.axis(id))
  levelOn = (name: string): boolean => this.on(dofId.level(name))
  slotOn = (k: number): boolean => this.on(dofId.slot(k))

  set(id: string, on: boolean): void {
    this.setAll([id], on)
  }

  /** Several at once — one change. */
  setAll(ids: readonly string[], on: boolean): void {
    let moved = false
    for (const id of ids) {
      if (this.on(id) === on) continue
      if (this.#preset(id) === on) this.#own.delete(id)
      else this.#own.set(id, on)
      moved = true
    }
    if (moved) this.#changed()
  }

  /** Back to the scene's preset. */
  reset(): void {
    if (!this.#own.size) return
    this.#own.clear()
    this.#changed()
  }

  /** The viewer's toggles, where they differ from the preset. */
  overrides(): Record<string, boolean> {
    return Object.fromEntries([...this.#own].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
  }

  /** Called after every change; returns the unsubscribe. */
  subscribe(fn: () => void): () => void {
    this.#listeners.add(fn)
    return () => this.#listeners.delete(fn)
  }

  #changed(): void {
    this.version++
    for (const fn of [...this.#listeners]) fn()
  }
}

/** Overrides as the URL holds them: `-axis:grain,slot:3` (`-` off, bare on). */
export const encodeDof = (overrides: Readonly<Record<string, boolean>>): string =>
  Object.entries(overrides)
    .map(([id, on]) => (on ? id : `-${id}`))
    .join(",")

export const decodeDof = (code: string | null | undefined): Record<string, boolean> => {
  const out: Record<string, boolean> = {}
  for (const part of (code ?? "").split(",")) {
    const s = part.trim()
    if (!s) continue
    if (s.startsWith("-")) out[s.slice(1)] = false
    else out[s.replace(/^\+/, "")] = true
  }
  return out
}

/** May presenter slot k recall — itself on, and every level the scene's slot k opens? */
export const slotOpen = (mask: DofMask, k: number, slot?: { nest?: readonly string[] }): boolean =>
  mask.slotOn(k) && (slot?.nest ?? []).every((name) => mask.levelOn(name))

/**
 * What a scene offers, as the panel lists it: its gathered axes grouped by
 * their owner's class (the scene's own first), the levels its symbols unpack into, its
 * slots. Plain data in, so any host (player, editor, a test) can list them.
 */
export const dofsOf = (scene: {
  axes: readonly { id: string; label: string; owner?: object }[]
  levels?: readonly string[]
  slots?: readonly { name: string }[]
}): Dof[] => {
  const out: Dof[] = []
  // Grouped by the owner's class: a gallery of twelve Pallets is one group (its rows "load", "load #2", …).
  const groupOf = (owner?: object): string => (owner ? owner.constructor.name.replace(/(?<=[A-Za-z])\d+$/, "") || "holon" : "scene")
  const axes = [...scene.axes.filter((a) => !a.owner), ...scene.axes.filter((a) => a.owner)]
  for (const a of axes) out.push({ id: dofId.axis(a.id), kind: "axis", label: a.label, group: groupOf(a.owner) })
  for (const name of scene.levels ?? []) out.push({ id: dofId.level(name), kind: "level", label: name.replace(/Dream$/, "") || name, group: "levels" })
  scene.slots?.forEach((s, i) => out.push({ id: dofId.slot(i + 1), kind: "slot", label: `${i + 1} · ${s.name}`, group: "slots" }))
  return out
}
