/**
 * catalogue.ts — what each symbol on the shelf SAYS about itself, read
 * from its own folder (sketch/catalogue.ts holds the shelf; this is the
 * half a browser cannot do).
 *
 *   GET /api/catalogue → { classes: { <Class>: { folder, description, face } } }
 *
 * A symbol's description is the first paragraph of its README — the
 * linguistic face — or, for a symbol with no README yet, the opening
 * paragraph of the doc comment on its class. Read from the files every
 * time it is asked (they are small), never from an index: an index
 * drifts, the files cannot. The recognizer and the voice instructions
 * hand the same text to the model (`describeShelf`).
 */

import { SHELF, describeGeneric } from "../sketch/catalogue"

export interface ShelfText {
  folder: string
  description: string
  /** `/api/face/<Folder>` when the folder has its canonical png. */
  face?: string
}

/** Markdown/JSDoc prose → one plain line: links, emphasis and code ticks dropped. */
const plain = (s: string): string =>
  s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()

/** The first prose paragraph of a README: no title, no image, no fence. */
export const readmeParagraph = (md: string): string | undefined => {
  for (const para of md.split(/\n\s*\n/)) {
    const t = para.trim()
    if (!t || t.startsWith("#") || t.startsWith("![") || t.startsWith("```") || t.startsWith("|")) continue
    return plain(t)
  }
  return undefined
}

/** The opening paragraph of the doc comment right above `class <name>` —
 *  or else of the module's own header comment, which speaks for it. */
export const classDocParagraph = (source: string, name: string): string | undefined => {
  const m =
    new RegExp(`/\\*\\*((?:(?!\\*/)[\\s\\S])*)\\*/\\s*export\\s+(?:abstract\\s+)?class\\s+${name}\\b`).exec(source) ??
    /^\s*\/\*\*((?:(?!\*\/)[\s\S])*)\*\//.exec(source)
  if (!m) return undefined
  const body = m[1]!
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, ""))
    .join("\n")
  for (const para of body.split(/\n\s*\n/)) {
    const t = plain(para)
    if (t) return t
  }
  return undefined
}

/** Every shelf class's own words, from disk. */
export const shelfTexts = async (repoRoot: string): Promise<Record<string, ShelfText>> => {
  const out: Record<string, ShelfText> = {}
  for (const { className, folder } of SHELF) {
    const dir = `${repoRoot}core/vocabulary/${folder}`
    const readme = Bun.file(`${dir}/README.md`)
    // The README speaks for the folder's namesake; a second class in the
    // folder (SMark beside Regenaissance) speaks through its own comment.
    let description = className === folder && (await readme.exists()) ? readmeParagraph(await readme.text()) : undefined
    if (!description) {
      const src = Bun.file(`${dir}/${className}.ts`)
      if (await src.exists()) description = classDocParagraph(await src.text(), className)
    }
    const face = (await Bun.file(`${dir}/${folder}.png`).exists()) && className === folder ? `/api/face/${folder}` : undefined
    out[className] = { folder, description: description ?? "", ...(face ? { face } : {}) }
  }
  return out
}

/** Give the generic entries their own words before a model reads them. */
export const describeShelf = async (repoRoot: string): Promise<void> => {
  try {
    describeGeneric(await shelfTexts(repoRoot))
  } catch {
    // unreadable folders keep the generic line
  }
}

export const catalogueResponse = async (repoRoot: string): Promise<Response> =>
  Response.json({ classes: await shelfTexts(repoRoot) }, { headers: { "Cache-Control": "no-store" } })
