/**
 * The demo scene registry — picked by URL query, e.g. /demo?scene=calibration.
 */

import type { DreamClass } from "../src/dream"
import { FoundingSmokeDream } from "./FoundingSmoke"
import { StrokeCalibrationDream } from "./StrokeCalibration"

export const scenes: Record<string, DreamClass> = {
  founding: FoundingSmokeDream,
  calibration: StrokeCalibrationDream,
}

export const defaultScene = "founding"
