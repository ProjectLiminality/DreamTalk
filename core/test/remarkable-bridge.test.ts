/**
 * The reMarkable bridge, verified without a reMarkable: byte-exact
 * input_event parsing for both record sizes, the digitizer→page map, and the
 * state machine that turns the kernel's change-stream into PenEvents.
 */

import { describe, expect, test } from "bun:test"
import {
  ABS_PRESSURE,
  ABS_X,
  ABS_Y,
  BTN_STYLUS,
  BTN_TOOL_PEN,
  BTN_TOUCH,
  EV_ABS,
  EV_KEY,
  EV_SYN,
  PenStateMachine,
  RM2_MAP,
  parseEvents,
  toPage,
  type RawEvent,
} from "../scripts/remarkable-bridge"
import { PAGE_H, PAGE_W } from "../sketch/protocol"

/** Encode input_events exactly as the kernel would write them. */
const encode = (events: Omit<RawEvent, "t">[], size: 16 | 24, sec = 100, usec = 250000): Uint8Array => {
  const buf = new Uint8Array(events.length * size)
  const view = new DataView(buf.buffer)
  events.forEach((e, i) => {
    const off = i * size
    if (size === 16) {
      view.setUint32(off, sec, true)
      view.setUint32(off + 4, usec, true)
    } else {
      view.setUint32(off, sec, true)
      view.setUint32(off + 8, usec, true)
    }
    const body = off + size - 8
    view.setUint16(body, e.type, true)
    view.setUint16(body + 2, e.code, true)
    view.setInt32(body + 4, e.value, true)
  })
  return buf
}

describe("parseEvents", () => {
  test("decodes 16-byte records (rM2, 32-bit ARM)", () => {
    const { events, rest } = parseEvents(encode([{ type: EV_ABS, code: ABS_X, value: 1234 }], 16), 16)
    expect(events).toEqual([{ type: EV_ABS, code: ABS_X, value: 1234, t: 100250 }])
    expect(rest.length).toBe(0)
  })

  test("decodes 24-byte records (64-bit kernels)", () => {
    const { events } = parseEvents(encode([{ type: EV_KEY, code: BTN_TOUCH, value: 1 }], 24), 24)
    expect(events[0]).toMatchObject({ type: EV_KEY, code: BTN_TOUCH, value: 1 })
  })

  test("negative values survive (tilt is signed)", () => {
    const { events } = parseEvents(encode([{ type: EV_ABS, code: 26, value: -4500 }], 16), 16)
    expect(events[0]!.value).toBe(-4500)
  })

  test("a record split across two SSH reads is carried, not lost", () => {
    const whole = encode(
      [
        { type: EV_ABS, code: ABS_X, value: 1 },
        { type: EV_ABS, code: ABS_Y, value: 2 },
      ],
      16,
    )
    const a = parseEvents(whole.slice(0, 20), 16)
    expect(a.events.length).toBe(1)
    expect(a.rest.length).toBe(4)
    const joined = new Uint8Array([...a.rest, ...whole.slice(20)])
    const b = parseEvents(joined, 16)
    expect(b.events[0]).toMatchObject({ code: ABS_Y, value: 2 })
  })
})

describe("toPage", () => {
  test("the raw extremes land on the page's corners", () => {
    const corners = [
      toPage(0, 0, RM2_MAP),
      toPage(RM2_MAP.maxX, RM2_MAP.maxY, RM2_MAP),
    ]
    for (const c of corners) {
      expect([0, PAGE_W].some((v) => Math.abs(c.x - v) < 1e-6)).toBe(true)
      expect([0, PAGE_H].some((v) => Math.abs(c.y - v) < 1e-6)).toBe(true)
    }
  })

  test("the centre is the centre, whatever the flips", () => {
    for (const flipX of [false, true]) {
      for (const flipY of [false, true]) {
        const c = toPage(RM2_MAP.maxX / 2, RM2_MAP.maxY / 2, { ...RM2_MAP, flipX, flipY })
        expect(c.x).toBeCloseTo(PAGE_W / 2, 6)
        expect(c.y).toBeCloseTo(PAGE_H / 2, 6)
      }
    }
  })
})

describe("PenStateMachine", () => {
  const frame = (m: PenStateMachine, events: Omit<RawEvent, "t">[], t: number) =>
    [...events, { type: EV_SYN, code: 0, value: 0 }].flatMap((e) => m.feed({ ...e, t }))

  test("hover → down → move → up, with pressure only while touching", () => {
    const m = new PenStateMachine(RM2_MAP)
    const hover = frame(m, [{ type: EV_KEY, code: BTN_TOOL_PEN, value: 1 }, { type: EV_ABS, code: ABS_X, value: 5000 }], 1)
    expect(hover.map((e) => e.kind)).toEqual(["hover"])

    const down = frame(m, [{ type: EV_KEY, code: BTN_TOUCH, value: 1 }, { type: EV_ABS, code: ABS_PRESSURE, value: 2048 }], 2)
    expect(down.map((e) => e.kind)).toEqual(["down"])
    expect(down[0]!.kind === "down" && down[0]!.sample.pressure).toBeCloseTo(0.5, 2)

    const move = frame(m, [{ type: EV_ABS, code: ABS_Y, value: 7000 }], 3)
    expect(move.map((e) => e.kind)).toEqual(["move"])

    const up = frame(m, [{ type: EV_KEY, code: BTN_TOUCH, value: 0 }], 4)
    expect(up.map((e) => e.kind)).toEqual(["up"])
  })

  test("the side button is reported on its own, even while hovering", () => {
    // This is what lets the button act WITHOUT the tip touching the screen.
    const m = new PenStateMachine(RM2_MAP)
    frame(m, [{ type: EV_KEY, code: BTN_TOOL_PEN, value: 1 }], 1)
    const press = frame(m, [{ type: EV_KEY, code: BTN_STYLUS, value: 1 }], 2)
    expect(press[0]).toMatchObject({ kind: "button", pressed: true })
    expect(press[1]).toMatchObject({ kind: "hover", button: true })
  })

  test("a stroke drawn with the button held carries button=true (the lasso)", () => {
    const m = new PenStateMachine(RM2_MAP)
    frame(m, [{ type: EV_KEY, code: BTN_STYLUS, value: 1 }], 1)
    const down = frame(m, [{ type: EV_KEY, code: BTN_TOUCH, value: 1 }], 2)
    expect(down.find((e) => e.kind === "down")).toMatchObject({ button: true })
  })
})
