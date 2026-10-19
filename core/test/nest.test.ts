/**
 * Nesting (editor/nest.ts): pause a song, unpack a symbol into its own
 * song, come back to exactly the paused moment. The pure half: what a
 * symbol unpacks into, and that leaving restores the level as it was.
 */

import { describe, expect, test } from "bun:test"
import { Dream, type DreamClass } from "../src/dream"
import { Holon } from "../src/holon"
import { Observer } from "../src/dream"
import { ViewLayer } from "../src/view"
import { latticeDream, LevelCache, levelNameOf, NestStack, songLatticeDream, statesOf, symbolAt, watchMeOf, type LevelSurface } from "../editor/nest"
import { Eye } from "../vocabulary/Eye/Eye"
import { StateLattice } from "../vocabulary/StateLattice/StateLattice"

class Ring extends Holon {}
class Beacon extends Holon {
  static sovereign = true
  ring = new Ring()
}
class Lens extends Holon {
  static sovereign = true
}
class Shard extends Holon {
  static sovereign = true
}
class BeaconDemoDream extends Dream {
  unfold() {}
}
class LensDream extends Dream {
  unfold() {}
}

const scenes: Record<string, DreamClass> = { "ib-beacon": BeaconDemoDream, lens: LensDream }

describe("what a symbol unpacks into — its WatchMe", () => {
  test("a registered scene that explains it, by name; else the symbol alone with its state space", () => {
    expect(watchMeOf(scenes, new Beacon())).toMatchObject({ Dream: BeaconDemoDream, key: "ib-beacon", alone: false })
    expect(watchMeOf(scenes, new Lens())).toMatchObject({ Dream: LensDream, key: "lens", alone: false })
    const alone = watchMeOf(scenes, new Shard())
    expect(alone.alone).toBe(true)
    expect(new alone.Dream().roots[0]).toBeInstanceOf(Shard)
  })

  test("a touch on a part unpacks the symbol that holds it", () => {
    const b = new Beacon()
    expect(symbolAt(b.ring)).toBe(b)
  })

  test("a part with its own level (Holon.unpack) opens that, from its own data; its siblings still open the whole", () => {
    class SiteDream extends Dream {
      unfold() {}
    }
    class Site extends Holon {
      constructor(readonly own: boolean) {
        super()
      }
      override unpack(): DreamClass | undefined {
        return this.own ? SiteDream : undefined
      }
    }
    class Sites extends Holon {
      static sovereign = true
      mine = new Site(true)
      plain = new Site(false)
    }
    const m = new Sites()
    expect(symbolAt(m.mine)).toBe(m.mine)
    expect(symbolAt(m.plain)).toBe(m)
    expect(watchMeOf(scenes, m.mine)).toMatchObject({ Dream: SiteDream, alone: false })
    // Its level is named by that level, so a link reopens THIS site; a plain part keeps its node name.
    expect(levelNameOf(m.mine)).toBe("SiteDream")
    expect(levelNameOf(m)).toBe("Sites")
  })
})

describe("the return is exact", () => {
  const surface = (view: ViewLayer, log: string[]): LevelSurface => ({
    canvas: undefined as unknown as HTMLCanvasElement,
    pick: () => undefined,
    clientBoxOf: () => ({ x: 10, y: 20, w: 30, h: 40 }),
    worldBoundsOf: () => undefined,
    view: () => view,
    hold: () => {
      log.push("hold")
      return () => log.push("resume")
    },
  })

  test("entering holds the level and remembers its view; leaving puts the view back to the value and resumes", () => {
    const view = new ViewLayer(new Observer())
    view.delta = { phi: 0.3, theta: -0.2, tilt: 0, dolly: 0.7, x: 12, y: -4, z: 1 }
    const before = { ...view.delta }
    const log: string[] = []
    const stack = new NestStack()
    const s = surface(view, log)
    const saved = stack.enter(s, new Beacon())
    expect(saved.box).toEqual({ x: 10, y: 20, w: 30, h: 40 })
    // Inside, the view flies into the symbol and on.
    view.delta = { ...view.delta, dolly: -3, x: 99 }
    const left = stack.leave(s)
    left!.resume()
    expect(view.delta).toEqual(before)
    expect(log).toEqual(["hold", "resume"])
    expect(stack.depth).toBe(0)
  })

  test("a glided return lands on exactly the saved value", () => {
    const view = new ViewLayer(new Observer())
    view.delta = { phi: 0.123456789, theta: 0, tilt: 0, dolly: 0.5, x: 1, y: 2, z: 3 }
    const before = { ...view.delta }
    const stack = new NestStack()
    const s = surface(view, [])
    stack.enter(s, new Beacon())
    view.delta = { ...view.delta, dolly: -4 }
    stack.leave(s, { glide: 0.8, now: 1000 })
    view.step(1400)
    expect(view.delta).not.toEqual(before)
    view.step(1800)
    expect(view.delta).toEqual(before)
  })

  test("as deep as you like: a stack, popped in reverse", () => {
    const stack = new NestStack()
    const s = surface(new ViewLayer(new Observer()), [])
    stack.enter(s, new Beacon())
    stack.enter(s, new Lens())
    expect(stack.path).toEqual(["Beacon", "Lens"])
    expect(stack.leave(s)!.name).toBe("Lens")
    expect(stack.leave(s)!.name).toBe("Beacon")
    expect(stack.leave(s)).toBeUndefined()
  })
})

class EyeDream extends Dream {
  eye = new Eye()
  unfold() {
    this.stage(this.eye)
    this.play(this.eye.stateAxis("opening").to("closed"), 1)
    this.play(this.eye.stateAxis("opening").to("open"), 1)
  }
}

describe("the symbol with its state space — the lattice", () => {
  test("a songless symbol with states opens beside its lattice, the lattice's nodes walkable", () => {
    const Beside = latticeDream(Eye, "Eye")!
    expect(Beside.name).toBe("EyeLatticeDream")
    const d = new Beside() as Dream & { symbol: Eye; lattice: StateLattice }
    expect(d.symbol).toBeInstanceOf(Eye)
    expect(d.lattice).toBeInstanceOf(StateLattice)
    expect(d.stateSpace()?.axes.length ?? 0).toBeGreaterThan(0)
    // A symbol with no states has no lattice to stand beside: it opens alone.
    expect(latticeDream(Shard, "Shard")).toBeUndefined()
  })

  test("a symbol with a WatchMe shows its lattice on demand, the WatchMe's song as its playhead", () => {
    const Through = songLatticeDream(EyeDream, "Eye")
    const d = new Through() as Dream & { lattice: StateLattice; built: { duration: number } }
    expect(d.lattice.playhead).toBe("song")
    expect(d.built.duration).toBeCloseTo(2, 6)
    expect(d.lattice.machine?.parts.length ?? 0).toBeGreaterThan(0)
    // statesOf: a WatchMe'd symbol → its song through the lattice; a songless one → the lattice beside it.
    const wm = statesOf(scenes, new Beacon())
    expect(wm).toMatchObject({ alone: false, framed: true, key: "ib-beacon ◇" })
    expect(statesOf({}, new Eye())).toMatchObject({ alone: true, framed: true })
  })
})

describe("levels kept built (LevelCache) — a recall into a prepared or a closed level, and out", () => {
  const sym = () => new Lens()

  test("a closed level is taken back as it was; taking it leaves the cache", async () => {
    const released: string[] = []
    const cache = new LevelCache<string>(2, (l) => released.push(l))
    const a = sym()
    cache.keep(a, "unpack", Promise.resolve("A"))
    expect(await cache.take(a, "unpack", 100)).toBe("A")
    expect(cache.count).toBe(0)
    expect(await cache.take(a, "unpack", 100)).toBeUndefined()
    expect(released).toEqual([])
  })

  test("a slot's prepared level is pinned: hovers past the size evict the others, never it", async () => {
    const released: string[] = []
    const cache = new LevelCache<string>(2, (l) => released.push(l))
    const slot = sym()
    cache.keep(slot, "unpack", Promise.resolve("slot"), true)
    for (const name of ["h1", "h2", "h3"]) cache.keep(sym(), "unpack", Promise.resolve(name))
    await Promise.resolve()
    await Promise.resolve()
    expect(cache.has(slot, "unpack")).toBe(true)
    expect(released.sort()).toEqual(["h1", "h2"])
    expect(await cache.take(slot, "unpack", 100)).toBe("slot")
  })

  test("a level still being prepared is waited for only so long; when it lands late it is let go, not leaked", async () => {
    const released: string[] = []
    const cache = new LevelCache<string>(2, (l) => released.push(l))
    const a = sym()
    let land!: (v: string) => void
    cache.keep(a, "unpack", new Promise((r) => (land = r)))
    expect(await cache.take(a, "unpack", 20)).toBeUndefined() // the open builds its own
    land("late")
    await new Promise((r) => setTimeout(r, 0))
    expect(released).toEqual(["late"])
  })

  test("a level that lands in time is the one opened", async () => {
    const cache = new LevelCache<string>(2, () => {})
    const a = sym()
    cache.keep(a, "unpack", new Promise((r) => setTimeout(() => r("ready"), 10)))
    expect(await cache.take(a, "unpack", 500)).toBe("ready")
  })
})
