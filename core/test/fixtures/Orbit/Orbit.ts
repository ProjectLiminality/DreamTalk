/** Orbit.ts — fixture standing in for an already-fetched git part. */
import { Holon } from "../../../src/holon"
import { angle } from "../../../src/params"

export class Orbit extends Holon {
  phase = angle(0)
}
