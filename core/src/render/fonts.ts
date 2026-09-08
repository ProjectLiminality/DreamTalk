/**
 * fonts.ts — from a deck's PostScript face name to a URL the renderer
 * can load, and the fallback chain that keeps the repo reproducible.
 *
 * THE PROBLEM. PL02's deck declares its type by PostScript name:
 * `HelveticaNeue`, `HelveticaNeue-Medium`, `HelveticaNeue-Bold`
 * (docs/reports/pl02-vocabulary.md §"Typography and palette"; the
 * importer keeps it per text record, p1-importer.md §8). The renderer's
 * bundled face is Arimo, which is Arial-metric — close enough to read as
 * the same family, and 4.6% off in width: Arimo sets "Project
 * Liminality" 580 px where HelveticaNeue-Bold sets it 608
 * (p1-importer.md §4). That 4.6% is the entire remaining gap on the
 * title card.
 *
 * THE THREE OPTIONS, AND WHY THIS IS THE ONE.
 *
 * (a) **Load the real face from the system, cache it locally.** macOS
 *     ships `/System/Library/Fonts/HelveticaNeue.ttc`, a 14-face
 *     collection holding every face the deck names. Apple's fonts are
 *     PROPRIETARY: they may be used on the machine that licenses them
 *     and may NOT be redistributed, so they cannot be committed here.
 *     But nothing stops this machine from reading its own installed
 *     font at build time. `core/scripts/system-font.ts` extracts one
 *     face into `refs/fonts/` — which `.gitignore` already excludes as
 *     "large reference material" and which is exactly the right shelf:
 *     things that exist on David's machine and are not the repo's to
 *     give away. **This is what is in force.**
 *
 * (b) A metric-compatible free clone (TeX Gyre Heros, Nimbus Sans).
 *     Not needed, and would have been a second approximation rather
 *     than the thing: those clone *Helvetica*, not Helvetica *Neue*,
 *     whose widths differ. Recorded as the option for a machine
 *     without the system font — but the fallback there is Arimo, which
 *     is already vendored, already licensed, and no worse.
 *
 * (c) Arimo plus a per-slide tracking correction. Refused. It is a fit
 *     in the DECISIONS sense — a free parameter tuned until the picture
 *     matched — and it would have to be re-tuned per string.
 *
 * THE FALLBACK IS A REAL PATH, NOT A CRASH. `fontChain` names the
 * cached system face FIRST and the vendored Arimo second, and the
 * loader walks it — so a checkout on a machine with neither the cache
 * nor macOS renders every scene, at the stated fidelity cost. Which one
 * a given run actually took is reported by the loader
 * (`loadedFaces()`), never assumed.
 *
 * THIS MODULE IS PURE, DELIBERATELY. It runs inside the browser bundle
 * (Slides.ts reaches it), so it may not touch `node:fs` — the cache is
 * probed by the loader's own fetch, which is the same request the font
 * needs anyway. A separate existence check would be a second source of
 * truth and one more thing to be stale.
 */

import { DEFAULT_FONT_URL, MONO_FONT_URL } from "./text"

/** Where the extracted single-face files live — gitignored (`refs/`). */
export const FONT_CACHE_DIR = "refs/fonts"

/**
 * The faces this repo knows how to source from the system, and the
 * collection each comes out of. Keyed by PostScript name, which is what
 * a Keynote text record states.
 *
 * Only PL02's three are listed: the deck's own font inventory is
 * HelveticaNeue, -Medium and -Bold plus one stray `Helvetica`
 * (docs/reports/pl02-vocabulary.md), and speculatively listing faces no
 * chapter has asked for is exactly the people-pleasing CLAUDE.md warns
 * against. Adding one is a line.
 */
export const SYSTEM_FACES: Readonly<Record<string, string>> = {
  HelveticaNeue: "/System/Library/Fonts/HelveticaNeue.ttc",
  "HelveticaNeue-Medium": "/System/Library/Fonts/HelveticaNeue.ttc",
  "HelveticaNeue-Bold": "/System/Library/Fonts/HelveticaNeue.ttc",
  Helvetica: "/System/Library/Fonts/Helvetica.ttc",
}

/** The collection a face comes from, or undefined if it is not ours to source. */
export const systemFontPath = (postScriptName: string): string | undefined =>
  SYSTEM_FACES[postScriptName]

/** The URL the extraction script writes a face to. */
export const cachedFontUrl = (postScriptName: string): string =>
  `/${FONT_CACHE_DIR}/${postScriptName}.ttf`

/**
 * The vendored face a declared name falls back to.
 *
 * Monospace names take Cousine, everything else Arimo. Nothing in PL02
 * needs the monospace branch — the deck is Helvetica throughout — but
 * the rule belongs beside the chain rather than in a caller who would
 * then have to know about it, and o07's code panel already sets `mono`
 * by alias.
 */
export const fallbackFontUrl = (postScriptName: string | undefined): string =>
  postScriptName !== undefined && /mono|courier|menlo|consol/i.test(postScriptName)
    ? MONO_FONT_URL
    : DEFAULT_FONT_URL

/**
 * The URLs to try for a declared face, best first.
 *
 * For a face this repo can source from the system: the local cache, then
 * the vendored fallback. For anything else — an ordinary URL, an alias,
 * or nothing at all — a single entry, which is exactly what
 * `resolveFont` already returned. So a holon whose `font` is unset, or a
 * URL, or `"mono"`, keeps its previous behaviour to the byte; the chain
 * only ever has a second element for a name in SYSTEM_FACES.
 */
export const fontChain = (postScriptName: string | undefined): string[] => {
  if (postScriptName === undefined || postScriptName === "") return [DEFAULT_FONT_URL]
  if (postScriptName in SYSTEM_FACES) {
    return [cachedFontUrl(postScriptName), fallbackFontUrl(postScriptName)]
  }
  return [postScriptName]
}

/** Whether a URL is a cached system face rather than a vendored one. */
export const isSystemFace = (url: string): boolean => url.startsWith(`/${FONT_CACHE_DIR}/`)
