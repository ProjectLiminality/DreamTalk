/**
 * COMPATIBILITY SHIM (one release). FoldableCube moved to
 * core/vocabulary/FoldableCube/ — its DreamNode-shaped home — and the
 * hinge law moved with it (the symbol file is the single source of
 * truth). This path survives only because src/geometry/xpbd.ts imports
 * `hingeAngle` from here; point new code at the vocabulary.
 */
export { FoldableCube, hingeAngle } from "../../vocabulary/FoldableCube/FoldableCube"
