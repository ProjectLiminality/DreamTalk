/**
 * leap.ts — the Leap's LEAP_HAND structs → canonical Hands (src/hands.ts).
 *
 * Pure: reads a DataView over `nHands` packed LEAP_HAND structs, as LeapC
 * hands them over (scripts/leap-bridge.ts copies the memory out). The
 * offsets are LeapC.h's, Ultraleap Gemini 5.17 on arm64 macOS, measured
 * with clang's offsetof (the header packs its structs — sizes below are
 * not multiples of 8):
 *
 *   LEAP_HAND 1084 B: id 0 · type 8 (0 left, 1 right) · confidence 12 ·
 *     pinch_distance 24 · grab_angle 28 · pinch_strength 32 ·
 *     grab_strength 36 · palm 40 · digits 120 (5 × 184) · arm 1040
 *   LEAP_PALM: position 0 · velocity 24 · normal 36 · width 48 · direction 52
 *   LEAP_DIGIT 184 B: finger_id 0 · bones 4 (4 × 44: metacarpal, proximal,
 *     intermediate, distal)
 *   LEAP_BONE 44 B: prev_joint 0 · next_joint 12 · width 24 · rotation 28
 *
 * Its frame is already ours: mm, +x right, +y up from the device, +z toward
 * the user. The Leap's thumb metacarpal has zero length (its proximal bone is
 * the anatomical metacarpal), so one rule maps every digit onto MediaPipe's
 * four joints: proximal.prev, intermediate.prev, distal.prev, distal.next.
 */

import type { Hand, Vec3 } from "../src/hands"

export const LEAP_HAND_SIZE = 1084
export const LEAP_DIGIT_SIZE = 184
export const LEAP_BONE_SIZE = 44
export const LEAP_OFF = {
  id: 0,
  type: 8,
  confidence: 12,
  pinchDistance: 24,
  pinchStrength: 32,
  grabStrength: 36,
  palm: 40,
  digits: 120,
  arm: 1040,
  palmPosition: 0,
  palmNormal: 36,
  palmWidth: 48,
  palmDirection: 52,
  digitBones: 4,
  boneNext: 12,
} as const

const vec = (v: DataView, at: number): Vec3 => [
  v.getFloat32(at, true),
  v.getFloat32(at + 4, true),
  v.getFloat32(at + 8, true),
]

/** Hand `i` of the packed array in `v`. */
export const leapHand = (v: DataView, i: number): Hand => {
  const base = i * LEAP_HAND_SIZE
  const palm = base + LEAP_OFF.palm
  const bone = (d: number, b: number) => base + LEAP_OFF.digits + d * LEAP_DIGIT_SIZE + LEAP_OFF.digitBones + b * LEAP_BONE_SIZE
  const joints: Vec3[] = [vec(v, base + LEAP_OFF.arm + LEAP_OFF.boneNext)]
  for (let d = 0; d < 5; d++) {
    joints.push(vec(v, bone(d, 1)), vec(v, bone(d, 2)), vec(v, bone(d, 3)), vec(v, bone(d, 3) + LEAP_OFF.boneNext))
  }
  return {
    id: v.getUint32(base + LEAP_OFF.id, true),
    side: v.getUint32(base + LEAP_OFF.type, true) === 0 ? "left" : "right",
    joints,
    palm: {
      position: vec(v, palm + LEAP_OFF.palmPosition),
      normal: vec(v, palm + LEAP_OFF.palmNormal),
      direction: vec(v, palm + LEAP_OFF.palmDirection),
      width: v.getFloat32(palm + LEAP_OFF.palmWidth, true),
    },
    pinch: v.getFloat32(base + LEAP_OFF.pinchStrength, true),
    grab: v.getFloat32(base + LEAP_OFF.grabStrength, true),
    confidence: v.getFloat32(base + LEAP_OFF.confidence, true),
  }
}

/** All `n` hands of a tracking event's hand array. */
export const leapHands = (v: DataView, n: number): Hand[] => Array.from({ length: n }, (_, i) => leapHand(v, i))
