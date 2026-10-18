/**
 * RoleMap.ts — A DreamWeaving
 *
 * The social structure lens: the rings draw on and the roles step in,
 * centre outward — leadership, the steering staff, the planners, the
 * workforce. The sites are named in their sectors; one role's risk is
 * shown (it is leaving, and its knowledge with it); then leadership's
 * intent — the decentralised workforce gathers into one shared service,
 * and the line it would need to the centre draws on.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { RoleMap } from "../../vocabulary/RoleMap/RoleMap"

export class RoleMapDream extends Dream {
  map = new RoleMap()

  unfold() {
    const m = this.map
    this.stage(m)
    this.play(Create(m), 3)
    this.wait(1)
    this.play(m.stateAxis("sites").to("shown"), 1.4)
    this.wait(1.2)
    this.play(m.stateAxis("risk").to("shown"), 1.2)
    this.wait(1.5)
    this.play(m.stateAxis("risk").to("hidden"), 0.8)
    this.play(m.stateAxis("centralise").to("shared-service"), 3.5)
    this.wait(2)
  }
}

if (import.meta.main) render(RoleMapDream)
