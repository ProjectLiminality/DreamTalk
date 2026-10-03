# Drawing DreamTalk on the reMarkable 2's own screen

*Research report, 2026-10-03. Question: what is the most robust, minimal way
for DreamTalk to draw selections, a "make it real" control and finished
symbols on the rM2's e-ink, while the pen still feels like paper?*

## Recommendation in one paragraph

Build a **small native AppLoad "external" app with a qtfb framebuffer**
(`dreamtalk-pad`). Write it in C or Zig and cross-compile it on the Mac into
one static armv7 binary, without the reMarkable SDK. It runs fullscreen
*inside* xochitl, so xochitl keeps the display, sleep and the OS, and pen
input goes to our app instead of a notebook. Nothing is inked twice, so we
don't need EVIOCGRAB. The app draws **its own pen trail locally** with
xochitl's pen waveform (`UFAST`). It draws **symbols and UI from a display
list of polylines in page units** sent by the Mac over the existing SSH
connection. Your expected design, "send polylines, tablet draws them with a
fast waveform", is confirmed with one change: fast waveforms are for the pen
trail and selections only, and settled symbols are drawn with a quality
waveform. Taking over the whole display (stop xochitl, rm2fb, or driving
`libqsgepaper` directly) stays as the fallback, used only if the qtfb pen
latency turns out too high when measured.

## 1. Firmware landscape (rM2, Oct 2026)

- The current release is **3.28** [R1]. The rM2 was discontinued on
  2026-05-06 but **still gets updates** [R2]. The 3.27.3 release was out by
  Aug 2026 [R3].
- Root SSH needs **no developer mode** on rM1/rM2. Developer mode exists
  only on the Paper Pro [R4]. The root password is in Settings → Help →
  About → Copyrights and licenses [R5].
- SSH is **USB-only by default** (10.11.99.1). On versions after 3.20/3.22,
  Wi-Fi SSH is turned off (silently, by the 3.22 update) until you run
  `rm-ssh-over-wlan on` over USB. That setting lives on `/home` and
  **survives updates** [R4][R5][R3].
- Updates replace the root filesystem and keep `/home`. Hacks that touch
  `/etc` or systemd need `vellum reenable` afterwards. Vellum can also check
  whether installed packages support a new OS **before** you update
  (`vellum check-os <ver>`) [R6].
- **Toltec is dead**: it was archived 2026-08-12, only works on OS ≤ 3.3,
  and **soft-bricks newer devices**. Its successors are **Vellum** and
  reManager [R7].

## 2. Ways to draw on the screen

The rM2 has no hardware e-ink controller. xochitl drives the panel through a
software TCON (timing controller) inside `libqsgepaper.so`, so there is no
usable `/dev/fb0` [R8].

| Approach | What it is | Status (dates) |
|---|---|---|
| **rm2fb** (timower) | A display manager. It hooks xochitl or replaces it, using `libqsgepaper` or a reverse-engineered SWTCON ("swtcon mode", which needs no hooks into xochitl). | Supports 3.20 / 3.22 / 3.23. 3.28 is **beta** (swtcon mode only). v0.1.4 released 2026-05-19, last commit 2026-08-19. Its own README sends readers to **Oxide or qtfb** for "a more supported display driver" [R8][R9]. |
| **XOVI + AppLoad + qtfb** (asivery) | XOVI is an LD_PRELOAD hook framework loaded into xochitl. AppLoad adds an app launcher with QML apps and "external" native apps. **qtfb** (now merged into AppLoad) gives a native app a shared-memory framebuffer that xochitl paints for it. | AppLoad v0.6.0 released 2026-09-19. The Vellum package is **pinned to OS 3.28.x**, and every OS minor version has needed a rebuild (for example "limit 0.4.1 to OS < 3.26") [R10][R11][R12]. Works on rM1/rM2 (armv7) and on the Paper Pro models [R10][R13]. |
| **Official Qt Quick SDK** | reMarkable's own path. A pure Qt Quick app with `QT_QUICK_BACKEND=epaper` after `systemctl stop xochitl`. Needs a Linux host. The docs say pen handling is "more involved and not shown here" [R14]. | Supported, but it is a takeover, and the pen path is not documented. |
| **Oxide** (Eeems) | A launcher and display server for the whole device. | Active (last push 2026-09-29). Vellum pins it to OS 3.27.x [R11][R15]. More than we need. |

**How XOVI starts.** XOVI is "tethered": after a reboot the stock OS starts
alone, and XOVI comes back only via `xovi/start` over SSH or **xovi-tripletap**
(triple-press the power button) [R13][R16]. So a reboot always gets you back
to stock: an off switch that is always there.

## 3. E-ink update control

Typical E Ink modes [R17]:

- **DU**: about 120 ms, black and white only.
- **A2**: about 120 ms, black and white only, more ghosting.
- **GL16**: about 450 ms, grey levels.
- **GC16**: a full-quality update that flashes.

qtfb exposes xochitl's *named* modes, not the raw ones: `UFAST`, `FAST`,
`ANIMATE`, `CONTENT`, `UI`. It also takes partial-rectangle updates and has a
"full refresh" request; a 5-finger tap triggers one [R12, `src/qtfb/common.h`].

**Fast pen ink.** You only redraw the few pixels under the nib, in a
black-and-white mode. xochitl's notebook pen uses `UFast`. Folio, an AppLoad
app on the Paper Pro Move, draws live ink the same way. It sets
`DisplayMethodArea.UFast` over its page and repaints only the 128-px tiles a
stroke touches, about 6 ms per frame [R18]. reMarkable advertises about 21 ms
pen-to-ink latency for its own app on the rM2 [R19].

**Rules for DreamTalk on the tablet:**

- The pen trail and the lasso are 1-bit black on white, drawn in `UFAST`.
- A settled symbol is drawn once. Clear its rectangle to white, rasterise
  the polylines (anti-aliased is fine), and push it in `CONTENT`. That is one
  local, short flash.
- Ghosting builds up, so offer a full refresh: the 5-finger tap or a button.

**A dark UI (white on black) is not practical here.** Fast black-and-white
modes leave more visible ghosts on large black areas, and every
quality refresh flashes the whole black field. *This is engineering
judgement from how the waveforms behave; it has not been measured on the rM2.*
So keep the tablet as paper (black ink on white) and keep the dark scene on
the Mac. Nothing in the protocol changes, because both screens share the
same page coordinates.

## 4. Share the screen with xochitl, or own it?

- **Inside xochitl (AppLoad).** Pen and touch reach the app through qtfb's
  socket (pen arrives with pressure, `INPUT_PEN_*` messages). xochitl does
  **not** ink them into a notebook, so there is **no need for EVIOCGRAB**.
  You close the app by swiping from the top centre [R10][R12].
  - The digitizer's hover and side-button events are not obviously
    forwarded. The app can keep reading `/dev/input/eventN` without exclusive
    access for those, exactly as `remarkable-bridge.ts` does now. The
    `rm-stylus` XOVI extension also exposes the button to QML [R11].
- **Owning the screen** (stop xochitl, then rm2fb, the SDK, or a
  quill-style direct `libqsgepaper` host):
  - This gives the lowest latency, and it is how Harmony, KOReader and yaft
    worked under rm2fb.
  - But you must own sleep yourself. Quill documents a hold-a-wakelock
    workaround after a suspend resumed into "a second xochitl fighting the
    app for the panel" [R20].
  - You must always restart xochitl afterwards.
  - On rM2 you depend on rm2fb's support matrix (3.28 is still beta) [R8].

## 5. Candidate architectures

| | Pen latency | Robustness | Install effort | Survives updates |
|---|---|---|---|---|
| **(a) Native takeover client** (rm2fb or direct libqsgepaper) | Best | Must own sleep and restart xochitl. rm2fb on 3.28 is beta. | rm2fb plus our binary | Waits for rm2fb support each OS |
| **(b1) AppLoad QML app** (Canvas plus `DisplayMethodArea.UFast`, as in Folio) | Proven acceptable on the Paper Pro. **Unmeasured on rM2**, whose slower A7 CPU runs the JS canvas. | Good, because xochitl keeps the device | xovi + appload via Vellum, plus a QML app | Pinned to one OS minor version |
| **(b2) AppLoad external app + qtfb** (recommended) | Same display path as (b1). The pen trail is drawn in native code, not JS. **Unmeasured on rM2.** | Good, for the same reason. qtfb is the path the rm2fb author recommends. | Same as (b1). The app is 2 files: a manifest and a binary. | Pinned to one OS minor version, and our binary doesn't change |
| (c) Push results back as a notebook page or PDF (web interface) | Native, about 21 ms | Best | None | Yes |

Option (c) is not live, so selection and "make it real" can't be shown on
the tablet. It stays as a safety net that needs no install.

**Why (b2) over (b1).** The drawing logic stays in one native file that can
be tested on the Mac: qtfb has a PC emulator [R12]. We write no QML. And the
same "framebuffer + swap(rect, mode) + input" core can later be moved onto
rm2fb or libqsgepaper if we need option (a).

## 6. The plan

**Done once by hand (David):**

1. Read the OS version in Settings → About. AppLoad on Vellum currently needs
   **3.28.x** [R11]. Then **turn off automatic updates**. *The exact menu path
   has not been checked for 3.28.*
2. Plug in USB, then run `ssh root@10.11.99.1 rm-ssh-over-wlan on` [R5].
   After that the bridge works over Wi-Fi, as it does today.
3. On the tablet, install Vellum: download `bootstrap.sh`, verify its SHA-256
   as the README shows, run it [R6]. Then run
   `vellum add xovi appload tripletap`. The dependencies,
   qt-resource-rebuilder and xovi-extensions, come with it [R11].
4. Triple-press the power button. An AppLoad entry appears in xochitl's
   sidebar.

**Built by us (no changes on the tablet beyond one app folder):**

5. **Latency check first.** Write `dreamtalk-pad`, a C file of a few hundred
   lines:
   - Connect to `/tmp/qtfb.sock` with `QTFB_KEY`.
   - Ask for `FBFMT_RM2FB`, which is RGB565 at 1404×1872 (exactly our
     `PAGE_W × PAGE_H`), and `mmap` the shared memory.
   - Set refresh mode `UFAST`.
   - On each pen sample, draw the segment and send `UPDATE_PARTIAL` for its
     bounding rectangle.

   Build it with
   `zig cc -target arm-linux-musleabihf -static -O2`. Fallback: the
   `eeems/remarkable-toolchain:latest-rm2` Docker image [R21].
   Copy it to `/home/root/xovi/exthome/appload/dreamtalk-pad/` together with
   `external.manifest.json` (`{"name":"DreamTalk","application":"dreamtalk-pad","qtfb":true}`)
   [R10].
   **Measure** it against a xochitl notebook with 240 fps phone video.
   **Gate:** if it is clearly worse than paper, switch to option (a).
6. **Transport: reuse SSH.** The Mac bridge already holds an SSH session. Add
   a reverse tunnel (`ssh -R 7777:127.0.0.1:<daemon port>`), so the app
   connects to `127.0.0.1:7777`. That way the tablet needs no Mac address,
   SSH keys handle authentication, and the link is encrypted.
   The wire format is newline-delimited JSON:
   - **tablet → Mac:** the existing `PenEvent` union, unchanged. Its
     coordinates are already rM2 pixels.
   - **Mac → tablet:** a display list such as
     `{kind:"scene", items:[{id, polylines:[[x,y,…]], width, state:"ink"|"selected"|"symbol"}], ui:[…]}`.
   - The tablet redraws only the items that changed (by id), choosing
     `UFAST` or `CONTENT` per item.
7. **UI on the tablet:**
   - A dashed lasso while the pen button is held.
   - A "make it real" box drawn next to the selection; a pen tap in that box
     is an ordinary event the Mac interprets.
   - The symbol replaces the scribble when the Mac sends it.
   - The page owns all logic; the tablet stays a thin renderer.

**Rollback**, from gentlest to strongest:

1. Close the app (swipe down from the top centre).
2. Reboot: XOVI is tethered, so the device boots stock [R13].
3. `vellum del appload tripletap xovi`, or `vellum self uninstall --all` [R6].
4. Last resort: boot the other root partition with `rm-version-switcher` or
   `codexctl` [R11][R22].

## Risks

1. **The OS pin (main risk).** AppLoad has needed a new build for every OS
   minor version, and it is pinned to 3.28 today. An automatic update can
   silently turn the pad off until upstream catches up [R11]. Mitigation:
   updates off, and run `vellum check-os` before any update.
2. **Pen latency on rM2 is unmeasured** for the qtfb path. Every public
   latency evidence for in-xochitl drawing is from the Paper Pro [R18]. Step
   5 is a gate for exactly this reason.
3. **Dependence on one maintainer.** XOVI, AppLoad and qtfb are largely one
   developer's work, and the upstream says *"AI-written code in general is
   not welcome"* in pull requests [R10]. We use their code; we file issues,
   not AI-written patches.
4. **rM2 is less tested than the Paper Pro** in the AppLoad ecosystem. Most
   showcase apps target the Paper Pro. *This is an inference from the repos,
   not a stated fact.*
5. **The tethered start**: after every reboot David triple-presses the power
   button. That is a small daily ritual, and it is also the safety valve.

## Sources (accessed 2026-10-03)

- R1 reMarkable, Software Release 3.28 — https://support.remarkable.com/s/article/Software-Release-3-28
- R2 Good e-Reader, "The reMarkable 2 is now discontinued" (May 2026) — https://goodereader.com/blog/remarkable-news/the-remarkable-2-is-now-discontinued
- R3 oskrim, "Reviving a four year old reMarkable 2" (2026-08-09) — https://oskrim.github.io/hardware/2026/08/09/remarkable-over-ssh.html
- R4 reMarkable Developer, Developer mode — https://developer.remarkable.com/documentation/developer-mode
- R5 reMarkable Guide, SSH Access (updated 2026-06-10) — https://remarkable.guide/guide/access/ssh.html
- R6 vellum-cli README (pushed 2026-09-24) — https://github.com/vellum-dev/vellum-cli
- R7 toltec-dev/toltec (archived 2026-08-12) — https://github.com/toltec-dev/toltec
- R8 timower/rM2-stuff README and `doc/swtcon_architecture.md` (last commit 2026-08-19) — https://github.com/timower/rM2-stuff
- R9 rM2-stuff releases (v0.1.4, 2026-05-19) — https://github.com/timower/rM2-stuff/releases
- R10 asivery/rm-appload README (v0.6.0, 2026-09-19) — https://github.com/asivery/rm-appload
- R11 Vellum package recipes: `appload`, `xovi-extensions`, `oxide`, `rm-stylus`, `rm-version-switcher` — https://github.com/vellum-dev/vellum/tree/main/packages
- R12 rm-appload source: `src/qtfb/common.h`, `src/qtfb/fbmanagement.cpp`, `shim/README.MD`, `resources/ApploadUtils/DisplayMethodArea.qml` — https://github.com/asivery/rm-appload ; qtfb merged notice — https://github.com/asivery/qtfb
- R13 asivery/rm-xovi-extensions README (tethered start, `rebuild_hashtable` after updates) — https://github.com/asivery/rm-xovi-extensions
- R14 reMarkable Developer, Writing Qt Quick Applications — https://developer.remarkable.com/documentation/qt_epaper
- R15 Eeems-Org/oxide — https://github.com/Eeems-Org/oxide
- R16 rmitchellscott/xovi-tripletap (rM2 supported, pushed 2026-09-22) — https://github.com/rmitchellscott/xovi-tripletap
- R17 Waveshare/E Ink, E-paper mode declaration (DU/A2/GL16/GC16) — https://www.waveshare.com/w/upload/c/c4/E-paper-mode-declaration.pdf
- R18 zimbatm/folio-public, README "Notes on xochitl" and `ui/main.qml` — https://github.com/zimbatm/folio-public
- R19 Laptop Mag, reMarkable 2 review (21 ms latency, the vendor's figure) — https://www.laptopmag.com/reviews/remarkable2
- R20 MaximeRivest/quill README (takeover host, wakelock incident; Paper Pro, 2026-07) — https://github.com/MaximeRivest/quill
- R21 eeems/remarkable-toolchain Docker tags (`latest-rm2`, 5.8.203) — https://hub.docker.com/r/eeems/remarkable-toolchain
- R22 Jayy001/codexctl (pushed 2026-08-20) — https://github.com/Jayy001/codexctl
