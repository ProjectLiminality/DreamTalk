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
 * PAGE COORDINATES. Everything is in PAGE units: the reMarkable 2's portrait
 * screen, 1404 × 1872 (its native pixel grid, ~226 dpi), origin top-left,
 * y down. One coordinate system from the digitizer to the recognizer means a
 * stroke drawn on the tablet, a lasso drawn with a mouse, and a symbol placed
 * by Claude all agree without a single conversion in between. Only the
 * renderer maps page → scene, in one place.
 */

/** The reMarkable 2 screen in portrait — the page every stroke lives on. */
export const PAGE_W = 1404
export const PAGE_H = 1872

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
}

/** One reading of the scribble. */
export interface Candidate {
  symbol: string
  params: Record<string, unknown>
  /** 0..1 */
  confidence: number
  /** One short line: why this symbol. Shown in the options ring. */
  why: string
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
}
