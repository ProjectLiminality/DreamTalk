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
import { Scene06Dream } from "./origins/Scene06"
import { Scene07Dream } from "./origins/Scene07"
import { Scene07_1Dream } from "./origins/Scene07_1"
import { Scene08Dream } from "./origins/Scene08"
import { Scene09Dream } from "./origins/Scene09"
import { Scene10Dream } from "./origins/Scene10"
import { Scene11Dream } from "./origins/Scene11"
import { Scene12Dream } from "./origins/Scene12"
import { OriginsPitchDream } from "./origins/OriginsPitch"
import { TitleSlideDream } from "./pl02/TitleSlide"
import { StoryPlaceSlideDream } from "./pl02/StoryPlaceSlide"
import { DeadLivingSlideDream } from "./pl02/DeadLivingSlide"
import { Arc01Dream } from "./pl02/Arc01"
import { Mesh01Dream } from "./pl02/Mesh01"
import { Chain01Dream } from "./pl02/Chain01"
import { MagicMove01Dream } from "./pl02/MagicMove01"
import { MagicMove02Dream } from "./pl02/MagicMove02"
import { Web01Dream } from "./pl02/Web01"
import { Fractal01Dream } from "./pl02/Fractal01"
import { SetPiecesDream } from "./pl02/SetPieces"
import { Density01Dream } from "./pl02/Density01"
import { FillOnDream, FillOffDream } from "./pl02/FillProbe"
import { ProjectLiminalityDream } from "./pl02/ProjectLiminality"
import { AgentArenaDream } from "./agentarena/AgentArena"
import { CreatorModeDream } from "./creatormode/CreatorMode"
import { FourierDemoDream } from "./web3/FourierDemo"
import { QuoteDemoDream } from "./web3/QuoteDemo"
// import { MagicMove03Dream } from "./pl02/MagicMove03" // p6 died before writing it — restore on revival
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
  o06: Scene06Dream,
  o07: Scene07Dream,
  o07_1: Scene07_1Dream,
  o08: Scene08Dream,
  o09: Scene09Dream,
  o10: Scene10Dream,
  o11: Scene11Dream,
  o12: Scene12Dream,
  origins: OriginsPitchDream,
  slide: TitleSlideDream,
  slide32: StoryPlaceSlideDream,
  slide05: DeadLivingSlideDream,
  p02a: Arc01Dream,
  p02d: Mesh01Dream,
  p02e: Chain01Dream,
  p02f: MagicMove01Dream,
  p02g: MagicMove02Dream,
  p02i: Web01Dream,
  p02j: Fractal01Dream,
  p02k: SetPiecesDream,
  p02l: Density01Dream,
  p02jFillOn: FillOnDream,
  p02jFillOff: FillOffDream,
  pl02: ProjectLiminalityDream,
  // The first DreamSong woven from a whiteboard rather than a legacy video.
  agentarena: AgentArenaDream,
  // The game-mode/creator-mode flip — the load-bearing DreamOS interaction.
  creatormode: CreatorModeDream,
  // Web3 campaign — the reusable Fourier tracer, proving itself.
  fourier: FourierDemoDream,
  quote: QuoteDemoDream,
  // p02h: MagicMove03Dream, // p6 died before writing it
}

export const defaultScene = "founding"
