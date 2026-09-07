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
import { S01Dream } from "./video01/S01"
import { S02Dream } from "./video01/S02"
import { S03Dream } from "./video01/S03"
import { S04Dream } from "./video01/S04"
import { S06Dream } from "./video01/S06"
import { S10Dream } from "./video01/S10"
import { S09Dream } from "./video01/S09"
import { S07Dream } from "./video01/S07"
import { S08Dream } from "./video01/S08"
import { S05Dream } from "./video01/S05"
import { DialecticalThinkingDream } from "./video01/DialecticalThinking"
import { CurvesShowcaseDream } from "./CurvesShowcase"
import { MagicMoveDemoDream } from "./MagicMoveDemo"
import { MolochEyeDream } from "./wall/MolochEye"
import { MindVirusDream } from "./wall/MindVirus"
import { LabyrinthDream } from "./wall/Labyrinth"
import { TheWallDream } from "./wall/TheWall"
import { FlowerDream } from "./wall/Flower"
import { TextShowcaseDream } from "./TextShowcase"
import { EyeDream } from "./vocabulary/Eye"
import { AxesDream } from "./vocabulary/Axes"
import { FoldableCubeDream } from "./vocabulary/FoldableCube"
import { CableDream } from "./vocabulary/Cable"
import { SketchDream } from "./vocabulary/Sketch"
import { Scene00Dream } from "./origins/Scene00"
import { Scene01Dream } from "./origins/Scene01"
import { Scene02Dream } from "./origins/Scene02"
import { Scene03Dream } from "./origins/Scene03"
import { Scene04Dream } from "./origins/Scene04"
import { Scene05Dream } from "./origins/Scene05"
import { Scene09Dream } from "./origins/Scene09"
import { Scene11Dream } from "./origins/Scene11"
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
  s01: S01Dream,
  s02: S02Dream,
  s03: S03Dream,
  s04: S04Dream,
  s06: S06Dream,
  s10: S10Dream,
  s09: S09Dream,
  s07: S07Dream,
  s08: S08Dream,
  s05: S05Dream,
  video01: DialecticalThinkingDream,
  magicmove: MagicMoveDemoDream,
  molocheye: MolochEyeDream,
  mindvirus: MindVirusDream,
  labyrinth: LabyrinthDream,
  thewall: TheWallDream,
  flower: FlowerDream,
  eye: EyeDream,
  axes: AxesDream,
  foldablecube: FoldableCubeDream,
  cable: CableDream,
  sketch: SketchDream,
  o00: Scene00Dream,
  o01: Scene01Dream,
  o02: Scene02Dream,
  o03: Scene03Dream,
  o04: Scene04Dream,
  o05: Scene05Dream,
  o09: Scene09Dream,
  o11: Scene11Dream,
}

export const defaultScene = "founding"
