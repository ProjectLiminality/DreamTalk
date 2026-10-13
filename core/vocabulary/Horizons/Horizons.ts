/**
 * Horizons — WHEN do we care, about WHAT, and WHO cares.
 *
 * From David's whiteboard (2026-10-13): time runs right (t), "what do we
 * care about" runs down through the domains — supply chain & operations,
 * sales, strategy. The planning horizons nest from the corner where the
 * axes meet: OPERATIONAL (13 weeks) reaches only operations; TACTICAL (12
 * months) reaches operations and sales — S&OP lives at its edge; STRATEGIC
 * (years) is open. The people who own each concern stand in their cells,
 * and a role nobody holds yet is drawn in the certainty language: a ghost,
 * a superposition of who it might be, that crystallises when it is filled.
 *
 * THE DEGREES OF FREEDOM (params; walkable via stateSpace()):
 *
 *   reveal   0 … H   horizons appear one by one, inner to outer: region k
 *                    draws on as reveal passes k, its names fade in, its
 *                    people step in (they grow from nothing — the shared
 *                    Figure is never reached into).
 *   role(id).emphasis  one person brought forward (larger, name bright).
 *   role(id).certainty a role's realness: an unfilled role is conjecture
 *                    (ghosted, blurred); 1 is a person in the seat.
 *   labels   0 → 1   every name on the picture.
 *
 * Generic data in (`HorizonsData`); the mock's roles are titles, never
 * people.
 */

import { Group, Line, Null, type Vec3Like } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { completion, derive, length, scalar, type Readable } from "../../src/params"
import { BLUE, RED, WHITE, rgb, type Color } from "../../src/constants"
import type { Holon } from "../../src/holon"
import { certainty } from "../../src/certainty"
import { together, type Anim } from "../../src/anim"
import { axis, toggle, type Axis, type StateSpace } from "../../src/automaton"
import { smooth } from "../../src/geometry/flowmap"
import { horizonEdges, regionBoundary, roleSpot, type HorizonSpec } from "../../src/geometry/horizons"
import { Figure } from "../Figure/Figure"

export interface HorizonsData {
  /** Inner to outer. The last is open (no region). `reach` defaults to index + 1. */
  horizons: { id: string; label: string; span?: string; tint?: Color; width?: number; reach?: number }[]
  /** Top to bottom. */
  domains: { id: string; label: string; tint?: Color }[]
  /** People in their cells. `certainty` < 1: a role not (yet) held. */
  roles: { id: string; label: string; horizon: string; domain: string; certainty?: number; vacancy?: string }[]
  /** Small names placed in a cell — a process living there ("S&OP"). */
  notes?: { label: string; horizon: string; domain: string; at?: "edge" }[]
  /** The two questions the axes ask. */
  when?: string
  what?: string
}

const GREY = rgb(170, 170, 170)

export const MOCK_HORIZONS: HorizonsData = {
  horizons: [
    { id: "operational", label: "Operational", span: "13 weeks", tint: RED },
    { id: "tactical", label: "Tactical", span: "12 months", tint: BLUE },
    { id: "strategic", label: "Strategic", span: "years", tint: WHITE },
  ],
  domains: [
    { id: "ops", label: "Supply chain\n& operations", tint: RED },
    { id: "sales", label: "Sales", tint: BLUE },
    { id: "strategy", label: "Strategy", tint: WHITE },
  ],
  roles: [
    { id: "planner", label: "Ops planner", horizon: "operational", domain: "ops" },
    { id: "demand", label: "Demand planner", horizon: "tactical", domain: "sales" },
    { id: "manager", label: "Demand manager", horizon: "tactical", domain: "sales", certainty: 0.12, vacancy: "(open)" },
    { id: "coo", label: "COO", horizon: "strategic", domain: "ops" },
    { id: "cso", label: "CSO", horizon: "strategic", domain: "sales" },
    { id: "vp", label: "VP strategy", horizon: "strategic", domain: "strategy" },
  ],
  notes: [{ label: "S&OP", horizon: "tactical", domain: "ops", at: "edge" }],
  when: "WHEN do we care?",
  what: "WHAT do we\ncare about?",
}

/** One person in a cell. */
export class Role extends Group {
  /** Is the seat held (1) or open — conjecture about who (0)? */
  certainty = certainty(1)
  /** Brought forward: 0 as is, 1 emphasised. */
  emphasis = completion(0)
  roleId = ""
  figure!: Figure
  name!: Text
}

export class Horizons extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  data: HorizonsData = MOCK_HORIZONS

  /** Width of each horizon's column along t. */
  column = length(340)
  /** Height of each domain's row. */
  row = length(210)
  /** How many horizons are shown (0 … H), inner to outer, continuously. */
  reveal = scalar(0)
  /** Names: 1 shown, 0 off. */
  labels = completion(1)

  roles: Role[] = []
  regions: Line[] = []
  timeAxis!: Line
  whatAxis!: Line

  /** A role by id. */
  role(id: string): Role {
    const r = this.roles.find((x) => x.roleId === id)
    if (!r) throw new Error(`Horizons: no role '${id}' (roles: ${this.roles.map((x) => x.roleId).join(", ")})`)
    return r
  }

  private specs(): HorizonSpec[] {
    return this.data.horizons.map((h, i) => ({
      width: (h.width ?? 1) * this.column.value,
      reach: h.reach ?? Math.min(i + 1, this.data.domains.length),
    }))
  }

  /** The picture's size, for centring: origin is the axes' corner. */
  private extent() {
    const W = horizonEdges(this.specs()).at(-1)!
    const D = this.data.domains.length * this.row.value
    return { W, D }
  }

  protected override compose(): void {
    const d = this.data
    const H = d.horizons.length
    const size = () => this.row.value * 0.15
    const shown = (k: number): Readable<number> => derive(() => smooth(k, k + 0.6, this.reveal.value))
    const ink = (k: number) => derive(() => this.labels.value * shown(k).value)
    const text = (content: string, tint: Color, x: () => number, y: () => number, opacity: Readable<number>, scale = 1, align: "center" | "left" = "center") =>
      new Text({
        content,
        size: derive(() => size() * scale),
        tint,
        align,
        opacity,
        x: derive(x),
        y: derive(() => y() - size() * scale * 0.35),
      })
    const edges = () => horizonEdges(this.specs())
    const parts: Holon[] = []

    // --- the two axes -------------------------------------------------------
    const pad = () => this.row.value * 0.35
    this.timeAxis = new Line({ arrowEnd: true, stroke: 2.5, tint: WHITE })
    deriveLine(this.timeAxis, () => [this.column.value, this.row.value], () => [
      { x: 0, y: 0, z: 0 },
      { x: this.extent().W + pad(), y: 0, z: 0 },
    ])
    this.whatAxis = new Line({ arrowEnd: true, stroke: 2.5, tint: WHITE })
    deriveLine(this.whatAxis, () => [this.column.value, this.row.value], () => [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: -this.extent().D - pad(), z: 0 },
    ])
    parts.push(this.timeAxis, this.whatAxis)
    const always = derive(() => this.labels.value)
    parts.push(text("t", WHITE, () => this.extent().W + pad() + size() * 1.6, () => size() * 0.1, always, 1.2))
    if (d.what) parts.push(text(d.what, GREY, () => -this.column.value * 0.42, () => size() * 0.2, always, 0.85))
    if (d.when) parts.push(text(d.when, GREY, () => this.extent().W / 2, () => size() * 4.3, always, 0.85))

    // --- domains, down the left ---------------------------------------------
    d.domains.forEach((dom, r) => {
      parts.push(
        text(dom.label, dom.tint ?? WHITE, () => -this.column.value * 0.42, () => -(r + 0.5) * this.row.value + size() * 0.4, always, 0.95),
      )
    })

    // --- horizons: name above, span below the axis, region boundary --------
    d.horizons.forEach((h, k) => {
      const mid = () => (k > 0 ? edges()[k - 1]! : 0) + this.specs()[k]!.width / 2
      parts.push(text(h.label, h.tint ?? WHITE, mid, () => size() * 2.2, ink(k), 1.6))
      if (h.span) parts.push(text(h.span, WHITE, mid, () => -size() * 1.3, ink(k), 1.0))
      if (k < H - 1) {
        const region = new Line({ stroke: 2.5, tint: WHITE, creation: shown(k) })
        deriveLine(region, () => [this.column.value, this.row.value], () =>
          regionBoundary(this.specs(), k, this.row.value).map((p) => ({ x: p.x, y: p.y, z: 0 })),
        )
        this.regions.push(region)
        parts.push(region)
      }
    })

    // --- notes: a process named at its place ---------------------------------
    for (const n of d.notes ?? []) {
      const k = d.horizons.findIndex((h) => h.id === n.horizon)
      const r = d.domains.findIndex((x) => x.id === n.domain)
      if (k < 0 || r < 0) throw new Error(`Horizons: note '${n.label}' names an unknown horizon or domain`)
      // "edge": just outside the inner region's rounded corner, where the
      // process meets the horizon below it.
      const at = (): { x: number; y: number } => {
        if (n.at === "edge" && k > 0) {
          const s = this.specs()
          const W = edges()[k - 1]!
          const D = s[k - 1]!.reach * this.row.value
          return { x: W - Math.min(W, D) * 0.12, y: -D - size() * 1.2 }
        }
        const p = roleSpot(this.specs(), k, r, this.row.value, 0, 1)
        return p
      }
      parts.push(text(n.label, WHITE, () => at().x, () => at().y, ink(k), 1.05))
    }

    // --- the people ----------------------------------------------------------
    const cellCount = new Map<string, number>()
    const cellIndex = d.roles.map((role) => {
      const key = `${role.horizon}|${role.domain}`
      const i = cellCount.get(key) ?? 0
      cellCount.set(key, i + 1)
      return i
    })
    d.roles.forEach((role, ri) => {
      const k = d.horizons.findIndex((h) => h.id === role.horizon)
      const r = d.domains.findIndex((x) => x.id === role.domain)
      if (k < 0 || r < 0) throw new Error(`Horizons: role '${role.id}' names an unknown horizon or domain`)
      const tint = d.domains[r]!.tint ?? WHITE
      const count = cellCount.get(`${role.horizon}|${role.domain}`)!
      const spot = () => roleSpot(this.specs(), k, r, this.row.value, cellIndex[ri]!, count)
      const present = shown(k)
      // Hidden by its pen, not by scale alone: a stroke scaled to nothing
      // still draws a dot of its width. (stroke is the Figure's own param.)
      const figure = new Figure({
        height: derive(() => this.row.value * 0.36),
        tint,
        stroke: derive(() => 2.5 * present.value),
        y: derive(() => -this.row.value * 0.02),
      })
      // The name reads the role's emphasis — the role holds it, so refer late.
      let self: Role | undefined
      const name = text(role.label, tint, () => 0, () => -this.row.value * 0.3, derive(() => this.labels.value * present.value * (0.75 + 0.25 * (self?.emphasis.value ?? 0))), 0.72)
      // An open seat says so — until it is filled.
      if (role.vacancy) {
        const vacancy = role.vacancy
        name.params.get("content")!.follow(derive(() => ((self?.certainty.value ?? 0) < 0.95 ? `${role.label}\n${vacancy}` : role.label)))
      }
      const placed = new Role({
        roleId: role.id,
        members: [figure, name],
        certainty: role.certainty ?? 1,
        x: derive(() => spot().x),
        y: derive(() => spot().y),
      })
      self = placed
      placed.figure = figure
      placed.name = name
      // Its people step in as their horizon is revealed, and come forward
      // with emphasis — by scale, so the shared Figure is never reached into.
      placed.scale.follow(derive(() => smooth(k, k + 0.6, this.reveal.value) * (1 + 0.3 * placed.emphasis.value)))
      this.roles.push(placed)
      parts.push(placed)
    })

    // Centred on the picture, not on the axes' corner.
    this.add(
      new Group({
        members: parts,
        x: derive(() => -this.extent().W / 2 + this.column.value * 0.15),
        y: derive(() => this.extent().D / 2 - this.row.value * 0.12),
      }),
    )
  }

  /** Create: the axes draw on; the horizons are revealed, not created. */
  override createAnim(): Anim {
    void this.parts
    return together(this.timeAxis.creation.sequence(0, 1), this.whatAxis.creation.sequence(0, 1))
  }

  override stateSpace(): StateSpace {
    const positions: Record<string, { reveal: number }> = { none: { reveal: 0 } }
    this.data.horizons.forEach((h, k) => (positions[h.id] = { reveal: k + 1 }))
    const axes: Axis[] = [
      axis("reveal", this, positions, { key: "h", duration: 1.4, handles: () => this.regions }),
      toggle("labels", this.labels, { key: "l", off: ["hidden", 0], on: ["shown", 1] }),
    ]
    this.roles.forEach((r, i) => {
      const role = this.data.roles[i]!
      axes.push(
        toggle(`${role.id}.emphasis`, r.emphasis, {
          label: role.label.replace("\n", " "),
          off: ["as is", 0],
          on: ["forward", 1],
          when: () => this.reveal.value > this.data.horizons.findIndex((h) => h.id === role.horizon) + 0.5,
          handles: () => [r.figure, r.name],
        }),
      )
      const declared = role.certainty ?? 1
      if (declared < 1)
        axes.push(
          toggle(`${role.id}.filled`, r.certainty, {
            label: `${role.label.replace("\n", " ")} filled`,
            off: ["open", declared],
            on: ["filled", 1],
            duration: 2,
            handles: () => [r.figure],
          }),
        )
    })
    return { axes }
  }
}

/** Derived points, recomputed when `deps` change (the FlowMap/Globe memo pattern). */
const deriveLine = (line: Line, deps: () => number[], compute: () => Vec3Like[]): void => {
  let key: number[] | undefined
  let memo: Vec3Like[] = []
  Object.defineProperty(line, "points", {
    configurable: true,
    enumerable: true,
    get() {
      const next = deps()
      if (!key || next.some((v, i) => v !== key![i])) {
        key = next
        memo = compute()
        line.geomVersion++
      }
      return memo
    },
    set(_v) {},
  })
}

