/**
 * VaultDemo.ts — knowledge as managed (27:24–27:36): the Vault's frame and
 * box, its first level of Categories and pages (f8281), then the second
 * level hanging from each Category (f8296, f8326), and the hold (f12346).
 *
 * Framing: the default eye is 0.48 px per unit at 720p; the Vault's size is
 * the frame's width, 1064.5 px, its origin the frame's centre — so it lands
 * where f8326 has it.
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { Vault } from "../../vocabulary/Vault/Vault"

export class VaultDemoDream extends Dream {
  /** grow ½ of two levels: the Vault and its first level (f8281). */
  vault = new Vault({ grow: 0.5, creation: 0 })

  unfold() {
    this.play(Create(this.vault), 2.5)
    this.wait(1)
    this.play(this.vault.grow.to(1), 2)
    this.wait(2.5)
  }
}

if (import.meta.main) render(VaultDemoDream)
