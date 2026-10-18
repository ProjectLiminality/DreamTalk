/**
 * ib-liminalweb.test.ts — the LiminalWeb (InterBrain film 32:01–32:21): the
 * relations read both ways, the layout at a stop (centre, ring of ties,
 * the rest away), the measured proportions, and `focus` as one scrubbable
 * number whose stops are the layouts.
 */

import { describe, expect, test } from "bun:test"
import { FILM_TOUR, FILM_WEB, LiminalWeb, WEB, neighbours, webLayout, type Relations } from "../vocabulary/LiminalWeb/LiminalWeb"
import { DREAM_FACES, DREAMER_FACES } from "../vocabulary/DreamGarden/DreamGarden"

const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)

const tiny: Relations = {
  nodes: [
    { name: "a", kind: "dream", face: DREAM_FACES[0]! },
    { name: "b", kind: "dream", face: DREAM_FACES[1]! },
    { name: "x", kind: "dreamer", face: DREAMER_FACES[0]! },
    { name: "y", kind: "dreamer", face: DREAMER_FACES[1]! },
  ],
  ties: [[0, 2], [0, 3], [1, 2]],
}

describe("the relations", () => {
  test("a tie reads both ways: each dream its dreamers, each dreamer its dreams", () => {
    expect(neighbours(tiny, 0)).toEqual([2, 3])
    expect(neighbours(tiny, 2)).toEqual([0, 1])
    expect(neighbours(tiny, 3)).toEqual([0])
  })

  test("the film's web: every tie joins a dream to a dreamer; the tour's stops have the film's rings", () => {
    for (const [d, p] of FILM_WEB.ties) {
      expect(FILM_WEB.nodes[d]!.kind).toBe("dream")
      expect(FILM_WEB.nodes[p]!.kind).toBe("dreamer")
    }
    // f9646: three; f9676: six; f9691: four; f9721: four
    expect(FILM_TOUR.map((i) => neighbours(FILM_WEB, i).length)).toEqual([3, 6, 4, 4])
  })
})

describe("the layout", () => {
  test("the centre at the origin; its ties evenly on the orbit from the top, clockwise; the rest away and gone", () => {
    const L = webLayout(tiny, 2)
    expect(L[2]).toEqual({ x: 0, y: 0, r: 1, there: 1 })
    near(L[0]!.x, 0)
    near(L[0]!.y, WEB.orbit)
    near(L[1]!.y, -WEB.orbit)
    near(L[0]!.r, WEB.satellite)
    near(L[3]!.there, 0)
    near(L[3]!.r, 0)
    near(Math.hypot(L[3]!.x, L[3]!.y), WEB.away * WEB.orbit)
  })

  test("measured on f9721: satellites a third of the centre, the orbit 1.76 of it", () => {
    near(WEB.satellite, 46 / 137.5)
    near(WEB.orbit, 242 / 137.5)
    // the ring of six (f9676) does not touch: chord > two satellites
    expect(2 * WEB.orbit * Math.sin(Math.PI / 6)).toBeGreaterThan(2 * WEB.satellite)
  })
})

describe("LiminalWeb", () => {
  test("focus at a stop IS that stop's layout; between, every node blends", () => {
    const w = new LiminalWeb({ radius: 100 })
    void w.parts
    expect(w.nodes.length).toBe(FILM_WEB.nodes.length)
    for (let k = 0; k < FILM_TOUR.length; k++) {
      w.focus.value = k
      const L = webLayout(FILM_WEB, FILM_TOUR[k]!)
      w.nodes.forEach((n, i) => {
        near(n.x.value, 100 * L[i]!.x)
        near(n.y.value, 100 * L[i]!.y)
        near(n.radius.value, 100 * L[i]!.r)
        near(w.strands[i]!.there.value, L[i]!.there)
      })
    }
    w.focus.value = 0.5
    const A = webLayout(FILM_WEB, FILM_TOUR[0]!)
    const B = webLayout(FILM_WEB, FILM_TOUR[1]!)
    const c = FILM_TOUR[1]!
    near(w.nodes[c]!.x.value, 50 * (A[c]!.x + B[c]!.x))
    near(w.nodes[c]!.radius.value, 50 * (A[c]!.r + B[c]!.r))
  })

  test("walkable: one position per tour stop, named for its centre", () => {
    const w = new LiminalWeb()
    const axis = w.stateAxis("focus")
    expect(axis.positions.map((p) => p.name)).toEqual(FILM_TOUR.map((i) => FILM_WEB.nodes[i]!.name))
  })

  test("a tour naming a node the web lacks is refused", () => {
    const w = new LiminalWeb({ relations: tiny, tour: [0, 9] })
    expect(() => w.parts).toThrow()
  })
})
