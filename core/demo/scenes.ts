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
import { VocabShowcaseDream } from "./VocabShowcase"
import { CameraCalDream, CameraCalCylinderDream, CameraCalGridDream } from "./video01/CameraCal"
import { S04Dream } from "./video01/S04"
import { CurvesShowcaseDream } from "./CurvesShowcase"
import { TextShowcaseDream } from "./TextShowcase"
import { CylinderDream } from "../../holons/Cylinder/Cylinder"
import { CircleDream } from "../../holons/Circle/Circle"
import { SquareDream } from "../../holons/Square/Square"

export const scenes: Record<string, DreamClass> = {
  founding: CylinderDream,
  circle: CircleDream,
  square: SquareDream,
  smoke: FoundingSmokeDream,
  calibration: StrokeCalibrationDream,
  vocab: VocabShowcaseDream,
  curves: CurvesShowcaseDream,
  text: TextShowcaseDream,
  cameracal: CameraCalDream,
  cameracalcyl: CameraCalCylinderDream,
  cameracalgrid: CameraCalGridDream,
  s04: S04Dream,
}

export const defaultScene = "founding"
