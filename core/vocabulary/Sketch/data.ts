/**
 * The shape of a generated asset module (core/scripts/svg2ts.ts).
 *
 * Deliberately dumb: flat coordinate arrays and provenance, no methods.
 * The data is the drawing; everything that turns it into strokes lives
 * in Sketch.ts, so the checked-in modules never need regenerating when
 * the holon changes.
 */
export interface SketchData {
  /** The source file's base name — `david`, `gear_big`. */
  name: string
  /** Repo-relative path of the .svg this came from. */
  source: string
  /** First 16 hex of the source file's SHA-256, for drift detection. */
  hash: string
  /**
   * One subpath per pen stroke, as a flat [x0,y0, x1,y1, …] run in the
   * SVG's own units, centered on the origin and y-flipped. Flat rather
   * than {x,y} objects because david alone is ~9000 points and the
   * object form triples the module's size for no gain.
   */
  subpaths: number[][]
  /** Parallel to `subpaths`: 1 when the source closed it with Z. */
  closed: number[]
}
