import { describe, expect, test } from "bun:test"
import { Dream } from "../src/dream"
import { DreamSong } from "../src/song"
import { Holon } from "../src/holon"
import { Circle, Square } from "../src/parts/primitives"
import { BLUE, RED } from "../src/constants"
import {
  BUILD_FRACTION,
  buildIn,
  buildOut,
  crossfade,
  cut,
  lerpParamValue,
  magicMove,
  matchRoots,
  matchedParams,
  rootIdentityOf,
  smooth,
} from "../src/transitions"

/**
 * Cross-scene Magic Move (ONTOLOGY "Magic Move: one operator" point 2).
 *
 * The shape under test: a transition is an OVERLAP WINDOW, and inside it
 * matched roots glide while unmatched ones build out/in — all of it one
 * more pure layer over the ordinary sampling, so a scrub through a
 * window is bit-identical in both directions.
 */

class Dot extends Holon {}
class Blob extends Holon {}

/** A drives dot.x 0 → 10 over its 2s, and stages a blob that leaves. */
class SceneA extends Dream {
  dot = new Dot()
  blob = new Blob()
  unfold(): void {
    this.set(...this.observer.dolly(500))
    this.play(this.dot.x.to(10, { easing: "linear" }), 2)
    this.stage(this.blob)
  }
}

/** B parks dot at x=100 and drives y; its own arrival is `spark`. */
class SceneB extends Dream {
  dot = new Dot()
  spark = new Blob()
  unfold(): void {
    this.set(...this.observer.dolly(900))
    this.set(this.dot.x.to(100))
    this.play(this.dot.y.to(50, { easing: "linear" }), 2)
    this.stage(this.spark)
  }
}

const song = (transition = magicMove(1)) => {
  const s = new DreamSong([SceneA, [SceneB, transition]])
  return {
    s,
    a: s.chapters[0]!.dream as SceneA,
    b: s.chapters[1]!.dream as SceneB,
  }
}

describe("transition specs", () => {
  test("cut is the zero-overlap default; the others carry their duration", () => {
    expect(cut).toEqual({ kind: "cut", duration: 0 })
    expect(magicMove(1.5)).toEqual({ kind: "magicMove", duration: 1.5 })
    expect(crossfade(2)).toEqual({ kind: "crossfade", duration: 2 })
  })

  test("a bare chapter cuts: offsets stay contiguous, duration is the sum", () => {
    const plain = new DreamSong([SceneA, SceneB])
    expect(plain.chapters.map((c) => c.offset)).toEqual([0, 2])
    expect(plain.duration).toBe(4)
  })

  test("an overlap pulls the incoming chapter back by exactly its duration", () => {
    const { s } = song(magicMove(1))
    expect(s.chapters.map((c) => c.offset)).toEqual([0, 1])
    expect(s.duration).toBe(3) // 2 + 2 - 1
  })

  test("a transition that does not fit its neighbours is refused", () => {
    expect(() => new DreamSong([[SceneA, magicMove(1)]]).chapters).toThrow(
      /first chapter has no boundary/,
    )
    expect(() => new DreamSong([SceneA, [SceneB, magicMove(5)]]).chapters).toThrow(/does not fit/)
  })
})

describe("matching", () => {
  test("identity wins: same class AND same Dream-field name", () => {
    const { a, b } = song()
    const match = matchRoots(a, a.roots, b, b.roots)
    expect(match.pairs).toHaveLength(1)
    expect(match.pairs[0]).toEqual([a.dot, b.dot])
    // `blob` and `spark` are the same CLASS but the author named them
    // differently, so they stay unmatched: one leaves, the other arrives.
    expect(match.outs).toEqual([a.blob])
    expect(match.ins).toEqual([b.spark])
  })

  test("two authored-but-different names are NOT structurally paired", () => {
    // The author's word beats declaration order: naming one `blob` and
    // the other `spark` says they are different things.
    const { a, b } = song()
    const match = matchRoots(a, a.roots, b, b.roots)
    expect(match.pairs.map(([x, y]) => [rootIdentityOf(a, x), rootIdentityOf(b, y)])).toEqual([
      ["dot", "dot"],
    ])
  })

  test("an anonymous root DOES fall back to structure against a named one", () => {
    // Nothing was written to contradict the pairing, so structure decides.
    class Named extends Dream {
      halo = new Dot()
      unfold(): void {
        this.stage(this.halo)
      }
    }
    class Anon extends Dream {
      unfold(): void {
        this.stage(new Dot())
      }
    }
    const l = new Named()
    const r = new Anon()
    const match = matchRoots(l, l.roots, r, r.roots)
    expect(match.pairs).toEqual([[l.halo, r.roots[0]!]])
  })

  test("rootIdentityOf reads the field name the DreamWeaving gave a root", () => {
    const { a } = song()
    expect(rootIdentityOf(a, a.dot)).toBe("dot")
    expect(rootIdentityOf(a, a.blob)).toBe("blob")
    expect(rootIdentityOf(a, new Dot())).toBeUndefined() // anonymous
  })

  test("structural fallback: same class, k-th with k-th, among the anonymous", () => {
    class Left extends Dream {
      unfold(): void {
        this.stage(new Dot())
        this.stage(new Dot())
      }
    }
    class Right extends Dream {
      unfold(): void {
        this.stage(new Dot())
        this.stage(new Dot())
      }
    }
    const l = new Left()
    const r = new Right()
    const match = matchRoots(l, l.roots, r, r.roots)
    expect(match.pairs).toEqual([
      [l.roots[0]!, r.roots[0]!],
      [l.roots[1]!, r.roots[1]!],
    ])
    expect(match.outs).toEqual([])
    expect(match.ins).toEqual([])
  })

  test("surplus anonymous roots on either side build out / build in", () => {
    class Two extends Dream {
      unfold(): void {
        this.stage(new Dot())
        this.stage(new Dot())
      }
    }
    class One extends Dream {
      unfold(): void {
        this.stage(new Dot())
      }
    }
    const l = new Two()
    const r = new One()
    expect(matchRoots(l, l.roots, r, r.roots).outs).toEqual([l.roots[1]!])
    expect(matchRoots(r, r.roots, l, l.roots).ins).toEqual([l.roots[1]!])
  })

  test("class is never crossed: a Dot does not match a Blob", () => {
    class OnlyDot extends Dream {
      dot = new Dot()
      unfold(): void {
        this.stage(this.dot)
      }
    }
    class OnlyBlob extends Dream {
      dot = new Blob() // same NAME, different class
      unfold(): void {
        this.stage(this.dot)
      }
    }
    const l = new OnlyDot()
    const r = new OnlyBlob()
    const match = matchRoots(l, l.roots, r, r.roots)
    expect(match.pairs).toEqual([])
    expect(match.outs).toEqual([l.dot])
    expect(match.ins).toEqual([r.dot])
  })

  test("matchedParams: the shared transform, plus tint/stroke where both carry it", () => {
    const names = (x: Holon, y: Holon) => {
      const byParam = new Map([...x.params].map(([name, p]) => [p, name]))
      return matchedParams(x, y).map(({ a }) => byParam.get(a as never)!)
    }
    // Two bare holons share only the standard transform.
    expect(names(new Dot(), new Dot())).toEqual(["x", "y", "z", "h", "p", "b", "scale"])
    // Two strokes add the stroke face.
    expect(names(new Circle(), new Circle())).toEqual([
      "x", "y", "z", "h", "p", "b", "scale", "tint", "stroke",
    ])
    // A stroke against a bare holon keeps only what BOTH have.
    expect(names(new Circle(), new Dot())).toEqual(["x", "y", "z", "h", "p", "b", "scale"])
  })
})

describe("the glide", () => {
  test("matched params interpolate between the two chapters' own sampled values", () => {
    const { s, a, b } = song(magicMove(1))
    // The window is [1, 2). At its start the glide is pinned to A's value…
    s.applyAt(1)
    expect(a.dot.x.value).toBeCloseTo(5, 10) // A's ramp at local t=1
    expect(b.dot.x.value).toBeCloseTo(5, 10) // …and B's twin coincides
    // At the midpoint, the C4D-smooth ease between A's 7.5 and B's 100.
    s.applyAt(1.5)
    const expected = 7.5 + (100 - 7.5) * smooth(0.5)
    expect(a.dot.x.value).toBeCloseTo(expected, 10)
    expect(b.dot.x.value).toBeCloseTo(expected, 10)
    // Approaching the far edge it lands on B's value, continuously.
    s.applyAt(1.9999)
    expect(b.dot.x.value).toBeCloseTo(100, 3)
  })

  test("both twins are written the same value, so they coincide on screen", () => {
    const { s, a, b } = song()
    for (const t of [1.1, 1.4, 1.75]) {
      s.applyAt(t)
      expect(a.dot.x.value).toBe(b.dot.x.value)
      expect(a.dot.y.value).toBe(b.dot.y.value)
    }
  })

  test("the glide is C4D-smooth, not linear — it eases in and out", () => {
    const { s, b } = song()
    s.applyAt(1.25)
    const quarter = b.dot.x.value as number
    s.applyAt(1.75)
    const threeQuarter = b.dot.x.value as number
    // Slow at the start, slow at the end: the first quarter covers less
    // ground than a straight line would, the last quarter likewise.
    const linearQuarter = 7.5 + (100 - 7.5) * 0.25
    expect(quarter).toBeLessThan(linearQuarter)
    expect(threeQuarter).toBeGreaterThan(7.5 + (100 - 7.5) * 0.75)
  })

  test("a matched pair glides tint too — colour lerps channelwise", () => {
    class Tinted extends Dream {
      ring = new Circle({ tint: BLUE })
      unfold(): void {
        this.stage(this.ring)
      }
    }
    class Retinted extends Dream {
      ring = new Circle({ tint: RED })
      unfold(): void {
        this.stage(this.ring)
      }
    }
    const s = new DreamSong([
      { scene: Tinted, span: 2 },
      [{ scene: Retinted, span: 2 }, magicMove(1)],
    ])
    const from = (s.chapters[0]!.dream as Tinted).ring
    s.applyAt(1.5)
    const e = smooth(0.5)
    expect(from.tint.value).toEqual({
      r: BLUE.r + (RED.r - BLUE.r) * e,
      g: BLUE.g + (RED.g - BLUE.g) * e,
      b: BLUE.b + (RED.b - BLUE.b) * e,
    })
  })

  test("outside its window a glided param is restored, not left smeared", () => {
    const { s, a } = song()
    s.applyAt(1.5) // mid-glide: a.dot.x is written far past A's own 10
    expect(a.dot.x.value).toBeGreaterThan(20)
    s.applyAt(0.5) // back before the window
    expect(a.dot.x.value).toBeCloseTo(2.5, 10) // A's own ramp, untouched
    s.applyAt(2.5) // past the window
    expect(a.dot.x.value).toBe(10) // A's held final value
  })

  test("the observer always interpolates: the camera glides between rigs", () => {
    const { s } = song()
    s.applyAt(0.5)
    expect(s.observer.radius.value).toBe(500) // A's rig
    s.applyAt(1.5)
    expect(s.observer.radius.value).toBeCloseTo(500 + 400 * smooth(0.5), 10)
    s.applyAt(2.5)
    expect(s.observer.radius.value).toBe(900) // B's rig
  })
})

describe("build out / build in", () => {
  test("the ramps occupy the window's first and last 40%", () => {
    expect(BUILD_FRACTION).toBe(0.4)
    expect(buildOut(0)).toBe(1)
    expect(buildOut(BUILD_FRACTION)).toBe(0)
    expect(buildOut(0.9)).toBe(0) // stays out once out
    expect(buildIn(0)).toBe(0)
    expect(buildIn(1 - BUILD_FRACTION)).toBe(0) // waits its turn
    expect(buildIn(1)).toBe(1)
  })

  test("an unmatched A holon fades out early; an unmatched B holon arrives late", () => {
    const { s, a, b } = song()
    s.applyAt(1) // window start
    expect(a.blob.opacity.value).toBe(1)
    expect(b.spark.opacity.value).toBe(0)
    s.applyAt(1.5) // midpoint: the leaver is gone, the arriver not yet here
    expect(a.blob.opacity.value).toBe(0)
    expect(b.spark.opacity.value).toBe(0)
    s.applyAt(1.9999) // window end
    expect(a.blob.opacity.value).toBe(0)
    expect(b.spark.opacity.value).toBeCloseTo(1, 3)
  })

  test("a matched pair is NOT ramped — it glides at full opacity throughout", () => {
    const { s, a, b } = song()
    for (const t of [1, 1.25, 1.5, 1.75]) {
      s.applyAt(t)
      expect(a.dot.opacity.value).toBe(1)
      expect(b.dot.opacity.value).toBe(1)
    }
  })
})

describe("crossfade, the simple sibling", () => {
  test("every holon of A ramps down and every holon of B ramps up, linearly", () => {
    const { s, a, b } = song(crossfade(1))
    s.applyAt(1.25)
    expect(a.dot.opacity.value).toBeCloseTo(0.75, 10)
    expect(a.blob.opacity.value).toBeCloseTo(0.75, 10)
    expect(b.dot.opacity.value).toBeCloseTo(0.25, 10)
    expect(b.spark.opacity.value).toBeCloseTo(0.25, 10)
  })

  test("a crossfade does NOT glide — each chapter keeps its own transform", () => {
    const { s, a, b } = song(crossfade(1))
    s.applyAt(1.5)
    expect(a.dot.x.value).toBeCloseTo(7.5, 10) // A's own ramp
    expect(b.dot.x.value).toBe(100) // B's own parked value
  })

  test("its single camera travels too, on the same linear ramp", () => {
    const { s } = song(crossfade(1))
    s.applyAt(1.5)
    expect(s.observer.radius.value).toBeCloseTo(700, 10)
  })
})

describe("scrub purity", () => {
  const probe = (s: DreamSong, a: SceneA, b: SceneB) => [
    a.dot.x.value, a.dot.y.value, a.dot.opacity.value, a.blob.opacity.value,
    b.dot.x.value, b.dot.y.value, b.dot.opacity.value, b.spark.opacity.value,
    s.observer.radius.value,
  ]

  const TIMES = [0, 0.5, 1, 1.2, 1.5, 1.8, 1.99, 2, 2.5, 3]

  test("magicMove: scrubbing backward is bit-identical to scrubbing forward", () => {
    const { s, a, b } = song(magicMove(1))
    const forward = TIMES.map((t) => {
      s.applyAt(t)
      return probe(s, a, b)
    })
    const backward = [...TIMES]
      .reverse()
      .map((t) => {
        s.applyAt(t)
        return probe(s, a, b)
      })
      .reverse()
    expect(backward).toEqual(forward)
  })

  test("…and identical to a fresh instance sampled at that t alone", () => {
    for (const t of TIMES) {
      const worn = song(magicMove(1))
      for (const u of TIMES) worn.s.applyAt(u) // drag it through the whole song
      worn.s.applyAt(t)
      const fresh = song(magicMove(1))
      fresh.s.applyAt(t)
      expect(probe(worn.s, worn.a, worn.b)).toEqual(probe(fresh.s, fresh.a, fresh.b))
    }
  })

  test("crossfade is pure the same way", () => {
    const { s, a, b } = song(crossfade(1))
    const forward = TIMES.map((t) => {
      s.applyAt(t)
      return probe(s, a, b)
    })
    const backward = [...TIMES]
      .reverse()
      .map((t) => {
        s.applyAt(t)
        return probe(s, a, b)
      })
      .reverse()
    expect(backward).toEqual(forward)
  })

  test("re-sampling one t repeatedly never drifts", () => {
    const { s, a, b } = song(magicMove(1))
    s.applyAt(1.5)
    const once = probe(s, a, b)
    for (let i = 0; i < 20; i++) s.applyAt(1.5)
    expect(probe(s, a, b)).toEqual(once)
  })
})

describe("the pure arithmetic", () => {
  test("lerpParamValue: numbers, colours, and step-at-1 booleans", () => {
    expect(lerpParamValue(0, 10, 0.25)).toBe(2.5)
    expect(lerpParamValue(BLUE, RED, 0)).toEqual(BLUE)
    expect(lerpParamValue(BLUE, RED, 1)).toEqual(RED)
    expect(lerpParamValue(false, true, 0.99)).toBe(false)
    expect(lerpParamValue(false, true, 1)).toBe(true)
    expect(() => lerpParamValue(0, BLUE, 0.5)).toThrow(/mismatched value types/)
  })

  test("smooth is a proper ease: pinned at both ends, symmetric about the middle", () => {
    expect(smooth(0)).toBeCloseTo(0, 10)
    expect(smooth(1)).toBeCloseTo(1, 10)
    expect(smooth(0.5)).toBeCloseTo(0.5, 10)
    expect(smooth(0.25) + smooth(0.75)).toBeCloseTo(1, 10)
  })
})

describe("three chapters", () => {
  /** A middle chapter is both a transition's target and the next one's source. */
  test("adjacent windows stay disjoint and each boundary keeps its own kind", () => {
    const s = new DreamSong([
      { scene: SceneA, span: 2 },
      [{ scene: SceneB, span: 2 }, magicMove(0.5)],
      [{ scene: SceneA, span: 2 }, crossfade(0.5)],
    ])
    expect(s.chapters.map((c) => c.offset)).toEqual([0, 1.5, 3])
    expect(s.duration).toBe(5)
    expect(s.chapters[1]!.transition).toEqual(magicMove(0.5))
    expect(s.chapters[2]!.transition).toEqual(crossfade(0.5))
    // Windows [1.5, 2) and [3, 3.5) — a t between them is in neither.
    const mid = s.chapters[1]!.dream as SceneB
    s.applyAt(2.5)
    expect(mid.dot.x.value).toBe(100) // B's own value, unglided
    expect(mid.spark.opacity.value).toBe(1) // fully arrived
  })

  test("purity holds across two windows in one song", () => {
    const make = () =>
      new DreamSong([
        { scene: SceneA, span: 2 },
        [{ scene: SceneB, span: 2 }, magicMove(0.5)],
        [{ scene: SceneA, span: 2 }, crossfade(0.5)],
      ])
    const times = [0, 1.4, 1.6, 1.9, 2.5, 3.2, 4]
    const read = (s: DreamSong) =>
      s.chapters.flatMap((c) => [...c.dream.roots].flatMap((r) => [...r.walk()]))
        .map((h) => [h.x.value, h.y.value, h.opacity.value])
    const s = make()
    const forward = times.map((t) => {
      s.applyAt(t)
      return read(s)
    })
    const backward = [...times]
      .reverse()
      .map((t) => {
        s.applyAt(t)
        return read(s)
      })
      .reverse()
    expect(backward).toEqual(forward)
  })
})
