/**
 * The code view (EDITOR-V4 "Code view (read-only first)").
 *
 * "Every holon already carries {file, start, end} via editor/anchors.ts,
 * so this is a lookup, not an analysis." That sentence is the whole
 * design. The panel fetches the scene's source once from the daemon's
 * /api/source, renders it as plain text, and highlights the byte range
 * the selection's anchor names. Selecting a clip highlights its
 * `play(...)` span the same way, from the same mechanism — a Clip is
 * anchored too (Dream.play returns it, so __dt wraps it).
 *
 * Read-only, by the spec: "editing stays in the file, where the daemon
 * watches it." The panel is a WINDOW onto the file, not a second place
 * the file can be changed from — which is also why it never needs to
 * reconcile: the reload round-trip re-fetches it.
 *
 * ## The anchors' offsets are UTF-16 indices, despite what they are called
 *
 * `anchors.ts` documents its spans as "byte offsets into the ORIGINAL
 * file", and this panel was written to convert them. It must not: the
 * spans come from ts-morph's `Node.getStart()/getEnd()` (scripts/ops.ts,
 * injectAnchors), and those are positions in a JavaScript string — UTF-16
 * code units. The two agree only for ASCII, and a DreamWeaving's prose
 * comments carry em-dashes and Greek letters by the dozen.
 *
 * Measured, on the file this was caught in: S04's `new Rectangle(...)`
 * sits at UTF-16 index 5004 and byte offset 5032, and the editor reports
 * its anchor as 5004 — the index. Converting it as a byte offset moved
 * the highlight 28 characters early, onto the tail of the comment above
 * the construction. So the offsets are used as they arrive.
 *
 * `byteToIndexMapper` is kept, tested, and unused by this path: the day
 * an anchor really does carry a byte offset (a Rust or Go writer, a
 * daemon that reads the file as bytes), the conversion is here and
 * correct rather than reinvented under time pressure.
 *
 * ## Syntax colouring
 *
 * Hand-rolled and deliberately thin (no dependency, per the brief): five
 * token classes — comment, string, number, keyword, and the PascalCase
 * vocabulary names, which are the words that actually matter in a
 * DreamWeaving. TASTE asks for calm, so the palette is two greys, one
 * blue for the vocabulary, and nothing else. Code that reads as a wall of
 * confetti is noise pretending to be information.
 */

import type { SourceAnchor } from "./anchors"

export interface CodeViewHandle {
  /** Show a file (fetched and cached), then highlight a span in it. */
  show(anchor: SourceAnchor | undefined): void
  /** Load a file without a highlight — the scene's own source at boot. */
  load(file: string): Promise<void>
  /** Whether the panel is currently visible. */
  readonly open: boolean
  toggle(): boolean
  setOpen(open: boolean): void
  dispose(): void
}

/** The keywords worth marking in a DreamWeaving — control flow and binding. */
const KEYWORDS = new Set([
  "import",
  "from",
  "export",
  "class",
  "extends",
  "const",
  "let",
  "new",
  "this",
  "return",
  "if",
  "else",
  "for",
  "of",
  "in",
  "function",
  "async",
  "await",
  "true",
  "false",
  "null",
  "undefined",
])

export interface Token {
  /** UTF-16 index range within the source. */
  start: number
  end: number
  cls: string
}

/**
 * Tokenize just enough to colour calmly. A single left-to-right scan:
 * comments and strings swallow their contents (so a `//` inside a string
 * is not a comment, and a quote inside a comment is not a string), then
 * numbers and words. No parser, no dependency, no attempt at correctness
 * beyond what an 11px monospace panel can show.
 */
export const tokenize = (src: string): Token[] => {
  const tokens: Token[] = []
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]!
    // Comments
    if (c === "/" && src[i + 1] === "/") {
      const end = src.indexOf("\n", i)
      tokens.push({ start: i, end: end === -1 ? n : end, cls: "c-com" })
      i = end === -1 ? n : end
      continue
    }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2)
      const stop = end === -1 ? n : end + 2
      tokens.push({ start: i, end: stop, cls: "c-com" })
      i = stop
      continue
    }
    // Strings (including templates; no interpolation handling — calm wins)
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1
      while (j < n && src[j] !== c) {
        if (src[j] === "\\") j++
        j++
      }
      tokens.push({ start: i, end: Math.min(n, j + 1), cls: "c-str" })
      i = Math.min(n, j + 1)
      continue
    }
    // Numbers
    if (c >= "0" && c <= "9") {
      let j = i
      while (j < n && /[0-9._eE]/.test(src[j]!)) j++
      tokens.push({ start: i, end: j, cls: "c-num" })
      i = j
      continue
    }
    // Words: keywords, and the PascalCase vocabulary
    if (/[A-Za-z_$]/.test(c)) {
      let j = i
      while (j < n && /[A-Za-z0-9_$]/.test(src[j]!)) j++
      const word = src.slice(i, j)
      if (KEYWORDS.has(word)) tokens.push({ start: i, end: j, cls: "c-kw" })
      else if (/^[A-Z]/.test(word)) tokens.push({ start: i, end: j, cls: "c-type" })
      i = j
      continue
    }
    i++
  }
  return tokens
}

/**
 * A byte-offset → UTF-16-index map for a source string.
 *
 * Returns a function rather than a full table: the table would be one
 * entry per byte of the file (tens of thousands of numbers) when almost
 * every lookup is one of four offsets per selection. Instead the scan
 * records only the positions where bytes and UTF-16 units diverge, which
 * for a DreamWeaving is a handful, and the lookup is a binary search over
 * that short list. Pure ASCII costs nothing at all.
 */
export const byteToIndexMapper = (src: string): ((byte: number) => number) => {
  /**
   * One mark per multi-byte character, recorded at the byte offset just
   * AFTER it — where the accumulated drift takes its new value. Recording
   * the position before the character instead would report the drift the
   * previous run had, which is the same off-by-one that shifts a highlight
   * onto the tail of the comment above it.
   */
  const marks: { byte: number; index: number }[] = []
  let byte = 0
  for (let i = 0; i < src.length; ) {
    const code = src.codePointAt(i)!
    const units = code > 0xffff ? 2 : 1
    const size = code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
    byte += size
    i += units
    if (size !== units) marks.push({ byte, index: i })
  }
  if (marks.length === 0) return (b: number) => b

  return (b: number): number => {
    // The last mark at or before b carries the drift that applies from
    // there on; everything after it up to the next mark is ASCII, so bytes
    // and UTF-16 units advance together.
    let lo = 0
    let hi = marks.length - 1
    let found = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (marks[mid]!.byte <= b) {
        found = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    if (found < 0) return b
    const mark = marks[found]!
    return b + (mark.index - mark.byte)
  }
}

interface Cached {
  text: string
  toIndex: (byte: number) => number
}

export const mountCodeView = (
  panel: HTMLElement,
  body: HTMLElement,
  title: HTMLElement,
): CodeViewHandle => {
  const files = new Map<string, Cached>()
  let open = false
  let shownFile: string | undefined
  /** Guards against a slow fetch landing after the selection moved on. */
  let generation = 0

  const setOpen = (next: boolean) => {
    open = next
    panel.classList.toggle("open", open)
    document.body.classList.toggle("codeview-open", open)
  }

  const fetchFile = async (file: string): Promise<Cached | undefined> => {
    const hit = files.get(file)
    if (hit) return hit
    try {
      const res = await fetch(`/api/source?file=${encodeURIComponent(file)}`)
      if (!res.ok) return undefined
      // The daemon names the field `source` (scripts/daemon.ts:sourceResponse),
      // alongside the hash the ops use as their base.
      const { source } = (await res.json()) as { source: string; hash: string }
      // Identity, not a conversion — see the note at the top of the file.
      const entry: Cached = { text: source, toIndex: (v) => v }
      files.set(file, entry)
      return entry
    } catch {
      return undefined
    }
  }

  /**
   * Render the file with an optional highlighted span.
   *
   * Built as three concatenated regions (before / highlight / after) so
   * the highlight is a real element that can be scrolled to, rather than
   * a background painted behind text. Tokens are clipped at the region
   * boundaries — a comment that straddles the highlight edge is split,
   * not dropped.
   */
  const render = (cached: Cached, span?: { start: number; end: number }) => {
    body.textContent = ""
    const src = cached.text
    const tokens = tokenize(src)

    const cut = (from: number, to: number, into: HTMLElement) => {
      let cursor = from
      for (const token of tokens) {
        if (token.end <= from) continue
        if (token.start >= to) break
        const s = Math.max(token.start, from)
        const e = Math.min(token.end, to)
        if (s > cursor) into.appendChild(document.createTextNode(src.slice(cursor, s)))
        const el = document.createElement("span")
        el.className = token.cls
        el.textContent = src.slice(s, e)
        into.appendChild(el)
        cursor = e
      }
      if (cursor < to) into.appendChild(document.createTextNode(src.slice(cursor, to)))
    }

    if (!span) {
      cut(0, src.length, body)
      return undefined
    }
    const start = Math.max(0, Math.min(src.length, span.start))
    const end = Math.max(start, Math.min(src.length, span.end))
    cut(0, start, body)
    const mark = document.createElement("span")
    mark.className = "c-mark"
    cut(start, end, mark)
    body.appendChild(mark)
    cut(end, src.length, body)
    return mark
  }

  const show = (anchor: SourceAnchor | undefined) => {
    const id = ++generation
    if (!anchor) {
      // Nothing selected: keep the file on screen, drop the highlight.
      const current = shownFile ? files.get(shownFile) : undefined
      if (current) render(current)
      return
    }
    void (async () => {
      const cached = await fetchFile(anchor.file)
      if (!cached || id !== generation) return
      shownFile = anchor.file
      title.textContent = anchor.file.split("/").pop() ?? anchor.file
      title.title = anchor.file
      const mark = render(cached, {
        start: cached.toIndex(anchor.start),
        end: cached.toIndex(anchor.end),
      })
      // Centre the construction rather than merely revealing it — the
      // point of the panel is to read the code AROUND the selection.
      mark?.scrollIntoView({ block: "center", behavior: "auto" })
    })()
  }

  const load = async (file: string) => {
    const cached = await fetchFile(file)
    if (!cached) {
      body.textContent = "— source unavailable (is the daemon running?)"
      return
    }
    shownFile = file
    title.textContent = file.split("/").pop() ?? file
    title.title = file
    render(cached)
  }

  return {
    show,
    load,
    get open() {
      return open
    },
    toggle() {
      setOpen(!open)
      return open
    },
    setOpen,
    dispose() {
      files.clear()
    },
  }
}
