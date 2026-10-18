/**
 * RoleMap — the social structure lens: an organisation's ROLES (never
 * names) by their distance from the centre of decision.
 *
 * Concentric rings round the centre: leadership in the middle, the staff
 * who steer with it on the first ring, the planners on the second — the
 * ring cut into equal sectors, one per site — and the decentralised
 * workforce spread round the outermost ring, an equal share in every
 * sector. Equal angles on every ring, the sectors equal, the whole radially
 * symmetric (layout.ts; TASTE.md § Aesthetic). Each person is the shared
 * `Figure`. A role at risk is drawn in the certainty language — ghosted —
 * and the risk can be shown: a red ring round it and the reason, said.
 *
 * THE DEGREES OF FREEDOM (params; walkable via stateSpace()):
 *
 *   centralise  0 decentralised … 1 shared-service: the shared-service
 *               role's people glide ALONG their ring (never across the
 *               centre), nearest first, into one hex-lattice cluster
 *               below the centre — leadership's intent — and a thin line
 *               from the cluster to the centre draws on, a quiet note
 *               beside it ("needs the write path").
 *   sites       0 hidden … 1 shown: the sector dividers draw on, the site
 *               names fade in.
 *   risk        0 hidden … 1 shown: the at-risk roles ringed in red, the
 *               reason under the name.
 *   labels      0 … 1: every name on the picture.
 *   gap         the distance between rings.
 *
 * Generic data in (`RoleMapData`); the mock is titles and numbered sites.
 */

import { derivePoints, Circle, Group, Line, Null } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { completion, derive, length, type Readable } from "../../src/params"
import { BLUE, RED, WHITE, rgb, type Color } from "../../src/constants"
import type { Holon } from "../../src/holon"
import { certainty } from "../../src/certainty"
import { restage, together, type Anim } from "../../src/anim"
import { Create } from "../../src/verbs"
import { toggle, type Axis, type StateSpace } from "../../src/automaton"
import { smooth } from "../../src/geometry/flowmap"
import { Figure } from "../Figure/Figure"
import {
  glide,
  hexCluster,
  polar,
  ringRadius,
  sectorDividers,
  sectorMiddle,
  seats,
  turn,
  type P2,
  type RoleSpec,
  type Seat,
} from "./layout"

export type { RoleSpec } from "./layout"

export interface RoleMapData {
  roles: (RoleSpec & { tint?: Color })[]
  /** The sectors of a sited ring, in order (the first centred at 45°). */
  sites?: string[]
  /** Each ring's quiet name, centre first ("" or missing: unnamed). */
  rings?: string[]
  /** The role leadership would gather into one shared service. */
  shared?: { role: string; note?: string; /** Where the cluster stands, degrees (default −90: below the centre). */ at?: number }
}

const GREY = rgb(150, 150, 150)
const QUIET = rgb(110, 110, 110)

export const MOCK_ROLEMAP: RoleMapData = {
  roles: [
    { id: "ceo", label: "CEO", ring: 0, tint: WHITE },
    { id: "cfo", label: "CFO", ring: 0, tint: WHITE },
    { id: "scd", label: "Supply chain\ndirector", ring: 1 },
    { id: "sop", label: "S&OP\nmanager", ring: 1 },
    { id: "bi", label: "Data / BI", ring: 1, certainty: 0.2, risk: "leaving —\nknowledge risk" },
    { id: "planners-1", label: "Planners", ring: 2, count: 2, site: "Site 1" },
    { id: "planners-2", label: "Planners", ring: 2, count: 3, site: "Site 2" },
    { id: "planners-3", label: "Planners", ring: 2, count: 2, site: "Site 3" },
    { id: "planners-4", label: "Planners", ring: 2, count: 3, site: "Site 4" },
    { id: "replenishment", label: "Replenishment", ring: 3, count: 12, tint: WHITE },
  ],
  sites: ["Site 1", "Site 2", "Site 3", "Site 4"],
  rings: ["", "steering", "planning", "replenishment"],
  shared: { role: "replenishment", note: "needs the write path" },
}

/** One person on the map — ghosted as its role is uncertain. */
export class RolePerson extends Group {
  /** Is the seat solidly held (1), or at risk (less — ghosted)? */
  certainty = certainty(1)
  roleId = ""
  figure!: Figure
}

export class RoleMap extends Null {
  /** ONTOLOGY.md: a sovereign symbol — cast, not asset. */
  static sovereign = true

  data: RoleMapData = MOCK_ROLEMAP

  /** The distance between rings. */
  gap = length(190)
  /** 0 decentralised … 1 one shared-service cluster. */
  centralise = completion(0)
  /** The site sectors: 0 hidden, 1 shown. */
  sites = completion(0)
  /** The at-risk roles highlighted: 0 hidden, 1 shown. */
  risk = completion(0)
  /** Names: 1 shown, 0 off. */
  labels = completion(1)

  people: RolePerson[] = []
  rings: Line[] = []
  ringNames: Text[] = []
  dividers: Line[] = []
  siteNames: Text[] = []
  riskMarks: Holon[] = []
  writePath?: Line
  centre!: Circle

  /** Every person holding a role, by role id. */
  holders(id: string): RolePerson[] {
    const out = this.people.filter((p) => p.roleId === id)
    if (!out.length) throw new Error(`RoleMap: no role '${id}' (roles: ${this.data.roles.map((r) => r.id).join(", ")})`)
    return out
  }

  protected override compose(): void {
    const d = this.data
    const sites = d.sites ?? []
    const g = () => this.gap.value
    const fig = () => g() * 0.3
    const size = () => g() * 0.1
    const outer = Math.max(...d.roles.map((r) => r.ring))
    const ringsWithPeople = [...new Set(d.roles.map((r) => r.ring))].filter((k) => k > 0)
    const parts: Holon[] = []
    const label = (content: string, tint: Color, at: () => P2, opacity: Readable<number>, scale = 1) =>
      new Text({
        content,
        size: derive(() => size() * scale),
        tint,
        opacity,
        x: derive(() => at().x),
        y: derive(() => at().y - size() * scale * 0.35),
      })
    const named = derive(() => this.labels.value)

    // --- the centre of decision ---------------------------------------------
    this.centre = new Circle({ radius: derive(() => g() * 0.035), stroke: 2, tint: GREY })
    parts.push(this.centre)

    // --- the rings, each named quietly where it crosses +x -------------------
    for (const k of ringsWithPeople) {
      const name = d.rings?.[k] ?? ""
      const R = () => ringRadius(k, g())
      const ring = new Line({ stroke: 1.5, tint: QUIET })
      derivePoints(ring, () => [g()], () => {
        const pts = []
        const N = 160
        for (let i = 0; i <= N; i++) {
          const a = (Math.PI * 2 * i) / N
          pts.push({ ...polar(R(), a), z: 0 })
        }
        return pts
      })
      this.rings.push(ring)
      parts.push(ring)
      if (name) {
        // Just outside the ring, above the axis — clear of the divider on it.
        const t = new Text({
          content: name,
          size: derive(() => size() * 0.85),
          tint: GREY,
          align: "left",
          opacity: named,
          x: derive(() => R() + size() * 0.45),
          y: derive(() => size() * 0.45),
        })
        this.ringNames.push(t)
        parts.push(t)
      }
    }

    // --- the site sectors ---------------------------------------------------
    const sitedRings = [...new Set(d.roles.filter((r) => r.site !== undefined).map((r) => r.ring))]
    if (sites.length > 1 && sitedRings.length) {
      const inner = Math.min(...sitedRings)
      const from = () => (ringRadius(inner - 1, g()) + ringRadius(inner, g())) / 2 + g() * 0.05
      const to = () => ringRadius(outer, g()) + g() * 0.42
      const drawn = derive(() => this.sites.value)
      for (const a of sectorDividers(sites.length)) {
        const line = new Line({ stroke: 1.5, tint: GREY, creation: drawn })
        derivePoints(line, () => [g()], () => [
          { ...polar(from(), a), z: 0 },
          { ...polar(to(), a), z: 0 },
        ])
        this.dividers.push(line)
        parts.push(line)
      }
      sites.forEach((site, s) => {
        const t = label(site, WHITE, () => polar(to() + g() * 0.02, sectorMiddle(s, sites.length)), derive(() => this.sites.value * this.labels.value), 1.15)
        this.siteNames.push(t)
        parts.push(t)
      })
    }

    // --- the shared service: where it gathers -------------------------------
    const sharedRole = d.shared ? d.roles.findIndex((r) => r.id === d.shared!.role) : -1
    if (d.shared && sharedRole < 0) throw new Error(`RoleMap: shared role '${d.shared.role}' is not a role`)
    const all = seats(d.roles, sites, 1)
    const clusterAngle = ((d.shared?.at ?? -90) * Math.PI) / 180
    const sharedSeats = all.filter((s) => s.role === sharedRole)
    const sharedRing = sharedSeats[0]?.ring ?? outer
    // Slots: the hex cluster (in units of the figure), assigned left to
    // right in the order the people arrive from (their signed turn), so no
    // two paths cross as they settle.
    const slotsUnit = hexCluster(sharedSeats.length, 1.15)
    const tangent = { x: -Math.sin(clusterAngle), y: Math.cos(clusterAngle) }
    const along = (p: P2) => p.x * tangent.x + p.y * tangent.y
    const bySide = [...slotsUnit].sort((a, b) => along(b) - along(a))
    const byTurn = [...sharedSeats].sort((a, b) => turn(a.angle, clusterAngle) - turn(b.angle, clusterAngle))
    const slotOf = new Map<Seat, P2>(byTurn.map((s, i) => [s, bySide[i]!]))
    const reach = Math.max(...sharedSeats.map((s) => Math.abs(turn(s.angle, clusterAngle))), 1e-6)

    // --- the people ---------------------------------------------------------
    const scaled = (s: Seat) => () => polar(ringRadius(s.ring, g()) || 0, s.angle)
    for (const seat of all) {
      const role = d.roles[seat.role]!
      const tint = role.tint ?? (seat.ring === 0 ? WHITE : BLUE)
      const figure = new Figure({ height: derive(fig), tint, stroke: 2.5 })
      const members: Holon[] = [figure]
      const single = (role.count ?? 1) === 1
      if (single) members.push(label(role.label, tint, () => ({ x: 0, y: -fig() * 0.72 - size() * 0.75 }), derive(() => this.labels.value * 0.85), 1))
      let at: () => P2 = seat.ring === 0 && all.filter((s) => s.ring === 0).length === 1 ? () => ({ x: 0, y: 0 }) : scaled(seat)
      if (seat.role === sharedRole) {
        // Nearest first: each person's glide starts as its turn is short.
        const lead = 0.45 * (Math.abs(turn(seat.angle, clusterAngle)) / reach)
        const slot = slotOf.get(seat)!
        const R = () => ringRadius(seat.ring, g())
        at = () => {
          const s = smooth(lead, lead + 0.55, this.centralise.value)
          const c = fig()
          return glide(seat, R(), clusterAngle, { x: slot.x * c, y: slot.y * c }, s)
        }
      }
      const person = new RolePerson({
        roleId: role.id,
        members,
        certainty: role.certainty ?? 1,
        x: derive(() => at().x),
        y: derive(() => at().y),
      })
      person.figure = figure
      this.people.push(person)
      parts.push(person)

      // The risk, shown solid over the ghost: a red ring and the reason.
      if ((role.certainty ?? 1) < 1) {
        const shown = derive(() => this.risk.value)
        const ring = new Circle({
          radius: derive(() => fig() * 0.62),
          stroke: 2.5,
          tint: RED,
          creation: shown,
          x: derive(() => at().x),
          y: derive(() => at().y),
        })
        this.riskMarks.push(ring)
        parts.push(ring)
        if (role.risk) {
          const lines = role.label.split("\n").length
          const why = label(
            role.risk,
            RED,
            () => ({ x: at().x, y: at().y - fig() * 0.72 - size() * (0.75 + 1.2 * lines + 0.25) }),
            derive(() => this.risk.value * this.labels.value),
            0.85,
          )
          this.riskMarks.push(why)
          parts.push(why)
        }
      }
    }

    // --- the write path: from the cluster to the centre ---------------------
    if (sharedSeats.length) {
      const drawn = derive(() => smooth(0.7, 1, this.centralise.value))
      // The cluster's inward edge: its slots' furthest reach towards the
      // centre, plus half a figure and a breath of air.
      const inward = { x: -Math.cos(clusterAngle), y: -Math.sin(clusterAngle) }
      const top = Math.max(...slotsUnit.map((p) => p.x * inward.x + p.y * inward.y))
      const reachOf = () => (top + 0.62) * fig()
      const R = () => ringRadius(sharedRing, g())
      // Drawn from the cluster up to the centre: the request travels inward.
      this.writePath = new Line({ stroke: 1.5, tint: WHITE, creation: drawn })
      derivePoints(this.writePath, () => [g()], () => [
        { ...polar(R() - reachOf(), clusterAngle), z: 0 },
        { ...polar(g() * 0.08, clusterAngle), z: 0 },
      ])
      parts.push(this.writePath)
      if (d.shared?.note) {
        const mid = () => polar((R() - reachOf() + ringRadius(1, g()) * 0.5) / 2, clusterAngle)
        parts.push(
          new Text({
            content: d.shared.note,
            size: derive(() => size() * 0.85),
            tint: GREY,
            align: "left",
            opacity: derive(() => drawn.value * this.labels.value),
            x: derive(() => mid().x + size() * 0.6),
            y: derive(() => mid().y - size() * 0.3),
          }),
        )
      }
    }

    this.add(new Group({ members: parts }))
  }

  /** Create: the rings draw on outward, then the people step in, centre first. */
  override createAnim(): Anim {
    void this.parts
    const items: [Anim, number, number][] = [[this.centre.creation.sequence(0, 1), 0, 0.15]]
    this.rings.forEach((r, i) => items.push([r.creation.sequence(0, 1), 0.05 + i * 0.08, 0.45 + i * 0.08]))
    this.ringNames.forEach((t, i) => items.push([Create(t), 0.35 + i * 0.08, 0.6 + i * 0.08]))
    const outer = Math.max(...this.data.roles.map((r) => r.ring), 1)
    const ringOf = (p: RolePerson) => this.data.roles.find((r) => r.id === p.roleId)!.ring
    for (const p of this.people) {
      const a = 0.35 + (0.4 * ringOf(p)) / outer
      items.push([Create(p), a, a + 0.25])
    }
    return together(...items.map(([anim, a, b]) => restage(anim, a, b)))
  }

  override stateSpace(): StateSpace {
    const axes: Axis[] = []
    if (this.writePath)
      axes.push(
        toggle("centralise", this.centralise, {
          key: "g",
          off: ["decentralised", 0],
          on: ["shared-service", 1],
          duration: 3.2,
          handles: () => this.people.filter((p) => p.roleId === this.data.shared!.role),
        }),
      )
    if (this.dividers.length)
      axes.push(toggle("sites", this.sites, { key: "s", off: ["hidden", 0], on: ["shown", 1], duration: 1.4, handles: () => [...this.dividers, ...this.siteNames] }))
    if (this.riskMarks.length)
      axes.push(
        toggle("risk", this.risk, {
          key: "k",
          off: ["hidden", 0],
          on: ["shown", 1],
          duration: 1.2,
          handles: () => this.people.filter((p) => p.certainty.value < 1),
        }),
      )
    return { axes }
  }
}
