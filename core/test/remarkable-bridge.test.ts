/**
 * The reMarkable bridge, verified without a reMarkable: byte-exact
 * input_event parsing for both record sizes, the digitizer→page map, the
 * state machines that turn the kernel's change-streams into PenEvents (pen
 * and multitouch), and the pure halves of discovery, auth and retry.
 */

import { describe, expect, test } from "bun:test"
import {
  ABS_MT_POSITION_X,
  ABS_MT_POSITION_Y,
  ABS_MT_SLOT,
  ABS_MT_TRACKING_ID,
  ABS_PRESSURE,
  ABS_X,
  ABS_Y,
  BTN_STYLUS,
  BTN_TOOL_PEN,
  BTN_TOUCH,
  EV_ABS,
  EV_KEY,
  EV_SYN,
  NEEDS_KEY_RETRY_MS,
  PenStateMachine,
  RM2_MAP,
  RM2_TOUCH_MAP,
  StatusTracker,
  SYN_DROPPED,
  TouchStateMachine,
  TouchThrottle,
  USB_HOST,
  WLAN_ON_CMD,
  NOT_FOUND_MSG,
  usbAdvice,
  backoffMs,
  classifyLogin,
  decide,
  findDevices,
  nameCandidates,
  needsKeyMessage,
  nextState,
  parseDeviceInfo,
  rankProbes,
  retryDelay,
  sshArgs,
  subnetHosts,
  toPage,
  ORIENT,
  opsToScreen,
  parseEvents,
  type RawEvent,
  type TouchFrame,
} from "../scripts/remarkable-bridge"
import { PAGE_H, PAGE_W, screenToPage } from "../sketch/protocol"

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

describe("PenStateMachine — leave", () => {
  const frame = (m: PenStateMachine, events: Omit<RawEvent, "t">[], t: number) =>
    [...events, { type: EV_SYN, code: 0, value: 0 }].flatMap((e) => m.feed({ ...e, t }))

  test("BTN_TOOL_PEN → 0 says leave, once", () => {
    const m = new PenStateMachine(RM2_MAP)
    frame(m, [{ type: EV_KEY, code: BTN_TOOL_PEN, value: 1 }], 1)
    expect(frame(m, [{ type: EV_KEY, code: BTN_TOOL_PEN, value: 0 }], 2)).toEqual([{ kind: "leave" }])
    expect(frame(m, [], 3)).toEqual([])
  })

  test("lifting and leaving in one frame is up, then leave", () => {
    const m = new PenStateMachine(RM2_MAP)
    frame(m, [{ type: EV_KEY, code: BTN_TOOL_PEN, value: 1 }, { type: EV_KEY, code: BTN_TOUCH, value: 1 }], 1)
    const out = frame(m, [{ type: EV_KEY, code: BTN_TOUCH, value: 0 }, { type: EV_KEY, code: BTN_TOOL_PEN, value: 0 }], 2)
    expect(out.map((e) => e.kind)).toEqual(["up", "leave"])
  })

  test("a pen never seen in range never leaves", () => {
    const m = new PenStateMachine(RM2_MAP)
    expect(frame(m, [{ type: EV_KEY, code: BTN_TOOL_PEN, value: 0 }], 1)).toEqual([])
  })
})

describe("TouchStateMachine (multitouch protocol B)", () => {
  const abs = (code: number, value: number) => ({ type: EV_ABS, code, value })
  const syn = { type: EV_SYN, code: 0, value: 0 }
  /** Feed encoded bytes through the real parser, as the SSH stream would. */
  const feedBytes = (m: TouchStateMachine, events: Omit<RawEvent, "t">[]): TouchFrame[] => {
    const { events: raw } = parseEvents(encode(events, 16), 16)
    return raw.flatMap((e) => m.feed(e) ?? [])
  }
  const ident = { ...RM2_TOUCH_MAP, flipY: false }
  /** Raw touch → screen px (identity map) → the landscape page, as the bridge does. */
  const pg = (rx: number, ry: number) => screenToPage((rx / 1403) * 1404, (ry / 1871) * 1872, ORIENT)

  test("two fingers down, move, one lifts, both lift", () => {
    const m = new TouchStateMachine(ident)
    const down = feedBytes(m, [
      abs(ABS_MT_SLOT, 0), abs(ABS_MT_TRACKING_ID, 10), abs(ABS_MT_POSITION_X, 100), abs(ABS_MT_POSITION_Y, 200),
      abs(ABS_MT_SLOT, 1), abs(ABS_MT_TRACKING_ID, 11), abs(ABS_MT_POSITION_X, 700), abs(ABS_MT_POSITION_Y, 900),
      syn,
    ])
    expect(down.length).toBe(1)
    expect(down[0]!.touches.map((t) => t.id)).toEqual([10, 11])
    expect(down[0]!.touches[0]!.x).toBeCloseTo(pg(100, 200).x, 6)
    expect(down[0]!.touches[0]!.y).toBeCloseTo(pg(100, 200).y, 6)
    expect(down[0]!.touches[1]!.y).toBeCloseTo(pg(700, 900).y, 6)

    // Only slot 1's X changes; slot 0 keeps its last position.
    const move = feedBytes(m, [abs(ABS_MT_POSITION_X, 750), syn])
    expect(move[0]!.touches[0]).toMatchObject(pg(100, 200))
    expect(move[0]!.touches[1]!.x).toBeCloseTo(pg(750, 900).x, 6)
    expect(move[0]!.touches[1]!.y).toBeCloseTo(pg(750, 900).y, 6)

    const oneUp = feedBytes(m, [abs(ABS_MT_SLOT, 0), abs(ABS_MT_TRACKING_ID, -1), syn])
    expect(oneUp[0]!.touches.map((t) => t.id)).toEqual([11])

    const allUp = feedBytes(m, [abs(ABS_MT_SLOT, 1), abs(ABS_MT_TRACKING_ID, -1), syn])
    expect(allUp[0]!.touches).toEqual([])
    expect(allUp[0]!.kind).toBe("touch")
  })

  test("a finger already down when the stream started is picked up on first move", () => {
    const m = new TouchStateMachine(ident)
    const f = feedBytes(m, [abs(ABS_MT_POSITION_X, 5), abs(ABS_MT_POSITION_Y, 6), syn])
    expect(f[0]!.touches.length).toBe(1)
  })

  test("events between SYN_DROPPED and the next SYN_REPORT are ignored", () => {
    const m = new TouchStateMachine(ident)
    feedBytes(m, [abs(ABS_MT_TRACKING_ID, 1), abs(ABS_MT_POSITION_X, 10), syn])
    const f = feedBytes(m, [{ type: EV_SYN, code: SYN_DROPPED, value: 0 }, abs(ABS_MT_POSITION_X, 999), syn])
    expect(f[0]!.touches[0]!.x).toBeCloseTo(pg(10, 0).x, 6)
    expect(f[0]!.touches[0]!.y).toBeCloseTo(pg(10, 0).y, 6)
  })

  test("the default rM2 map puts raw (0, 0) at the SCREEN's bottom-left, turned into the page", () => {
    const m = new TouchStateMachine(RM2_TOUCH_MAP)
    const f = feedBytes(m, [abs(ABS_MT_TRACKING_ID, 1), abs(ABS_MT_POSITION_X, 0), abs(ABS_MT_POSITION_Y, 0), syn])
    expect(f[0]!.touches[0]).toMatchObject(screenToPage(0, 1872, ORIENT))
  })
})

describe("landscape: the quarter turn at the device's edge", () => {
  test("page <-> screen round-trips both ways, and the page is landscape", () => {
    expect(PAGE_W).toBeGreaterThan(PAGE_H)
    for (const o of ["cw", "ccw"] as const) {
      const corners = [[0, 0], [PAGE_W, 0], [0, PAGE_H], [PAGE_W, PAGE_H]].map(([x, y]) => opsToScreen([{ op: "put", id: "c", z: 0, prims: [{ k: "line", pts: [x!, y!], w: 1 }] }], o)[0]!)
      const xs = corners.map((c) => (c.op === "put" ? c.prims[0]!.pts[0]! : NaN))
      const ys = corners.map((c) => (c.op === "put" ? c.prims[0]!.pts[1]! : NaN))
      // every page corner lands on a screen corner of the portrait panel
      for (const x of xs) expect([0, 1404]).toContain(Math.round(x))
      for (const y of ys) expect([0, 1872]).toContain(Math.round(y))
    }
  })

  test("a pen sample at the screen's centre is the page's centre, either way", () => {
    for (const o of ["cw", "ccw"] as const) {
      const c = toPage(RM2_MAP.maxX / 2, RM2_MAP.maxY / 2, RM2_MAP, o)
      expect(c.x).toBeCloseTo(PAGE_W / 2, 6)
      expect(c.y).toBeCloseTo(PAGE_H / 2, 6)
    }
  })
})

describe("TouchThrottle", () => {
  const fr = (ids: number[], x = 0): TouchFrame => ({ kind: "touch", touches: ids.map((id) => ({ id, x, y: 0 })), t: 0 })

  test("moves are held to ~60 Hz; landings, lifts and the empty frame are never held", () => {
    const th = new TouchThrottle(16)
    expect(th.offer(fr([1]), 0)).toBeDefined() // landing
    expect(th.offer(fr([1], 5), 5)).toBeUndefined() // move, too soon
    expect(th.pending?.touches[0]!.x).toBe(5)
    expect(th.offer(fr([1, 2]), 6)).toBeDefined() // a second finger lands
    expect(th.pending).toBeUndefined()
    expect(th.offer(fr([1, 2], 9), 7)).toBeUndefined()
    expect(th.offer(fr([]), 8)).toBeDefined() // all lifted — always
  })

  test("a held frame is flushed, and counts as a send", () => {
    const th = new TouchThrottle(16)
    th.offer(fr([1]), 0)
    th.offer(fr([1], 7), 4)
    expect(th.flush(16)?.touches[0]!.x).toBe(7)
    expect(th.flush(17)).toBeUndefined()
    expect(th.offer(fr([1], 8), 20)).toBeUndefined() // 4 ms after the flush
    expect(th.offer(fr([1], 9), 32)).toBeDefined()
  })
})

describe("discovery", () => {
  test("cheap guesses in order: cached, USB, names — no duplicates", () => {
    expect(nameCandidates("192.168.1.42").map((c) => c.host)).toEqual([
      "192.168.1.42",
      USB_HOST,
      "remarkable.local",
      "remarkable",
    ])
    expect(nameCandidates(undefined).map((c) => c.source)).toEqual(["usb", "name", "name"])
    expect(nameCandidates(USB_HOST, USB_HOST).length).toBe(3)
    expect(nameCandidates("10.0.0.5", "10.0.0.9").map((c) => c.host).slice(0, 2)).toEqual(["10.0.0.5", "10.0.0.9"])
  })

  test("the sweep covers each real interface's /24, minus ourselves, tunnels and link-local", () => {
    const hosts = subnetHosts([
      { name: "en0", address: "192.168.1.20", netmask: "255.255.255.0", family: "IPv4", internal: false },
      { name: "lo0", address: "127.0.0.1", netmask: "255.0.0.0", family: "IPv4", internal: true },
      { name: "utun3", address: "10.8.0.2", netmask: "255.255.255.0", family: "IPv4", internal: false },
      { name: "en5", address: "169.254.3.3", netmask: "255.255.0.0", family: "IPv4", internal: false },
      { name: "en0", address: "fe80::1", netmask: "ffff:ffff:ffff:ffff::", family: "IPv6", internal: false },
    ])
    expect(hosts.length).toBe(253)
    expect(hosts).toContain("192.168.1.1")
    expect(hosts).toContain("192.168.1.254")
    expect(hosts).not.toContain("192.168.1.20")
    expect(hosts.some((h) => h.startsWith("10.8."))).toBe(false)
  })

  test("rank: guesses before the sweep; the sweep needs dropbear and must not be the router", () => {
    const ranked = rankProbes(
      [
        { host: "192.168.1.1", source: "scan", address: "192.168.1.1", banner: "SSH-2.0-dropbear_2022.83" },
        { host: "192.168.1.30", source: "scan", address: "192.168.1.30", banner: "SSH-2.0-OpenSSH_9.6" },
        { host: "192.168.1.42", source: "scan", address: "192.168.1.42", banner: "SSH-2.0-dropbear_2020.81" },
        { host: "remarkable.local", source: "name", address: "192.168.1.42", banner: "SSH-2.0-dropbear_2020.81" },
        { host: USB_HOST, source: "usb" },
        { host: "192.168.1.7", source: "cached", address: "192.168.1.7", banner: "SSH-2.0-OpenSSH_9.6" },
      ],
      "192.168.1.1",
    )
    // cached speaks SSH → tried first even though it isn't dropbear; .42 once.
    expect(ranked).toEqual(["192.168.1.7", "192.168.1.42"])
  })

  test("login outcomes are classified from ssh's exit and stderr", () => {
    expect(classifyLogin(0, "reMarkable 2.0\n\n---\narmv7l\n---\n", "")).toBe("ok")
    expect(classifyLogin(0, "Raspberry Pi 4\n---\n", "")).toBe("not-remarkable")
    expect(classifyLogin(255, "", "root@192.168.1.42: Permission denied (publickey,password).")).toBe("auth")
    expect(classifyLogin(255, "", "ssh: connect to host 10.11.99.1 port 22: Operation timed out")).toBe("unreachable")
  })

  test("decide: a login wins over a refusal wins over nothing", () => {
    expect(decide([{ host: "a", result: "auth" }, { host: "b", result: "ok" }])).toEqual({ kind: "found", host: "b" })
    expect(decide([{ host: "a", result: "unreachable" }, { host: "b", result: "auth" }])).toEqual({
      kind: "needs-key",
      host: "b",
    })
    expect(decide([{ host: "a", result: "not-remarkable" }])).toEqual({ kind: "none" })
    expect(decide([])).toEqual({ kind: "none" })
  })
})

describe("device detection", () => {
  // /proc/bus/input/devices as an rM2 prints it (abridged).
  const RM2 = `I: Bus=0000 Vendor=0000 Product=0000 Version=0000
N: Name="30370000.snvs:snvs-powerkey"
H: Handlers=kbd event0
B: EV=3

I: Bus=0018 Vendor=056a Product=0000 Version=0036
N: Name="Wacom I2C Digitizer"
H: Handlers=event1
B: EV=b

I: Bus=0018 Vendor=0000 Product=0000 Version=0000
N: Name="pt_mt"
H: Handlers=event2
B: EV=b
`

  test("pen and touchscreen are found by name", () => {
    expect(findDevices(RM2)).toEqual({ pen: "/dev/input/event1", touch: "/dev/input/event2" })
  })

  test("an unknown layout falls back to event1 for the pen and no touch", () => {
    expect(findDevices("N: Name=\"something\"\nH: Handlers=event5\n")).toEqual({ pen: "/dev/input/event1", touch: undefined })
  })

  test("one SSH round-trip parses into model, word size and nodes", () => {
    const info = parseDeviceInfo(`reMarkable 2.0\n\n---\narmv7l\n---\n${RM2}`)
    expect(info).toEqual({
      machine: "reMarkable 2.0",
      arch: "armv7l",
      recordSize: 16,
      pen: "/dev/input/event1",
      touch: "/dev/input/event2",
    })
    expect(parseDeviceInfo(`reMarkable Ferrari\n\n---\naarch64\n---\n`).recordSize).toBe(24)
  })
})

describe("auth", () => {
  test("ssh uses the bridge's own key and never David's ssh config or known_hosts", () => {
    const args = sshArgs("192.168.1.42", "cat /dev/input/event1", "/k/remarkable_ed25519")
    const opt = (o: string) => args.includes(o)
    expect(args.slice(args.indexOf("-i"), args.indexOf("-i") + 2)).toEqual(["-i", "/k/remarkable_ed25519"])
    expect(args.slice(args.indexOf("-F"), args.indexOf("-F") + 2)).toEqual(["-F", "/dev/null"])
    for (const o of ["IdentitiesOnly=yes", "BatchMode=yes", "UserKnownHostsFile=/dev/null", "ServerAliveInterval=3", "ServerAliveCountMax=3"])
      expect(opt(o)).toBe(true)
    expect(args.slice(-2)).toEqual(["root@192.168.1.42", "cat /dev/input/event1"])
  })

  test("needs-key carries the exact one-time command and where the password is", () => {
    const m = needsKeyMessage("192.168.1.42")
    expect(m).toContain("ssh-copy-id -i ~/.config/dreamtalk/remarkable_ed25519.pub root@192.168.1.42")
    expect(m).toContain("Settings → Help → Copyrights and licenses")
  })
})

describe("status and retry", () => {
  test("back-off doubles from 1 s and caps at 30 s", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 20].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000])
  })

  test("waiting on the key retries briskly, whatever the attempt count", () => {
    expect(retryDelay("needs-key", 9)).toBe(NEEDS_KEY_RETRY_MS)
    expect(retryDelay("asleep", 9)).toBe(30000)
    expect(retryDelay("searching", 0)).toBe(1000)
  })

  test("searching until first seen; losing a seen tablet is asleep", () => {
    expect(nextState(undefined, "none")).toBe("searching")
    expect(nextState("searching", "none")).toBe("searching")
    expect(nextState("searching", "needs-key")).toBe("needs-key")
    expect(nextState("needs-key", "found")).toBe("connected")
    expect(nextState("connected", "stream-ended")).toBe("asleep")
    expect(nextState("asleep", "none")).toBe("asleep")
    expect(nextState("needs-key", "none")).toBe("asleep")
    expect(nextState("asleep", "found")).toBe("connected")
  })

  test("a status is said once per change, not once per retry", () => {
    const t = new StatusTracker()
    const s = { kind: "status" as const, state: "searching" as const, message: "m" }
    expect(t.set(s)).toBe(true)
    expect(t.set({ ...s })).toBe(false)
    expect(t.set({ ...s, state: "asleep" })).toBe(true)
    expect(t.set({ ...s, state: "asleep", host: "h" })).toBe(true)
  })
})

describe("first run: SSH over Wi-Fi is off until enabled over USB", () => {
  test("the tablet's Wi-Fi address comes back in the same round-trip (iproute2 or busybox ifconfig)", () => {
    const base = `reMarkable 2.0\n\n---\narmv7l\n---\nN: Name="pt_mt"\nH: Handlers=event2\n\n---\n`
    expect(parseDeviceInfo(base + "3: wlan0: <UP>\n    inet 192.168.0.23/24 brd 192.168.0.255 scope global wlan0\n").wlan).toBe("192.168.0.23")
    expect(parseDeviceInfo(base + "wlan0  Link encap:Ethernet\n  inet addr:10.0.0.7  Bcast:10.0.0.255\n").wlan).toBe("10.0.0.7")
    expect(parseDeviceInfo(base).wlan).toBeUndefined()
  })

  test("over USB: cordless when Wi-Fi SSH answers, else the exact command", () => {
    expect(usbAdvice("192.168.0.23", true)).toEqual({ cache: "192.168.0.23", message: expect.stringContaining("unplug any time") })
    const off = usbAdvice("192.168.0.23", false)
    expect(off.cache).toBe(USB_HOST)
    expect(off.message).toContain("ssh root@10.11.99.1 rm-ssh-over-wlan on")
    expect(usbAdvice(undefined, false).message).toContain("isn't on Wi-Fi")
  })

  test("a key refused over USB lists the steps in order: wlan on, then the key, then unplug", () => {
    const m = needsKeyMessage(USB_HOST)
    const i1 = m.indexOf(WLAN_ON_CMD)
    const i2 = m.indexOf("ssh-copy-id -i ~/.config/dreamtalk/remarkable_ed25519.pub root@10.11.99.1")
    const i3 = m.indexOf("unplug")
    expect(i1).toBeGreaterThanOrEqual(0)
    expect(i2).toBeGreaterThan(i1)
    expect(i3).toBeGreaterThan(i2)
    // Over Wi-Fi, SSH is evidently on — just the key.
    expect(needsKeyMessage("192.168.0.23")).not.toContain("rm-ssh-over-wlan")
  })

  test("not found anywhere points first at the most likely cause", () => {
    expect(NOT_FOUND_MSG).toContain(WLAN_ON_CMD)
  })
})
