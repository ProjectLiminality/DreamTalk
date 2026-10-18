/**
 * SiteSystems.ts — A DreamWeaving
 *
 * Inside two sites of one organisation: both run the same ERP family, and
 * both stacks first stand on the family's standard. Then each drifts to its
 * own usage convention — the first a little, the second far — and the
 * difference is plain beside the ghost of the standard. Then what lives
 * outside the system of record flies out from behind each ERP onto its
 * ring: spreadsheets, a local tool, a warehouse system — and the ones we
 * only suspect, ghosted.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { together } from "../../src/anim"
import { MOCK_SITE_SYSTEMS, SiteSystems, type SiteSystemsData } from "../../vocabulary/SiteSystems/SiteSystems"

/** The symbol's own mock: Site 1, a little off the standard (0.4). */
const SITE_1 = MOCK_SITE_SYSTEMS

const SITE_2: SiteSystemsData = {
  site: { label: "Site 2" },
  erp: { family: "ERP A" },
  usage: 0.9,
  outside: [
    { kind: "spreadsheet", label: "capacity" },
    { kind: "localTool", label: "scheduling tool" },
    { kind: "warehouse", label: "item stock" },
    { kind: "other", label: "?", certainty: 0.15 },
  ],
}

export class SiteSystemsDream extends Dream {
  left = new SiteSystems({ observer: this.observer, data: SITE_1, x: -560, outside: 0, usage: 0 })
  right = new SiteSystems({ observer: this.observer, data: SITE_2, x: 560, outside: 0, usage: 0 })

  unfold() {
    const { left, right } = this
    this.set(...this.observer.orbit({ theta: 0.7 }), ...this.observer.dolly(2900), this.observer.fov.to(0.5))
    this.stage(left)
    this.stage(right)
    this.play(together(Create(left), Create(right)), 1.5)
    this.wait(1)
    // Same family, the standard form — then each site's own way of using it.
    this.play(together(left.usage.to(1), right.usage.to(1)), 1.8)
    this.wait(1.2)
    // What lives outside the system of record.
    this.play(together(left.outside.to(1), right.outside.to(1)), 2.6)
    this.wait(2)
  }
}

if (import.meta.main) render(SiteSystemsDream)
