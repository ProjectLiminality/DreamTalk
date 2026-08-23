/**
 * Text verification harness — mounts attachText() DIRECTLY on a
 * WebGPURenderer, bypassing ThreeHost (which does not yet dispatch on
 * Text; the wiring diff is in render/text.ts's header TODO). This is
 * the rig the glyph pipeline was verified on, and the rig on which
 * troika was ruled out: it renders several strings at once, which is
 * exactly the case where troika's shared SDF atlas dropped its most
 * recently rasterized glyphs under WebGPU (see render/text.ts).
 *
 * What it puts on screen (matching the video-01 sizes, §2.10):
 *   • "trans-perspectival" at size 50 — Scene07's word, mid-Write
 *   • "dialectical thinking" at size 30 — Scene10's caption, mid-Write
 *   • a static reference row at size 50, fully written (crispness check
 *     — and the glyph-coverage check: "syn-thesis" is deliberately the
 *     LAST string laid out, so a dropped-glyph regression shows here
 *     first, as it did throughout the troika attempt)
 *   • RibbonStroke rules under each row — the family check: glyph edges
 *     and stroke edges of the same width must read as one family.
 *
 * Determinism: setT() awaits the layout promises before the first
 * render, so a capture at a given t is a pure function of t. Two
 * launches produce byte-identical PNGs (verified at t = 1.2 / 2.4 / 4.0).
 */

import * as THREE from "three/webgpu"
import { attachText, type TextBinding } from "../src/render/text"
import { RibbonStroke } from "../src/render/ribbon"
import { Text, writeWindows } from "../src/parts/text"
import { WHITE, BLUE } from "../src/constants"

declare global {
  interface Window {
    __dt?: {
      ready: boolean
      duration: number
      setT: (t: number) => Promise<void>
      play: () => void
      pause: () => void
      error?: string
      /** Harness-only: the per-letter windows, for cascade checks. */
      windows?: () => [number, number][]
    }
  }
}

const canvas = document.getElementById("stage") as HTMLCanvasElement
const readout = document.getElementById("readout") as HTMLDivElement

/** The write front over the loop: 0 → 1 across the first 4s, then hold. */
const WRITE_SECONDS = 4
const DURATION = 6

const main = async (): Promise<void> => {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true })
  await renderer.init()
  renderer.setSize(canvas.width, canvas.height, false)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  // The host's camera, verbatim (three-host.ts): 53.13° at 16/9, looking
  // down −Z at the XY plane, so screen-right = +x and screen-up = +y.
  const camera = new THREE.PerspectiveCamera(53.13, 16 / 9, 1, 100000)
  camera.position.set(0, 0, 720)
  camera.lookAt(0, 0, 0)

  // The two animated rows — Scene07's word and Scene10's caption.
  const big = new Text({ content: "trans-perspectival", size: 50, y: 150 })
  const small = new Text({ content: "dialectical thinking", size: 30, y: 0 })
  // A fully-written reference row (creation held at 1) for crispness.
  const still = new Text({ content: "syn-thesis", size: 50, y: -160, tint: BLUE })
  still.creation.value = 1

  const bindings: TextBinding[] = []
  const mount = (text: Text): void => {
    const group = new THREE.Group()
    group.position.set(text.x.value, text.y.value, text.z.value)
    scene.add(group)
    bindings.push(attachText(text, group))
  }
  mount(big)
  mount(small)
  mount(still)

  // Ribbon rules beside the rows: the AA family check — a glyph stem and
  // a stroke of the same width must show the same edge falloff.
  const rules: RibbonStroke[] = []
  for (const [y, width] of [
    [95, 5],
    [-50, 3],
    [-215, 5],
  ] as const) {
    const rule = new RibbonStroke(width)
    rule.setPoints([new THREE.Vector3(-420, y, 0), new THREE.Vector3(420, y, 0)])
    rule.style(1, 1, WHITE, width)
    scene.add(rule.mesh)
    rules.push(rule)
  }

  // Layout is async (worker typeset + font fetch). Nothing renders
  // before every glyph set has landed — that is what makes a capture at
  // a given t deterministic.
  await Promise.all(bindings.map((b) => b.ready))

  const apply = (t: number): void => {
    const p = Math.min(1, t / WRITE_SECONDS)
    big.creation.value = p
    small.creation.value = p
    for (const b of bindings) b.sync()
  }

  const draw = async (t: number): Promise<void> => {
    apply(t)
    await renderer.render(scene, camera)
  }

  await draw(0)

  let playing = true
  let t0 = performance.now()
  const frame = async (now: number): Promise<void> => {
    if (playing) {
      const t = ((now - t0) / 1000) % DURATION
      await draw(t)
      readout.textContent = `t = ${t.toFixed(2)}s / ${DURATION}s — write ${(
        Math.min(1, t / WRITE_SECONDS) * 100
      ).toFixed(0)}%`
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  window.__dt = {
    ready: true,
    duration: DURATION,
    setT: async (t: number) => {
      playing = false
      await draw(t)
      readout.textContent = `t = ${t.toFixed(2)}s (held)`
    },
    play: () => {
      t0 = performance.now()
      playing = true
    },
    pause: () => {
      playing = false
    },
    windows: () => writeWindows(big.letters.length),
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  readout.textContent = `ERROR: ${message}`
  window.__dt = {
    ready: false,
    duration: 0,
    setT: async () => {},
    play: () => {},
    pause: () => {},
    error: message,
  }
  console.error(err)
})
