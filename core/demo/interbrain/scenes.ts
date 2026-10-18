/**
 * The InterBrain DreamSong's scenes (corpus #14,
 * docs/reports/interbrain-vocabulary.md) — the symbol holons' standalone
 * scenes and the chapter compositions, registered here and spread into the
 * demo registry (demo/scenes.ts) with one line, so this song's growth never
 * touches the shared registry again.
 */

import { MindDemoDream } from "./MindDemo"
import { PuppeteerDemoDream } from "./PuppeteerDemo"
import { HyperAgentDemoDream, HyperAgentUnitDemoDream } from "./HyperAgentDemo"
import { FigureBustDemoDream } from "./FigureBustDemo"
import { SandTalkDemoDream } from "./SandTalkDemo"
import { TribeDemoDream, TribeWebDemoDream, TribesDemoDream } from "./TribeDemo"
import type { DreamClass } from "../../src/dream"
import { DivideDemoDream } from "./DivideDemo"
import { DreamSongDemoDream } from "./DreamSongDemo"
import { SongLineDemoDream } from "./SongLineDemo"
import { CoherenceBeaconDemoDream } from "./CoherenceBeaconDemo"
import { NoosphereDemoDream } from "./NoosphereDemo"
import { WorldviewDemoDream } from "./WorldviewDemo"
import { FieldDemoDream, FieldSwarmDemoDream } from "./FieldDemo"
import { ConflictDemoDream } from "./ConflictDemo"
import { VisionDemoDream } from "./VisionDemo"
import { MolochEyeDemoDream } from "./MolochEyeDemo"
import { DreamNodeDemoDream } from "./DreamNodeDemo"
import { InterBrainDemoDream } from "./InterBrainDemo"
import { AttractorDemoDream } from "./AttractorDemo"
import { ResonanceDemoDream } from "./ResonanceDemo"
import { DreamGardenDemoDream } from "./DreamGardenDemo"
import { LiminalWebDemoDream } from "./LiminalWebDemo"
import { DigitalCampfireDemoDream } from "./DigitalCampfireDemo"
import { BookDemoDream, IconsDemoDream, RadioTowerDemoDream } from "./IconsDemo"
import { VaultDemoDream } from "./VaultDemo"
import { SpheresDemoDream } from "./SpheresDemo"

export const interbrainScenes: Record<string, DreamClass> = {
  "ib-icons": IconsDemoDream,
  "ib-radiotower": RadioTowerDemoDream,
  "ib-book": BookDemoDream,
  "ib-vault": VaultDemoDream,
  "ib-spheres": SpheresDemoDream,
  "ib-dreamgarden": DreamGardenDemoDream,
  "ib-liminalweb": LiminalWebDemoDream,
  "ib-campfire": DigitalCampfireDemoDream,
  "ib-divide": DivideDemoDream,
  "ib-dreamsong": DreamSongDemoDream,
  "ib-songline": SongLineDemoDream,
  "ib-beacon": CoherenceBeaconDemoDream,
  "ib-worldview": WorldviewDemoDream,
  "ib-attractor": AttractorDemoDream,
  "ib-resonance": ResonanceDemoDream,
  "ib-sandtalk": SandTalkDemoDream,
  "ib-tribe": TribeDemoDream,
  "ib-tribe-web": TribeWebDemoDream,
  "ib-tribes": TribesDemoDream,
  "ib-field": FieldDemoDream,
  "ib-field-swarm": FieldSwarmDemoDream,
  "ib-conflict": ConflictDemoDream,
  "ib-vision": VisionDemoDream,
  "ib-eye": MolochEyeDemoDream,
  "ib-dreamnode": DreamNodeDemoDream,
  "ib-interbrain": InterBrainDemoDream,
  "ib-mind": MindDemoDream,
  "ib-puppeteer": PuppeteerDemoDream,
  "ib-hyperagent": HyperAgentDemoDream,
  "ib-hyperagent-unit": HyperAgentUnitDemoDream,
  "ib-figure-bust": FigureBustDemoDream,
  "ib-noosphere": NoosphereDemoDream,
}
