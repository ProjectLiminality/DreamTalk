/**
 * dreamtalk — a recursive parametric animation framework.
 * Platonic symbols whose source code IS the thing.
 */

export { Holon, type Overrides } from "./holon"
export { Dream, Observer, render, type DreamClass, type BackdropSpec } from "./dream"
export { Timeline, type Clip } from "./timeline"
export { together, chain, eased, restage, type Anim, type Track, type Easing, type Windowed } from "./anim"
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
export { Create, UnCreate, Draw, UnDraw, Erase, FadeIn, FadeOut, Move, Scale, Rotate } from "./verbs"
export {
  DrawSteady,
  UnDrawSteady,
  planSteady,
  steadyDuration,
  orderStrokes,
  strokesOf,
  polylineLength,
  type StrokeOrder,
  type SteadyPlan,
} from "./steady"
// NOTE: the manifest loader is deliberately NOT re-exported here — it is
// node-side (fs/path) and this barrel is reached by browser bundles.
// Import it via the "dreamtalk/manifest" subpath in node contexts.
export * from "./constants"
