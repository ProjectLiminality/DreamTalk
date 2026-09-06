/**
 * The parts barrel. Layer-1 primitives (the invisible assets) are
 * defined in ./primitives and re-exported whole; the sovereign symbols
 * moved to core/vocabulary/ (EDITOR-V5 "The vocabulary — organizing the
 * space the two axes span") and are re-exported below for compatibility.
 */

export * from "./primitives"

// ─── COMPATIBILITY BLOCK (one release) ──────────────────────────────
// The nine sovereign symbols now live in core/vocabulary/<Name>/ — one
// DreamNode-shaped home each, with README and face. These re-exports
// keep every old `parts/index` / `parts/<symbol>` import working while
// in-repo code migrates to the vocabulary paths. Remove after a release
// once nothing imports the symbols from here.
export * from "../../vocabulary/Cylinder/Cylinder"
export * from "../../vocabulary/Eye/Eye"
export * from "../../vocabulary/Axes/Axes"
export * from "../../vocabulary/MolochEye/MolochEye"
export * from "../../vocabulary/FoldableCube/FoldableCube"
export * from "../../vocabulary/Cable/Cable"
export * from "../../vocabulary/MindVirus/MindVirus"
export * from "../../vocabulary/TheWall/TheWall"
export * from "../../vocabulary/Labyrinth/Labyrinth"
// ────────────────────────────────────────────────────────────────────
