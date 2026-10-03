# dreamtalk-pad

DreamTalk drawing on the reMarkable 2's own screen — the first step of the path
recommended in `docs/reports/remarkable-display.md`.

Right now it is the **latency gate**: a pen-trail-only app (plus a display list
the Mac can send) whose job is to answer one question before anything else is
built on it — *does ink through this route still feel like paper?*

Nothing here has been installed on a tablet. It is built and tested on the Mac.

## What is verified on the Mac

- `./build.sh test` — the drawing core (`ink.c`): pressure-scaled segments,
  dirty rectangles, and the display-list parser. Writes `build/ink_test.ppm`.
- `./build.sh` — the tablet binary: a static 32-bit ARM ELF (`build/arm/dreamtalk-pad`).
- `./build.sh e2e` — the **real ARM binary** run under emulated armv7 Linux
  (Docker) against `test/fake-qtfb.c`, a stand-in for AppLoad's framebuffer
  server. Writes `build/e2e.pgm`: pen trail and a display-list triangle,
  both drawn through the actual qtfb wire protocol.

The protocol in `qtfb.h` is restated from upstream AppLoad (commit and files
cited in its header) — not guessed.

## What only the tablet can confirm

- that the qtfb server accepts the handshake as restated,
- the real pen latency through the `UFAST` refresh mode on an rM2
  (all public evidence so far is from the Paper Pro),
- that pressure comes through as AppLoad documents it.

## Trying it (only once you've decided to)

Prerequisites — once, by hand, from the report §6: OS 3.28.x, automatic updates
off, Vellum installed, `vellum add xovi appload tripletap`, then triple-press
the power button so AppLoad appears in the sidebar.

```sh
./install.sh            # copies two files into /home/root/xovi/exthome/appload/dreamtalk-pad/
```

Open **DreamTalk** from AppLoad's list and write.

**The latency test.** Film the nib at 240 fps (most phones' slow-motion mode):
a few strokes in dreamtalk-pad, then the same in an ordinary notebook. Count the
frames between the nib touching and ink appearing under it. If the pad is
clearly slower than the notebook, stop here — the report's fallback (taking
over the display directly) is the next thing to try.

**Rollback** — removes everything this put on the tablet:

```sh
./install.sh --remove
```
