/**
 * protocol.ts — the contract of the DreamTalk sketchpad.
 *
 * David's vision (2026-10-03): scribble on the reMarkable, select the
 * scribble with the pen button held, and let Claude LOOK at the pixels and
 * replace them with the DreamTalk symbol they mean — not a narrow
 * circle-fitter or OCR, but one general move: pixels in, vocabulary out.
 * "The same way a programmer imports modules, you import visual vocabulary
 * into your scene, and you invoke it by drawing."
 *
 * Three processes meet here, and this file is the only thing they share:
 *
 *   reMarkable ──ssh──▶ scripts/remarkable-bridge.ts ──ws──▶ daemon ──ws──▶ sketch page
 *                                                               ▲
 *                     sketch page ──POST /api/recognize──────────┘──▶ claude -p
 *
 * PAGE COORDINATES. Everything is in PAGE units: the reMarkable 2's screen
 * held on its SIDE — landscape, 1872 × 1404 (its native pixel grid, ~226
 * dpi, turned a quarter), origin top-left, y down. One coordinate system from
 * the digitizer to the recognizer means a stroke drawn on the tablet, a lasso
 * drawn with a mouse, and a symbol placed by Claude all agree without a
 * single conversion in between. Only the renderer maps page → scene, and only
 * the bridge maps page ↔ the tablet's own (portrait) screen — the quarter
 * turn lives there and nowhere else.
 */

/** The page every stroke lives on: the tablet held landscape (David, 2026-10-04). */
export const PAGE_W = 1872
export const PAGE_H = 1404

/** The tablet's screen in its native grid, as its hardware sees it: portrait. */
export const SCREEN_W = 1404
export const SCREEN_H = 1872

/**
 * Which way the tablet is turned to hold it landscape. "cw": turned a quarter
 * clockwise (its left edge becomes the top); "ccw": counter-clockwise.
 */
export type Orientation = "cw" | "ccw"

/** A point on the tablet's portrait screen → the landscape page. */
export const screenToPage = (x: number, y: number, o: Orientation): { x: number; y: number } =>
  o === "cw" ? { x: SCREEN_H - y, y: x } : { x: y, y: SCREEN_W - x }

/** The landscape page → the tablet's portrait screen (the inverse). */
export const pageToScreen = (x: number, y: number, o: Orientation): { x: number; y: number } =>
  o === "cw" ? { x: y, y: SCREEN_H - x } : { x: SCREEN_W - y, y: x }

/** One sample of the pen. */
export interface PenSample {
  x: number
  y: number
  /** 0..1. Zero while hovering. */
  pressure: number
  /** Milliseconds, monotonic within a session. */
  t: number
}

/**
 * A pen event as it crosses the wire, from ANY source — the reMarkable bridge
 * or the browser's own pointer. The page never needs to know which.
 *
 *   down/move/up — contact with the surface
 *   hover       — pen in range, not touching (the rM2 digitizer reports this,
 *                 which is what lets the side button act without contact)
 *   button      — the side button changed state (press or release)
 */
export type PenEvent =
  | { kind: "down" | "move" | "up"; sample: PenSample; button: boolean; eraser: boolean }
  | { kind: "hover"; sample: PenSample; button: boolean }
  | { kind: "button"; pressed: boolean; sample: PenSample }
  /** The pen left the digitizer's range — hide the presence cursor. */
  | { kind: "leave" }
  /**
   * A finger gesture on the tablet's TOUCHSCREEN (a separate digitizer from
   * the pen). The pen draws; fingers only ever command — the convention of
   * Procreate and every serious drawing app, which is what keeps a palm
   * resting on the glass from ever becoming a stroke.
   *   undo — two-finger tap      redo — three-finger tap
   */
  | { kind: "gesture"; name: "undo" | "redo" }
  /**
   * A raw frame from the tablet's touchscreen: every finger currently down,
   * in PAGE units. An empty list means all fingers lifted. The bridge does
   * NOT interpret these — the page does, because only the page knows whether
   * there is a selection for a pinch to scale or a twist to rotate.
   */
  | { kind: "touch"; touches: { id: number; x: number; y: number }[]; t: number }
  /**
   * The bridge's own state, so the page can say plainly what is going on
   * instead of failing silently:
   *   searching   — looking for the tablet on the network
   *   needs-key   — found it, but the one-time key setup hasn't been done
   *                 (`message` carries the exact command)
   *   connected   — streaming
   *   asleep      — the tablet stopped answering (sleep); retrying quietly
   */
  | { kind: "status"; state: "searching" | "needs-key" | "connected" | "asleep"; host?: string; message?: string }

/** A raw scribble. */
export interface InkStroke {
  id: string
  points: PenSample[]
}

/**
 * A symbol from the vocabulary, placed on the page.
 *
 * `params` are the symbol's own degrees of freedom, in PAGE units where they
 * are lengths/positions — a circle's centre and radius, a cube's size and
 * rotation, a MindVirus's position, heading, fold and cable path. The
 * vocabulary entry states what each one means (sketch/vocabulary.ts).
 */
export interface PlacedSymbol {
  id: string
  symbol: string
  params: Record<string, unknown>
  /** The strokes this symbol replaced — kept so undo can restore them. */
  fromStrokes: string[]
}

/** What the recognizer is asked. */
export interface RecognizeRequest {
  /** PNG of the selected strokes, base64, cropped to their bounding box + margin. */
  png: string
  /** Where that crop sits on the page, so answers come back in PAGE units. */
  crop: { x: number; y: number; w: number; h: number }
  /** The strokes themselves, in page units — for exact geometry where pixels are coarse. */
  strokes: InkStroke[]
  /** Which vocabulary is imported into this scene (symbol ids). */
  vocabulary: string[]
  /** Which eyes read it (the page's magic switch): "auto" (the daemon's
   *  chain), "geometry", "groq", "clef", "haiku", "opus". Absent = auto. */
  backend?: string
}

/** One reading of the scribble. */
export interface Candidate {
  symbol: string
  params: Record<string, unknown>
  /** 0..1 */
  confidence: number
  /** One short line: why this symbol. Shown in the options ring. */
  why: string
  /** Shown in the chip instead of the confidence (compare: "groq 736 ms · fit 0.014"). */
  label?: string
  /** Which eyes produced it (compare mode). */
  via?: string
}

/**
 * What comes back. If one reading is clearly right, `candidates` has one
 * entry and the page replaces immediately. If several fit, the page shows
 * them in a ring around the selection and David picks.
 */
export interface RecognizeResponse {
  candidates: Candidate[]
  /** Anything the model read as a COMMENT (handwritten words, arrows) rather than shape. */
  notes?: string
  error?: string
  /** Which eyes read it ("groq:qwen/…", "cli:claude-opus-5-5", "geometry"). */
  backend?: string
  /** How well the top reading lies on the ink after fitting (sketch/fit.ts score; ~0.01 = on it). */
  fit?: number
  /** What ran, in order, and how long each took — the latency ledger. */
  stages?: RecognizeStage[]
}

/** Every available reader on the same ink, side by side (POST /api/recognize/compare). */
export interface CompareResponse {
  /** Names this comparison in .cache/sketch/compare.jsonl — the pick is logged against it. */
  id: string
  results: { backend: string; ms: number; response: RecognizeResponse }[]
}

/** One step of a reading: the model's look, the fit, a second look, … */
export interface RecognizeStage {
  name: string
  ms: number
  note?: string
}

// --- Voice instructions (scripts/instruct.ts, sketch/voice.ts) -------------------

/**
 * One edit Claude makes to the page when told what to do. Ids are real page
 * ids (the daemon maps the image's short labels back); params are PAGE units
 * and page angles, exactly as in PlacedSymbol.
 *
 *   update          merge `params` into a placed symbol (only what changes);
 *                   `symbol` turns it into another vocabulary entry
 *   add             place a new symbol
 *   remove          take a stroke or a symbol away
 *   replaceStrokes  ink → one symbol, like the recognizer's replacement
 *   transform       move / turn / scale strokes and symbols together
 *                   (xform.ts: page units, page angle, pivot defaults to
 *                   the centre of what moves)
 */
export type EditOp =
  | { op: "update"; id: string; symbol?: string; params: Record<string, unknown> }
  | { op: "add"; symbol: string; params: Record<string, unknown> }
  | { op: "remove"; id: string }
  | { op: "replaceStrokes"; strokeIds: string[]; symbol: string; params: Record<string, unknown> }
  | {
      op: "transform"
      ids: string[]
      translate?: { x: number; y: number }
      rotate?: number
      scale?: number
      pivot?: { x: number; y: number }
    }

/** What the page sends when David has spoken (or typed) an instruction. */
export interface InstructRequest {
  /** What was said, as the speech recogniser heard it. */
  transcript: string
  /** PNG of the WHOLE page (so page units = image px · PAGE_W / width), base64,
   *  the selection highlighted and every item tagged with its label. */
  png: string
  /** The selected ids; empty means the instruction is about the whole scene. */
  selection: string[]
  /** The page itself. */
  board: { strokes: InkStroke[]; symbols: PlacedSymbol[] }
  /** Imported vocabulary (symbol ids). */
  vocabulary: string[]
  /** The short tag drawn beside each item in the image (id → label). */
  labels: Record<string, string>
  /** The magic switch, as for RecognizeRequest (geometry and clef read no instructions: auto). */
  backend?: string
}

export interface InstructResponse {
  ops: EditOp[]
  /** One line for David: what was done, or why nothing was. */
  reply: string
  error?: string
}

// --- The display list: the page on the tablet's own screen (sketch/mirror.ts) ----

/**
 * ONE UNIVERSE, TWO SCREENS. The whiteboard page stays the app — state,
 * selection, recognition. The reMarkable's e-ink is its mirror: the page
 * publishes everything visible as a keyed DISPLAY LIST, and the tablet
 * (tablet/dreamtalk-pad) draws it. Everything is in PAGE units, which on the
 * rM2 are its pixels, so nothing is converted anywhere.
 *
 *   sketch page ──ws /ws/display──▶ daemon ──ws──▶ bridge ──ssh -W──▶ pad (127.0.0.1:7777)
 *
 * It is a picture, not a scene: black on white (e-ink is the light theme),
 * every symbol already flattened to the 2D polylines the Mac draws, so the
 * tablet needs no DreamTalk to show DreamTalk.
 *
 * A PRIMITIVE is one polyline or one filled polygon:
 *
 *   line   `pts` flat [x0, y0, x1, y1, …]; `w` the width (page units),
 *          one number or one per point (ink pressure); `grey` 0 = black …
 *          255 = white, default 0; `dash` [on, off] lengths along the line.
 *          Lines only ever DARKEN what is under them.
 *   fill   `pts` a closed polygon; `grey` is painted, not darkened — a
 *          black-in-the-dark-theme disk knocks out to white. `rings`, when
 *          present, splits `pts` into several closed contours (point counts,
 *          in order) filled as ONE shape by the nonzero winding rule — a
 *          glyph with its counters, the hole of an `o` wound against its
 *          outside, exactly as the font draws it.
 *
 * An ITEM is what a diff talks about: an id, a stacking order `z` (lower is
 * drawn first; ties by arrival), its primitives in drawing order, and hints
 * for a device that draws its own pen trail:
 *
 *   live    the page's echo of the pen gesture IN PROGRESS (the live stroke,
 *           the lasso). A device drawing the trail itself skips it while its
 *           pen is down — the page catches up in ≤100 ms, the nib can't wait.
 *   noInk   a control (selection handles, the ✦ chip, a ring option): a pen
 *           tip landing in its bounds acts on it instead of inking.
 *   grab    the selection frame: a BUTTON press inside it moves the
 *           selection (no lasso).
 *
 * OPS. The page sends batches (one WebSocket message = one JSON array of
 * ops); the tablet's wire is one op per line and every batch ends with
 * `flush`, so the screen changes once per batch, never half-way:
 *
 *   clear        forget every item (a snapshot starts with it)
 *   put          add the item, or replace the one with its id (the item's
 *                fields sit beside `op`: {"op":"put","id":…,"z":…,"prims":[…]})
 *   del          remove an item
 *   flush        end of a batch — draw now
 */
export type DisplayPrim =
  | { k: "line"; pts: number[]; w: number | number[]; grey?: number; dash?: [number, number] }
  | { k: "fill"; pts: number[]; grey: number; rings?: number[] }

export interface DisplayItem {
  id: string
  z: number
  prims: DisplayPrim[]
  live?: boolean
  noInk?: boolean
  grab?: boolean
}

export type DisplayOp =
  | { op: "clear" }
  | ({ op: "put" } & DisplayItem)
  | { op: "del"; id: string }
  | { op: "flush" }

/** Where the tablet app listens for the display list (on the tablet's own loopback). */
export const PAD_DISPLAY_PORT = 7777
