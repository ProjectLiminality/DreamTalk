# dreamtalk-pad

The DreamTalk whiteboard on the reMarkable 2's own screen: one universe, not
two. The whiteboard page on the Mac (`core/sketch/`) is the app; this AppLoad
app is its e-ink mirror and the hand that writes on it. The route is
`docs/reports/remarkable-display.md`.

**One principle.** The page's display list is the source of truth for every
pixel on the tablet. The only thing the pad draws on its own is the trail of
the stroke in progress (ink with the tip, a dashed lasso with the button
held), and only until the page has caught up. A lasso goes when the pen
lifts. Everything else (symbols, moves, rotations, recognition, undo, voice
edits) reaches the tablet through the same display-list diff.

```
sketch page ──ws /ws/display──▶ daemon ──ws──▶ bridge ──ssh -W──▶ dreamtalk-pad (tablet 127.0.0.1:7777)
     ▲                                                                 │ pen trail, at once
     └──────────── pen + fingers: the bridge reads evdev over ssh ◀────┘ (the tablet itself)
```

- **Display list** (`core/sketch/protocol.ts`, "The display list"): keyed
  items of 2D primitives in page units (= rM2 pixels). Ops are `put`, `del`,
  `clear` and `flush`; a batch ends with `flush`, so the screen changes once
  per batch. A reconnect or late join gets a full snapshot.
- **The page** (`core/sketch/mirror.ts`) flattens every placed symbol
  through the page's own camera. It walks the same holon tree as ThreeHost,
  uses the same transforms and the host's own `polyline`, so a symbol lands
  on the pixels the Mac draws. The page also sends ink with its pressure
  widths, the selection frame, handles and ✦ chip, the lasso and the options
  ring. It sends at most 10 batches a second, and only when something
  changed.
- **The pad** keeps the items by id. At each flush it repaints only the
  rectangle that changed: it clears that rectangle to white, then redraws
  every item touching it in z order, clipped to it. It draws the trail
  1-bit in UFAST (xochitl's "Pen" waveform). It reads the pen button from
  the digitizer's evdev node, because qtfb forwards the pen as plain mouse
  events without the button. When everything is quiet and the pen is out of
  range, it does one quality pass in CONTENT.
- **Leaving the app.** Swipe one finger down from the top centre of the
  screen to the middle. AppLoad's bar appears, with its close button.

## Verified on the Mac

- `./build.sh test` runs the drawing core and the op parser (clip, fills,
  dashes, greys, bounds). 296 checks.
- `./build.sh` builds the tablet binary, a static armv7 ELF.
- `./build.sh e2e` runs the **real ARM binary** in emulated armv7 Linux,
  against `test/fake-qtfb.c`. That file stands in for AppLoad's qtfb, the
  digitizer's evdev node (a FIFO) and the Mac's `ssh -W`. The run checks:
  - pen latency (each sample comes back as one small update);
  - an in-progress echo is skipped while the pen is down;
  - the trail hands over to the page's stroke without double ink;
  - the lasso is dashed and gone at lift;
  - an unadopted trail fades after 2 s;
  - a tap on a control leaves no ink;
  - removals repaint only what they uncover;
  - knockout fills work;
  - the quality pass;
  - a clean exit.

  149 checks.
- `cd core && bun scripts/mirror-e2e.ts` runs the whole chain. It serves
  the real whiteboard page with a fixture board, makes a selection, takes
  what `/ws/display` relays and runs the ARM pad on it. It then compares
  the pad's page with headless Chrome's screenshot of the same page
  (`.cache/mirror-e2e/{mac,pad,overlay}.png`). Last run: 96.2% of the pad's
  ink lies on the Mac's, and 99.8% of the Mac's ink lies on the pad's,
  within 3 px. The rest is the Mac's translucent selection halo, which
  e-ink leaves out.
- `cd core && bun test test/sketch-mirror.test.ts` checks flattening,
  items, diffs, the store, a real WebSocket relay and the bridge's argv.

## Not mirrored yet

Text glyphs. They are triangulated meshes behind HarfBuzz, not line
geometry.

## On the device

The one-time AppLoad setup is done (Vellum, xovi, appload and tripletap).
After a reboot, triple-press the power button to bring AppLoad back.

1. On the Mac, restart the studio so the daemon has `/ws/display` and the
   bridge carries the screen: `cd core && bun run studio`. The bridge logs
   `screen: dreamtalk-pad connected on <host>` once the app is open.
2. Install the app: `./install.sh` (the binary and manifest go to
   `/home/root/xovi/exthome/appload/dreamtalk-pad/`). Use
   `RM_HOST=<ip> ./install.sh` if the bridge's cached address is stale.
3. On the tablet, open **DreamTalk** from AppLoad. Open the whiteboard on the
   Mac (`/sketch/`) and the tablet shows it.

**Rollback:** `./install.sh --remove`. To set it off for one run, use
`RM_SCREEN=off` on the bridge.
