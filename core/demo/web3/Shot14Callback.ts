/**
 * Shot14Callback — shot 14 (≈118.5–130s): the return of the clarity disc,
 * and its swelling into the hero's ring.
 *
 * A callback to shot 8, built on the same scene — the ClarityField — so the
 * callback is literally the same thing coming back, not a look-alike. The
 * frames at 4fps (refs, 118–131s) show:
 *
 *   117.85–120.4 the lit globe fades to BLACK (gone by 119.05), then the
 *               field fades back in already gathered, its blue-ringed disc
 *               of dots at the centre (measured at 10fps — a dip, not a
 *               cross);
 *   120–125     it holds;
 *   125–130     the disc SWELLS: the ring grows from ~58 to the ~198 units of
 *               shot 15's red ring, its blue turning red as it goes, the
 *               dots filling the growing disc, the field dissolving around
 *               it. At 130s the ring is the hero's ring and the globe begins
 *               to appear inside it (shot 15, the next chapter).
 *
 * The swelling is ClarityField's fourth beat, `expand`, which exists for this
 * shot. Its end state is chosen to equal Shot15's opening ring exactly, so
 * the cut at 130s is invisible.
 */

import { ClarityFieldDream } from "./ClarityField"

export class Shot14CallbackDream extends ClarityFieldDream {
  override unfold() {
    this.stageField()
    // The field as shot 8 left it — the song's crossfade brings it in.
    this.set(this.burst.creation.to(1), this.clarity.creation.to(1))
    // The song opens this window at 117.85 (the dip through black); the
    // swell still starts at 125.
    this.wait(7.15)
    this.play(this.expand.creation.to(1, { easing: "linear" }), 5)
  }
}
