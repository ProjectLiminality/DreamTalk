/**
 * dreamtalk — a recursive parametric animation framework.
 * Platonic symbols whose source code IS the thing.
 */

export { Holon, type Overrides } from "./holon"
export { Dream, Observer, render, type DreamClass, type BackdropSpec } from "./dream"
export { Timeline, type Clip } from "./timeline"
export { together, chain, type Anim, type Track, type Easing, type Windowed } from "./anim"
export {
  Param,
  State,
  state,
  derive,
  read,
  link,
  scalar,
  length,
  angle,
  bipolar,
  completion,
  integer,
  bool,
  color,
  type ParamKind,
  type ParamValue,
  type Source,
  type Readable,
} from "./params"
export { Create, UnCreate, Draw, FadeIn, FadeOut, Move, Scale, Rotate } from "./verbs"
export {
  loadManifest,
  parseManifest,
  serializeManifest,
  clearManifestCache,
  type Manifest,
  type LoadedManifest,
  type PartHandle,
} from "./manifest"
export * from "./constants"
