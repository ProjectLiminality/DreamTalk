/**
 * TrueType Collection (`.ttc`) → one standalone `.ttf`.
 *
 * WHY THIS EXISTS. The PL02 deck sets its type in **HelveticaNeue** and
 * **HelveticaNeue-Bold** (recon report §"Typography and palette"), and
 * the face is the last 4.6% of the title card: Arimo sets "Project
 * Liminality" 580 px wide where HelveticaNeue-Bold sets it 608
 * (p1-importer.md §4). macOS ships the real faces at
 * `/System/Library/Fonts/HelveticaNeue.ttc` — but Apple's fonts are
 * proprietary and CANNOT be committed to this public repo, so the
 * pipeline is: read the system collection AT RUNTIME on the machine that
 * has it, extract the one face into a LOCAL, GITIGNORED cache
 * (`refs/fonts/`), and fall back to the vendored Arimo everywhere else.
 * `core/demo/fonts/README.md` records the fidelity difference.
 *
 * WHY EXTRACTION IS NEEDED AT ALL. three-text's FontLoader rejects
 * anything whose sfnt signature is not `0x00010000` or `OTTO`
 * (node_modules/three-text/dist/index.js — `validSignatures`), and it
 * calls `hb.createFace(blob, 0)` with the face index hardcoded to zero.
 * A `.ttc` signs `ttcf` and carries 14 faces, so neither the format nor
 * the index would land: face 0 of HelveticaNeue.ttc is Regular, and the
 * title card wants Bold. Rather than patch a dependency, the collection
 * is unpacked into an ordinary single-face `.ttf` that every consumer
 * already understands.
 *
 * WHAT THE UNPACK IS. An sfnt is a 12-byte header, a directory of
 * 16-byte table records (tag, checksum, offset, length), and the table
 * bodies. A `.ttc` is a `ttcf` header holding N of those directories
 * whose records point into ONE shared body pool — Apple's collection
 * shares `fpgm`, `prep`, `cvt ` and more across faces, which is the
 * whole point of the format. So extracting face k is: take its
 * directory, copy each table's bytes out of the pool, and write a fresh
 * single-face sfnt with the offsets renumbered. Nothing is re-encoded;
 * every glyph outline, every metric and every cmap subtable is the
 * bytes Apple shipped.
 *
 * The two things that are NOT a straight copy, both required by the
 * spec (OpenType, "Font Collections" and "The TTC File Format"):
 *   • tables are 4-byte aligned and the padding is zero-filled;
 *   • `head.checkSumAdjustment` is a function of the WHOLE file, so it
 *     is zeroed before the file checksum is taken and written after.
 * A reader that ignores checksums works either way; one that does not
 * (and Apple's own tools do not) rejects a file that skips this.
 *
 * The result is byte-for-byte deterministic — same collection, same
 * index, same file — which is what lets the cache be a cache rather
 * than a build step, and what the test pins.
 */

const SFNT_TRUETYPE = 0x00010000
const SFNT_CFF = 0x4f54544f // 'OTTO'
const TTC_TAG = 0x74746366 // 'ttcf'

/** One table record from a face's directory. */
interface TableRecord {
  tag: string
  checksum: number
  offset: number
  length: number
}

/** What a collection holds, without unpacking anything. */
export interface TtcFace {
  /** Its index in the collection — what `extractFace` takes. */
  index: number
  /** The PostScript name (`name` ID 6), e.g. `HelveticaNeue-Bold`. */
  postScriptName: string
  /** The family name (`name` ID 1), e.g. `Helvetica Neue`. */
  family: string
  /** The subfamily (`name` ID 2), e.g. `Bold`. */
  subfamily: string
}

const readTag = (bytes: Uint8Array, at: number): string =>
  String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!)

/** The offsets of every face's directory in a `.ttc`. */
const faceOffsets = (view: DataView): number[] => {
  if (view.getUint32(0) !== TTC_TAG) throw new Error("not a TrueType Collection (no 'ttcf' tag)")
  const count = view.getUint32(8)
  const offsets: number[] = []
  for (let i = 0; i < count; i++) offsets.push(view.getUint32(12 + i * 4))
  return offsets
}

/** One face's table directory. */
const directory = (view: DataView, bytes: Uint8Array, faceOffset: number): TableRecord[] => {
  const numTables = view.getUint16(faceOffset + 4)
  const records: TableRecord[] = []
  for (let i = 0; i < numTables; i++) {
    const at = faceOffset + 12 + i * 16
    records.push({
      tag: readTag(bytes, at),
      checksum: view.getUint32(at + 4),
      offset: view.getUint32(at + 8),
      length: view.getUint32(at + 12),
    })
  }
  return records
}

/**
 * The `name` table's strings for one face, by name ID.
 *
 * Both platform encodings that matter are handled: Windows (platform 3)
 * and Unicode (platform 0) store UTF-16BE, Macintosh (platform 1) stores
 * a single-byte encoding — for the ASCII names we read here (family,
 * subfamily, PostScript) the low byte is the character in every case.
 * The first record found for an ID wins, and the loop prefers the
 * Windows record because it comes first in Apple's own tables.
 */
const nameStrings = (
  view: DataView,
  bytes: Uint8Array,
  nameOffset: number,
): Map<number, string> => {
  const out = new Map<number, string>()
  const count = view.getUint16(nameOffset + 2)
  const storage = nameOffset + view.getUint16(nameOffset + 4)
  for (let i = 0; i < count; i++) {
    const at = nameOffset + 6 + i * 12
    const platform = view.getUint16(at)
    const nameId = view.getUint16(at + 6)
    const length = view.getUint16(at + 8)
    const offset = view.getUint16(at + 10)
    if (out.has(nameId)) continue
    const raw = bytes.subarray(storage + offset, storage + offset + length)
    let text = ""
    if (platform === 3 || platform === 0) {
      for (let k = 0; k + 1 < raw.length; k += 2) text += String.fromCharCode((raw[k]! << 8) | raw[k + 1]!)
    } else {
      for (let k = 0; k < raw.length; k++) text += String.fromCharCode(raw[k]!)
    }
    out.set(nameId, text)
  }
  return out
}

/** Every face in a collection, named — the menu `extractFace` indexes into. */
export const listFaces = (collection: Uint8Array): TtcFace[] => {
  const view = new DataView(collection.buffer, collection.byteOffset, collection.byteLength)
  return faceOffsets(view).map((faceOffset, index) => {
    const name = directory(view, collection, faceOffset).find((t) => t.tag === "name")
    const strings = name ? nameStrings(view, collection, name.offset) : new Map<number, string>()
    return {
      index,
      postScriptName: strings.get(6) ?? "",
      family: strings.get(1) ?? "",
      subfamily: strings.get(2) ?? "",
    }
  })
}

/** The index of the face with this PostScript name, or −1. */
export const faceIndexOf = (collection: Uint8Array, postScriptName: string): number =>
  listFaces(collection).find((f) => f.postScriptName === postScriptName)?.index ?? -1

/**
 * The sfnt checksum of a byte range: the sum of its big-endian uint32s,
 * modulo 2^32, with the tail zero-padded to a word (OpenType, "Calculating
 * checksums"). `>>> 0` after every add keeps the running total in the
 * unsigned 32-bit range JavaScript's bitwise ops define.
 */
export const sfntChecksum = (bytes: Uint8Array, from: number, length: number): number => {
  let sum = 0
  for (let at = from; at < from + length; at += 4) {
    const b0 = bytes[at] ?? 0
    const b1 = bytes[at + 1] ?? 0
    const b2 = bytes[at + 2] ?? 0
    const b3 = bytes[at + 3] ?? 0
    sum = (sum + (((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0)) >>> 0
  }
  return sum
}

/**
 * Extract one face of a `.ttc` as a standalone single-face sfnt.
 *
 * The tables are emitted in the directory's own order (which is
 * alphabetical by tag in every Apple collection, and is what the spec
 * asks for anyway), each 4-byte aligned. Table CHECKSUMS are recomputed
 * rather than copied: the collection's stored values are correct for the
 * same bytes, but recomputing costs one pass and makes the output
 * self-consistent even if a source directory is stale.
 */
export const extractFace = (collection: Uint8Array, index: number): Uint8Array => {
  const view = new DataView(collection.buffer, collection.byteOffset, collection.byteLength)
  const offsets = faceOffsets(view)
  const faceOffset = offsets[index]
  if (faceOffset === undefined) {
    throw new Error(`face ${index} out of range (collection holds ${offsets.length})`)
  }
  const sfntVersion = view.getUint32(faceOffset)
  if (sfntVersion !== SFNT_TRUETYPE && sfntVersion !== SFNT_CFF) {
    throw new Error(`face ${index} has an unknown sfnt version 0x${sfntVersion.toString(16)}`)
  }
  const tables = directory(view, collection, faceOffset)

  const align4 = (n: number): number => (n + 3) & ~3
  const headerSize = 12 + tables.length * 16
  let total = headerSize
  for (const table of tables) total += align4(table.length)

  const out = new Uint8Array(total)
  const outView = new DataView(out.buffer)

  // The offset-table header. searchRange/entrySelector/rangeShift are the
  // spec's binary-search hints: the largest power of two ≤ numTables,
  // times 16.
  const numTables = tables.length
  let entrySelector = 0
  while (1 << (entrySelector + 1) <= numTables) entrySelector++
  const searchRange = (1 << entrySelector) * 16
  outView.setUint32(0, sfntVersion)
  outView.setUint16(4, numTables)
  outView.setUint16(6, searchRange)
  outView.setUint16(8, entrySelector)
  outView.setUint16(10, numTables * 16 - searchRange)

  let cursor = headerSize
  let headOffset = -1
  tables.forEach((table, i) => {
    out.set(collection.subarray(table.offset, table.offset + table.length), cursor)
    // The padding is already zero (a fresh Uint8Array), which is what the
    // spec requires and what makes the checksum reproducible.
    const at = 12 + i * 16
    for (let k = 0; k < 4; k++) out[at + k] = table.tag.charCodeAt(k)
    outView.setUint32(at + 8, cursor)
    outView.setUint32(at + 12, table.length)
    if (table.tag === "head") headOffset = cursor
    cursor += align4(table.length)
  })

  // head.checkSumAdjustment is a checksum OF THE WHOLE FILE, so it must be
  // zero while that checksum is taken (OpenType, "head"). Zero it, take the
  // per-table checksums and the file checksum, then write it.
  if (headOffset >= 0) outView.setUint32(headOffset + 8, 0)
  tables.forEach((table, i) => {
    const at = 12 + i * 16
    const offset = outView.getUint32(at + 8)
    outView.setUint32(at + 4, sfntChecksum(out, offset, align4(table.length)))
  })
  if (headOffset >= 0) {
    outView.setUint32(headOffset + 8, (0xb1b0afba - sfntChecksum(out, 0, total)) >>> 0)
  }
  return out
}
