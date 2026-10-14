/**
 * The becoming view — the song's git history, scrubbed (scripts/becoming.ts).
 *
 * ⇧B opens a strip along the foot of the viewport: one chip per commit that
 * touched the song or the holons it stands on, oldest left, NOW at the
 * right edge — the knowledge crystallising outward. Choosing a chip lays
 * that commit's own player over the viewport, at the editor's t (it
 * follows the playhead); `[` / `]` step through the commits, Esc or ⇧B
 * closes. Each chip keeps a thumbnail of what it showed the first time.
 *
 * Read-only by construction: the frame is another bundle built from a
 * `git archive` of that commit, in its own document. Nothing here touches
 * the live scene, the live layer or the file.
 */

export interface BecomingCommit {
  repo: string
  sha: string
  time: number
  subject: string
  files: string[]
}

export interface BecomingOpts {
  /** Where the strip and the frame go (the viewport). */
  host: HTMLElement
  /** The 16:9 frame the historical render overlays exactly. */
  frame: HTMLElement
  sceneKey: string
  sceneFile: () => string | undefined
  currentT: () => number
  note: (text: string) => void
  signal: AbortSignal
}

export interface Becoming {
  readonly open: boolean
  /** The commit shown, or undefined for now. */
  readonly selected: BecomingCommit | undefined
  toggle(on?: boolean): Promise<boolean>
  /** Step through the commits (−1 older, +1 newer; past the newest is now). */
  step(by: number): void
  select(index: number | undefined): void
  /** Follow the playhead (called each frame; cheap when t is unchanged). */
  sync(t: number): void
  commits(): readonly BecomingCommit[]
  /** Resolves when the shown frame has rendered at t (headless). */
  settled(): Promise<boolean>
  /** A key aimed at the becoming: true when it acted. */
  key(e: KeyboardEvent): boolean
}

const THUMB_W = 96
const THUMB_H = 54

export const keyOf = (c: Pick<BecomingCommit, "repo" | "sha">): string =>
  `${c.repo ? c.repo.replace("/", "-") : "main"}-${c.sha}`

const when = (time: number): string => {
  const d = new Date(time * 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type FrameWindow = Window & { __dt?: { ready: boolean; error?: string; setT(t: number): Promise<void> } }

export const mountBecoming = (opts: BecomingOpts): Becoming => {
  const { host, frame, signal } = opts
  const strip = document.createElement("div")
  strip.className = "becoming"
  strip.style.display = "none"
  host.appendChild(strip)
  const iframe = document.createElement("iframe")
  iframe.className = "becomingframe"
  iframe.style.display = "none"
  frame.appendChild(iframe)
  const caption = document.createElement("div")
  caption.className = "becomingcaption"
  caption.style.display = "none"
  frame.appendChild(caption)
  signal.addEventListener("abort", () => {
    strip.remove()
    iframe.remove()
    caption.remove()
  })

  let open = false
  let list: BecomingCommit[] = [] // oldest first
  let index: number | undefined // undefined = now
  let shownT = NaN
  /** Bumped per shown commit — a load that arrives for an older step is ignored. */
  let generation = 0
  let loading: Promise<boolean> = Promise.resolve(true)
  const thumbs = new Map<string, string>()

  const render = () => {
    strip.innerHTML = ""
    list.forEach((c, i) => {
      const chip = document.createElement("div")
      chip.className = `bchip${i === index ? " at" : ""}`
      chip.title = `${c.sha.slice(0, 7)}${c.repo ? ` (${c.repo})` : ""} · ${when(c.time)}\n${c.subject}\n${c.files.join("\n")}`
      const img = thumbs.get(keyOf(c))
      chip.innerHTML = `${img ? `<img src="${img}" width="${THUMB_W}" height="${THUMB_H}" alt="">` : `<span class="bblank"></span>`}<b>${when(c.time)}</b>`
      chip.addEventListener("click", () => api.select(i))
      strip.appendChild(chip)
    })
    const now = document.createElement("div")
    now.className = `bchip now${index === undefined ? " at" : ""}`
    now.innerHTML = `<span class="bblank"></span><b>now</b>`
    now.title = "the working tree — the live editor"
    now.addEventListener("click", () => api.select(undefined))
    strip.appendChild(now)
    strip.querySelector(".at")?.scrollIntoView({ inline: "nearest", block: "nearest" })
  }

  /** Wait for the frame's player, then hold it at t and keep a thumbnail. */
  const settle = async (c: BecomingCommit, t: number): Promise<boolean> => {
    const deadline = performance.now() + 60000
    for (;;) {
      const w = iframe.contentWindow as FrameWindow | null
      if (w?.__dt?.error) {
        caption.textContent = `${c.sha.slice(0, 7)} · could not run: ${w.__dt.error.split("\n")[0]}`
        return false
      }
      if (w?.__dt?.ready) {
        // That player's own readout would sit under the strip: the caption says it all.
        const readout = iframe.contentDocument?.getElementById("readout")
        if (readout) readout.style.display = "none"
        await w.__dt.setT(t)
        shownT = t
        if (!thumbs.has(keyOf(c))) {
          try {
            const canvas = iframe.contentDocument?.querySelector("canvas")
            if (canvas) {
              const small = document.createElement("canvas")
              small.width = THUMB_W * 2
              small.height = THUMB_H * 2
              small.getContext("2d")!.drawImage(canvas, 0, 0, small.width, small.height)
              thumbs.set(keyOf(c), small.toDataURL("image/jpeg", 0.7))
              render()
            }
          } catch {}
        }
        return true
      }
      if (performance.now() > deadline || signal.aborted) return false
      await new Promise((r) => setTimeout(r, 150))
    }
  }

  const show = () => {
    const c = index === undefined ? undefined : list[index]
    render()
    if (!c) {
      iframe.style.display = caption.style.display = "none"
      iframe.removeAttribute("src")
      return
    }
    const t = opts.currentT()
    iframe.style.display = caption.style.display = ""
    caption.textContent = `${c.sha.slice(0, 7)}${c.repo ? ` · ${c.repo}` : ""} · ${when(c.time)} · ${c.subject}`
    const q = new URLSearchParams({ scene: opts.sceneKey, t: t.toFixed(3), hud: "0" })
    shownT = NaN
    // Settle only once the NEW document has loaded — until then contentWindow
    // is still the previous commit's, already ready.
    const gen = ++generation
    loading = new Promise<boolean>((done) => {
      // A quicker step replaced this one: its load is the next commit's, not ours.
      iframe.addEventListener("load", () => done(gen === generation ? settle(c, t) : false), { once: true, signal })
    })
    iframe.src = `/becoming/${keyOf(c)}/demo/?${q}`
  }

  const api: Becoming = {
    get open() {
      return open
    },
    get selected() {
      return index === undefined ? undefined : list[index]
    },
    async toggle(on = !open) {
      if (on === open) return open
      if (!on) {
        open = false
        index = undefined
        show()
        strip.style.display = "none"
        return false
      }
      const file = opts.sceneFile()
      if (!file) {
        opts.note("no scene file — nothing to look back on")
        return false
      }
      const res = await fetch(`/api/becoming?file=${encodeURIComponent(file)}`).catch(() => undefined)
      if (!res?.ok) {
        opts.note("the becoming could not be read")
        return false
      }
      list = ((await res.json()) as { commits: BecomingCommit[] }).commits.slice().reverse()
      open = true
      index = undefined
      strip.style.display = ""
      show()
      opts.note(`${list.length} commit${list.length === 1 ? "" : "s"} · [ ] step · esc closes`)
      return true
    },
    step(by) {
      if (!open || list.length === 0) return
      const at = index ?? list.length
      const next = Math.max(0, Math.min(list.length, at + by))
      api.select(next === list.length ? undefined : next)
    },
    select(i) {
      index = i === undefined || i < 0 || i >= list.length ? undefined : i
      show()
    },
    sync(t) {
      if (!open || index === undefined || t === shownT) return
      const w = iframe.contentWindow as FrameWindow | null
      if (!w?.__dt?.ready) return
      shownT = t
      void w.__dt.setT(t)
    },
    commits: () => list,
    settled: () => loading,
    key(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return false
      if (e.code === "KeyB" && e.shiftKey) {
        void api.toggle()
        return true
      }
      if (!open) return false
      if (e.code === "BracketLeft" || e.code === "BracketRight") {
        api.step(e.code === "BracketLeft" ? -1 : 1)
        return true
      }
      if (e.code === "Escape") {
        void api.toggle(false)
        return true
      }
      return false
    },
  }
  return api
}
