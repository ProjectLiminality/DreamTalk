/**
 * SMark — renamed. The mark is the InterBrain film's "Vision" and lives in
 * its own DreamNode now: vocabulary/Vision/Vision.ts (2026-10-18). This
 * file only re-exports it under the old names, so existing imports (and
 * the whiteboard's `sMark`) keep working. New code imports Vision.
 */

export {
  Vision as SMark,
  VISION as SMARK,
  VISION_PEN as SMARK_PEN,
  MARK_RED,
  sBandOutline,
  sCentreline,
} from "../Vision/Vision"
