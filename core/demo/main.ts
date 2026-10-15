/**
 * Demo host page driver — realtime playback loop + hooks for the
 * headless screenshot harness (window.__dt).
 */

import * as THREE from "three/webgpu"
import { ThreeHost } from "../src/render/three-host"
import { onTextLayout } from "../src/render/text"
import { scenes as publicScenes, defaultScene } from "./scenes"
import { localScenes } from "./localHolons"
import { httpBakeCache } from "../src/bakecache"
import { httpVoiceCache } from "../src/voice"
import { Narrator } from "../src/render/narrator"
import { EffectPlayer, type FiredSound } from "../src/render/sfx"
import { CreatorMode, isCreatorToggle } from "../editor/creator"
import { mountCreatorPanel } from "./creatorpanel"
import { mountCommentMarks } from "./commentmarks"
import { editorAddressOf, resolvePlace } from "../editor/dreamnodes"
import { frameAlone, isExplorerToggle, mountExplorer } from "./explorer"
import { GameLoop } from "./game"
import { mountHands } from "./handplay"
import { mountHandSource } from "../hands/mount"
import { mountSummoning } from "./summon"
import { mountHandUI } from "./handui"
import { SessionRecorder } from "../editor/recorder"
import { holonPathOf } from "../editor/checkpoint"

// Expose THREE for the instancing byte-identity harness (it reconstructs
// the oracle's modelView·local the way the shader does). Harness-only.
;(window as unknown as Record<string, unknown>).__THREE__ = THREE

// window.__dt is declared once, in editor/dt.ts.
import type {} from "../editor/dt"

/** The public registry plus whatever local holon scenes this build found (demo/localHolons.ts). */
const scenes = { ...publicScenes, ...localScenes }

const canvas = document.getElementById("stage") as HTMLCanvasElement
const readout = document.getElementById("readout") as HTMLDivElement

/**
 * Give any holon that can warm its bakes the chance to, before the
 * scene composes.
 *
 * A browser has no filesystem, so the daemon lends it one over
 * `/api/bake-cache` (src/bakecache.ts). This runs BEFORE mount because
 * composition is synchronous and a fetch is not: by the time the scene
 * builds, the tracks are either in hand or absent, and absent simply
 * means "simulate", exactly as before.
 *
 * Duck-typed on purpose. The demo boot has no business knowing which
 * holons bake — a scene without any is a no-op here, and a future
 * baking holon joins by having the method.
 */
const warmBakes = async (dream: object): Promise<void> => {
  const cache = httpBakeCache()
  const warmable = Object.values(dream).filter(
    (v): v is { warmCables(c: unknown): Promise<{ hits: number; total: number }> } =>
      typeof (v as { warmCables?: unknown })?.warmCables === "function",
  )
  for (const holon of warmable) {
    try {
      const { hits, total } = await holon.warmCables(cache)
      if (hits > 0) console.log(`[dreamtalk] bake cache: ${hits}/${total} tethers warm`)
    } catch {
      // The cache is an accelerator. Never a boot failure.
    }
  }
}

const main = async () => {
  const query = new URLSearchParams(location.search)
  const requested = query.get("scene") ?? defaultScene
  const sceneName = scenes[requested] ? requested : defaultScene
  // `path` walks down the holarchy from the scene (demo/explorer.ts): the
  // page IS the DreamNode at its end — window ≡ folder ≡ DreamNode.
  const place = resolvePlace(scenes, sceneName, query.get("path")?.split("/").filter(Boolean) ?? [])
  const DreamCtor = place.Dream
  const dream = new DreamCtor()
  await warmBakes(dream)
  // Optimization A: ribbon instancing, AUTO by default — the host counts the
  // scene's strokes and batches only above INSTANCE_THRESHOLD, where it wins
  // (walls); light scenes keep the per-mesh oracle. `?instanced=1|0` forces
  // it on/off (the byte-identity harness drives oracle vs batch at the same
  // t and compares).
  const q = new URLSearchParams(location.search).get("instanced")
  const useInstancedRibbons = q === "1" ? true : q === "0" ? false : "auto"
  const host = await ThreeHost.mount(dream, canvas, { useInstancedRibbons })
  if (place.alone) await frameAlone(host, dream, canvas)
  const duration = dream.duration

  // Narration, if the scene has any and the daemon has the audio. A scene
  // with no say() calls, or with nothing synthesized yet, simply plays
  // silently — see src/render/narrator.ts.
  const narrator = new Narrator(dream.narration, httpVoiceCache())

  // Effect sounds (src/sound.ts): ON by default, `m` or the label mutes,
  // `?sound=0` starts muted. Every fired sound is logged on window.__sfx —
  // the headless harness cannot hear, so it reads what was asked for.
  const sfxLog: FiredSound[] = []
  const sfx = new EffectPlayer(dream.soundtrack, {
    narration: dream.narration,
    onFire: (f) => sfxLog.push(f),
  })
  sfx.muted = query.get("sound") === "0"
  ;(window as unknown as Record<string, unknown>).__sfx = {
    events: dream.soundtrack.events,
    log: sfxLog,
    get muted() {
      return sfx.muted
    },
  }
  // The label exists only for a song that has sounds, so every silent
  // scene's screenshots are exactly what they were.
  let soundLabel: HTMLDivElement | undefined
  const toggleSound = () => {
    sfx.muted = !sfx.muted
    if (soundLabel) soundLabel.textContent = sfx.muted ? "sound off (m)" : "sound on (m)"
  }
  if (!sfx.isEmpty) {
    soundLabel = document.createElement("div")
    soundLabel.style.cssText =
      "position:fixed;bottom:10px;right:12px;color:#555;font:12px monospace;cursor:pointer;user-select:none"
    soundLabel.textContent = sfx.muted ? "sound off (m)" : "sound on (m)"
    soundLabel.addEventListener("click", toggleSound)
    document.body.appendChild(soundLabel)
  }

  // `?t=` starts the song there (the explorer's way back up; the editor's link).
  const startT = Math.max(0, Number(query.get("t")) || 0) % (duration || 1)
  let playing = true
  let t0 = performance.now() - startT * 1000
  /** The t on screen — where creator mode freezes the world, and resumes it. */
  let current = startT

  // --- The game loop (demo/game.ts) — Space: the world holds and is walkable.
  const ac = new AbortController()
  const game = new GameLoop(
    {
      canvas,
      pick: (x, y) => pickAt(x, y),
      boundsOf: (h) => host.boundsOf(h),
      worldBoundsOf: (h) => host.worldBoundsOf(h),
      setBeforeSync: (fn) => (host.beforeSync = fn),
      // A handle's glow (src/glow.ts); the game loop renders every frame.
      attend: (channel, holon, amount) => host.attend(channel, holon, amount),
    },
    {
      roots: dream.roots,
      space: dream.stateSpace(),
      observer: dream.observer,
      animated: new Set(dream.build().params),
      suspended: () => creator.on || explorer.on,
      hud: query.get("hud") !== "0",
      signal: ac.signal,
    },
  )
  const toggleGame = async () => {
    if (game.on) {
      game.leave()
      t0 = performance.now() - game.heldAt * 1000
      playing = true
      return
    }
    playing = false
    narrator.update(Number.NaN, false)
    sfx.update(Number.NaN, false)
    await host.renderFrame(current)
    game.enter(current)
  }

  const frame = async (now: number) => {
    game.hold(creator.on || explorer.on, now)
    game.tick(now)
    ;(window as unknown as { __dtRecorder?: SessionRecorder }).__dtRecorder?.tick(now)
    if (game.on && !creator.on && !explorer.on) {
      await host.renderFrame(game.heldAt)
      readout.textContent = `t = ${game.heldAt.toFixed(2)}s · free ${game.automaton.clock.toFixed(1)}s (space: song)`
    } else if (playing) {
      const t = ((now - t0) / 1000) % duration
      current = t
      await host.renderFrame(t)
      narrator.update(t, true)
      sfx.update(t, true)
      readout.textContent = `t = ${t.toFixed(2)}s / ${duration.toFixed(2)}s`
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  // A held frame (creator mode, or the harness's setT) draws nothing on its
  // own, so a Text whose string changed would keep its old glyphs until
  // something rendered again. Redraw the held t when a layout lands —
  // which is what makes a random-access setT across a rule change exact.
  onTextLayout(() => {
    if (!playing) void host.renderFrame(current)
  })

  // --- Creator mode (editor/creator.ts) ------------------------------------
  //
  // One key, from anywhere in the song: the world holds still at this t,
  // the arrow becomes the golden dot, and a click selects instead of
  // firing. The key again (or Esc) and the song carries on from where it
  // stood. Nothing here touches the Dream — the dot is an overlay and the
  // glow is the host's interaction layer, which the harness never calls —
  // so the harness's captures are exactly what they were.
  const pickAt = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return undefined
    return host.pick(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    )
  }
  let resumeOnExit = false
  const creator: CreatorMode = new CreatorMode(
    {
      canvas,
      pick: pickAt,
      boundsOf: (h) => host.boundsOf(h),
      // The golden glow (src/glow.ts), in the host's interaction layer; the
      // world is held in creator mode, so the held frame is drawn again.
      attend: (channel, holon, amount) => {
        host.attend(channel, holon, amount)
        if (!playing) void host.renderFrame(current)
      },
    },
    {
      clickSelects: true,
      signal: ac.signal,
      onSelect: (holon) => panel.render(holon),
      onToggle: (on) => {
        panel.show(on)
        if (on) {
          resumeOnExit = playing
          playing = false
          narrator.update(Number.NaN, false)
          sfx.update(Number.NaN, false)
          readout.textContent = `t = ${current.toFixed(2)}s (creator mode)`
        } else {
          creator.select(null)
          panel.render(null)
          if (resumeOnExit) {
            t0 = performance.now() - current * 1000
            playing = true
          }
        }
      },
    },
  )
  // On an entered DreamNode the editor is pointed at what is actually on
  // screen: the node's own scene, else the scene above with it selected
  // (at the t the node was entered from — the alone page's t is its own).
  const entered = place.crumbs.length > 1
  const panel = mountCreatorPanel(
    dream,
    sceneName,
    () => current,
    (holon) => {
      creator.select(holon)
      panel.render(holon)
    },
    entered
      ? (holon) => ({
          ...editorAddressOf(scenes, sceneName, place, dream.roots, holon),
          t: place.alone ? Number(query.get("at")) || 0 : current,
        })
      : undefined,
    {
      // A note's own moment: the held world stands there, exactly as setT does.
      seek: (t) => {
        current = t
        readout.textContent = `t = ${t.toFixed(2)}s (creator mode)`
        void host.renderFrame(t).then(() => host.renderFrame(t))
      },
      onChange: (all) => marks.set(all),
      bounds: (holon) => {
        const box = host.boundsOf(holon)
        return box ? { minX: box.min.x, minY: box.min.y, maxX: box.max.x, maxY: box.max.y } : undefined
      },
      signal: ac.signal,
    },
  )
  // Open notes, marked on their holon at their t — creator mode only.
  const marks = mountCommentMarks({
    canvas,
    roots: dream.roots,
    boundsOf: (h) => host.boundsOf(h),
    now: () => current,
    active: () => creator.on,
    onPick: (c) => panel.seekTo(c),
    signal: ac.signal,
  })

  // --- The Dream Explorer (demo/explorer.ts) -------------------------------
  //
  // `~`: the scene holds still and disassembles into its DreamNodes; a
  // click enters one. Holds the song exactly as creator mode does.
  let resumeOnHome = false
  const explorer = mountExplorer({
    host,
    dream,
    canvas,
    name: place.name,
    sceneKey: sceneName,
    path: place.crumbs.slice(1).map((c) => c.name),
    crumbs: place.crumbs,
    at: query.get("at") ?? undefined,
    signal: ac.signal,
    hold: () => {
      if (creator.on) creator.toggle(false)
      resumeOnHome = playing
      playing = false
      narrator.update(Number.NaN, false)
      sfx.update(Number.NaN, false)
      readout.textContent = `t = ${current.toFixed(2)}s (dream explorer)`
      return current
    },
    release: () => {
      if (resumeOnHome) {
        t0 = performance.now() - current * 1000
        playing = true
      }
    },
  })
  ;(window as unknown as Record<string, unknown>).__dtExplorer = explorer
  if (query.get("explore") === "1") explorer.toggle(true)

  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (isExplorerToggle(e) || (e.code === "Escape" && explorer.on)) {
      e.preventDefault()
      explorer.toggle(e.code === "Escape" ? false : undefined)
      return
    }
    if (e.code === "KeyM" && !e.metaKey && !e.ctrlKey && !e.altKey && !sfx.isEmpty) {
      toggleSound()
      return
    }
    if (e.code === "Space" && !creator.on && !explorer.on && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      void toggleGame()
      return
    }
    if (e.code === "KeyR" && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      void toggleRecord()
      return
    }
    if (!creator.on && !explorer.on && game.key(e)) return
    if (isCreatorToggle(e) || (e.code === "Escape" && creator.on)) {
      e.preventDefault()
      creator.toggle(e.code === "Escape" ? false : undefined)
    }
  })
  ;(window as unknown as Record<string, unknown>).__dtCreator = creator

  ;(window as unknown as Record<string, unknown>).__dtHost = host
  // Headless driving of the game loop: enter at t, fire, render at a clock.
  ;(window as unknown as Record<string, unknown>).__dtGame = {
    game,
    enter: async (t: number) => {
      playing = false
      current = t
      await host.renderFrame(t)
      game.enter(t)
      game.at(0)
    },
    fire: (id: string, position?: string) => game.fire(id, position),
    at: async (clock: number) => {
      game.at(clock)
      await host.renderFrame(game.heldAt)
      await host.renderFrame(game.heldAt)
    },
    state: () => game.state(),
    hoverAt: (x: number, y: number) => game.hoverAt(x, y),
    clickAt: (x: number, y: number) => game.clickAt(x, y),
    // The live session (⇧R), for hands and the harness — the editor's spelling.
    session: {
      toggle: () => toggleRecord(),
      recording: () => recorder.recording,
      id: () => recorder.id,
      clock: () => recorder.clock(),
    },
  }
  // Hands (demo/handplay.ts): any HandFrame source pushes here — the
  // webcam / Leap / replay / simulator (src/hands), or a harness. In free
  // play the pinch cursor hovers and clicks symbol parts, a pinch-drag on a
  // handle scrubs its axis, closed hands grab the scene.
  // `?hands=webcam|leap|replay|sim` (hands/mount.ts): the source, in the gesture layer's screen space.
  const handSource = mountHandSource()
  const hands = mountHands({
    source: handSource?.screen,
    target: {
      live: () => game.on && !creator.on && !explorer.on,
      hoverAt: (x, y) => game.hoverAt(x, y),
      click: (x, y) => game.click(x, y),
      axisAt: (x, y) => game.axisAt(x, y),
      axisIndex: (id) => game.axisIndex(id),
      scrubAxis: (id, u) => game.scrubAxis(id, u),
      settleAxis: (id) => game.settleAxis(id),
      view: () => game.view,
      fire: (id, position) => game.fire(id, position),
      axes: () => game.automaton.axes.map((a) => ({ id: a.id, label: a.label })),
    },
    signal: ac.signal,
    // `?jev=1`: uncertain mudras are put to the intent layer (POST /api/jev).
    jev: query.get("jev") === "1",
    // No recorder in the player: with Jev on, it listens for itself.
    listen: true,
  })
  ;(window as unknown as Record<string, unknown>).__dtHands = hands
  // Calibration and hand talk, on screen while a hand is in play (C, I).
  mountHandUI(hands, ac.signal)
  // ⇧R: a live session in free play (editor/recorder.ts) — the walk, the
  // view, the voice, and the hands (they stamp on its clock) — kept in
  // refs/sessions/<id>/. The player never writes the song: stopping links to
  // the editor, which offers to (`/?scene=…&session=<id>`).
  const recorder = new SessionRecorder({
    scene: sceneName,
    sceneFile: () => undefined,
    automaton: () => game.automaton,
    observer: dream.observer,
    heldAt: () => game.heldAt,
    pathOf: (h) => {
      const path = holonPathOf(dream, h)
      return path ? `this.${path}` : undefined
    },
    focus: () => game.focus,
    clocks: () => [],
    note: (text) => (recNote.textContent = text),
  })
  // The recorder's own line (the readout is rewritten every frame in free play).
  const recNote = document.createElement("div")
  recNote.style.cssText = "position:fixed;top:10px;right:12px;color:#ff644e;font:12px monospace;z-index:50"
  document.body.appendChild(recNote)
  ac.signal.addEventListener("abort", () => recNote.remove())
  ;(window as unknown as { __dtRecorder?: SessionRecorder }).__dtRecorder = recorder
  const toggleRecord = async () => {
    if (!recorder.recording) {
      if (!game.on) await toggleGame()
      await recorder.start()
      recNote.textContent = "● recording · ⇧R stops"
      return
    }
    const id = await recorder.stop()
    if (!id) return
    const q = new URLSearchParams({ scene: sceneName, t: game.heldAt.toFixed(2), session: id })
    recNote.innerHTML = `session ${id} kept · <a href="/?${q}" style="color:#00a2ff">write it into the song ↗</a>`
  }
  // Summoning (demo/summon.ts): `invoke:<Symbol>` brings a shelf symbol in at the hand, `invoke:dismiss` sends it off.
  ;(window as unknown as Record<string, unknown>).__dtSummon = mountSummoning({ host, canvas, signal: ac.signal })
  // `?play=free`: open in the game loop, at ?t= or the song's last pose.
  if (query.get("play") === "free") {
    playing = false
    current = query.has("t") ? startT : duration
    await host.renderFrame(current)
    await host.renderFrame(current)
    game.enter(current)
  }
    /** The viewer's camera: `.orbit(dx, dy, width)`, `.pan(dx, dy, height)`, `.dolly(dy)`, `.reset(now)`. */
    view: game.view,
  window.__dt = {
    ready: true,
    duration,
    setT: async (t: number) => {
      playing = false
      current = t
      // Twice, deliberately: sync()'s screen-arc measurement projects with
      // the matrices/camera the PREVIOUS render left behind, so a single
      // render after a large jump in t (a scored frame, a chapter cut)
      // draws pen positions against a stale view. The second pass sees the
      // settled state — making setT a pure function of t, which is what
      // the harness assumes when it screenshots.
      await host.renderFrame(t)
      await host.renderFrame(t)
      // A held frame is silent: the gauntlet and every screenshot must sound
      // like nothing, because they are nothing.
      narrator.update(t, false)
      sfx.update(t, false)
      readout.textContent = `t = ${t.toFixed(2)}s (held)`
    },
    play: () => {
      t0 = performance.now()
      playing = true
    },
    pause: () => {
      playing = false
      narrator.update(Number.NaN, false)
      sfx.update(Number.NaN, false)
    },
  }
}

main().catch((err) => {
  window.__dt = {
    ready: false,
    duration: 0,
    setT: async () => {},
    play: () => {},
    pause: () => {},
    error: String(err?.stack ?? err),
  }
  readout.textContent = String(err)
})
