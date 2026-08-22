/**
 * The demo scene registry — picked by URL query, e.g. /demo?scene=calibration.
 *
 * "founding" is the Chapter-8 parable — the sovereign Cylinder repo's
 * own DreamWeaving (holons/Cylinder), drawn in from outside the core:
 * the first scene whose source of truth lives in a holon repo.
 */

import type { DreamClass } from "../src/dream"
import { FoundingSmokeDream } from "./FoundingSmoke"
import { StrokeCalibrationDream } from "./StrokeCalibration"
import { CylinderDream } from "../../holons/Cylinder/Cylinder"
import { CircleDream } from "../../holons/Circle/Circle"
import { SquareDream } from "../../holons/Square/Square"

export const scenes: Record<string, DreamClass> = {
  founding: CylinderDream,
  circle: CircleDream,
  square: SquareDream,
  smoke: FoundingSmokeDream,
  calibration: StrokeCalibrationDream,
}

export const defaultScene = "founding"
