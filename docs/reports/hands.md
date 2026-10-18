# Hands — talking to symbols with your hands

*For David, the morning after the first live Leap session (2026-10-15).
What exists, how it should feel, what to try, what is still open.*

## Start here

| | |
|---|---|
| Player, tuning room | `localhost:4174/demo/?scene=hands-test&play=free&hands=leap` |
| Any scene | add `&play=free&hands=leap` (or `hands=webcam`) to a player URL |
| Editor | `localhost:4174/?scene=hands-test&hands=leap`. Press Space to pause, and keep the game lens on |
| Replay a recorded session | `&hands=replay&session=<id>` (its transcript is heard as the frames play) |
| Simulated hands | `&hands=sim&script=hover\|pinch\|drag\|grab-turn\|spread\|pinch-curled…` |

When a hand is in view, a legend in the top left says what each hand does.
The gesture you are making lights up in gold.

## One job per hand

**Right hand: point and pinch. Left hand: hold.** Each hand has one job, so
nothing can be mistaken for something else. A left pinch never clicks, and a
right fist never grabs on its own.

- **Point (right).** A small golden **spark** stands in the scene under
  your hand, near or far as your hand is.
  - It grows as it comes toward you.
  - A faint ring around it widens with its distance from the focus plane,
    like a lens's defocus.
  - Behind a symbol it stays visible but dims and shimmers through. In
    front it is full brightness.
  - It brightens as your fingers close.
- **Pinch (right).**
  - *Click*: fires the state of whatever the spark is in or nearest to.
  - *Pinch and drag*: slides that state continuously, and it settles when
    you let go.
  - *Pinch and hold still* (½ s): opens the actions menu (in the editor).
  - *Double pinch*: frames the thing.
- **Fist (left): hold the space.** The moment your left hand closes, the
  point where it closed becomes the pivot, and the whole space is in your
  hand.
  - It turns exactly as your hand turns, on all three axes, about that
    point.
  - It moves as your hand moves, so the point you grabbed stays under your
    hand.
  - It can tumble right over the top. There is no pole.
  - Opening the hand lets go where it is: no drift and no snap.
- **Both fists: the space between your hands.**
  - Move them apart and it grows about their midpoint (twice as far apart
    makes it twice as large).
  - Turn them around each other like a steering wheel and it turns.
  - Twist both wrists and it rolls about the line between your hands.

"swap hands" under the legend flips the roles for a left-handed player, and
is remembered. `?grab=either` restores the old free-for-all, where the
curl decides.

## Calibrating

- **C**: gold rings appear one by one. Pinch on each; each ring fills as
  your fingers close. At the end it says "calibrated ✓ thumb weight 0.xx".
  Esc cancels and C again redoes it. Until you have calibrated, a quiet
  line at the bottom reminds you.
- **pinch point** (bottom-right button): sliders, live.
  - *Thumb weight*: 0 puts the cursor at your index fingertip, 1 at your
    thumb tip. Your thumb moves less than your index, so ~0.75 keeps the
    point still while you pinch.
  - *Offset → / ↓*: nudges the point, in hand sizes.
  - "reset to calibrated" returns to the last C fit. "centre depth here"
    makes where your hand is now the spark's zero depth.
- **Depth zero** follows where your right hand *rests*, slowly (a 30 s
  running mean while pointing, never while pinched). So the spark sits at
  the focus when your hand is relaxed.

## Hand talk (I)

**I** opens the hand-talk panel.

- **Teach a gesture.** Name a gesture, choose *held* or *moving*, and record
  three takes (each one after a 3-2-1 countdown).
- **Record your rest.** Record your hand at rest once, so a resting hand is
  never taken for a gesture.
- **Bind it.** Bind each gesture to an action:
  - a scene state (`fire:<axis>`);
  - `home`;
  - `invoke:<Symbol>`, which summons any shelf symbol where your spark
    stands, depth and all;
  - `invoke:dismiss`, which takes away the summoned symbol the spark is at
    (else the latest).
- **Jev.** With `?jev=1`, uncertain gestures and what is being said go to
  the fast intent model, Jev. The session recorder's transcript feeds it,
  and a replay's transcript is heard as its frames pass. In the player
  with `?jev=1` the page listens for itself, and steps aside while ⇧R
  records.

## Live sessions — a walk becomes song

- **Record:** ⇧R in the paused editor or the player's free play. The walk records every fired transition (its pose at that instant), the effective camera, the focus and summons, the microphone with a live transcript, and the hand frames (hands.jsonl, on the same clock). A red ● clock shows while it runs; ⇧R stops.
- **Where it lives:** `refs/sessions/<YYYY-MM-DDTHH-MM-SS>/` holds session.json, voice.webm and hands.jsonl. refs/ is gitignored, so raw voice and hands stay on this machine. A song in a private `holons/<Name>` repo also keeps a copy as `inputs/<id>/` beside it.
- **Write the walk:** the editor's "write walk into the song" chip; the player links to it. One `appendSession` op inserts a passage after the clip the walk was held in. The daemon transcribes the voice (mlx_whisper large-v3-turbo, word timestamps, no silence hallucinations) and cuts each line into the narration cache. It then writes, beat by beat:
  - `this.say("…", { voice: "live", duration })`
  - `this.map.stateAxis(id).to(pos)` at its own length
  - a mid-flight reversal restarted from where the walk was (`this.set(…)`)
  - summoned symbols as real holons (`new Eye(…)`, `Create` / `UnCreate`)
  - the camera as linear keyframes, then home to the authored camera
  - clocks running throughout
- **Undo:** ⌘Z takes the passage out (the op's span inverse). The session folder stays.
- **Code:** editor/recorder.ts and editor/sessions.ts (UI), scripts/session.ts (format, passage, voice), plus `appendSession` in scripts/ops.ts.

## Settings at a glance

| Query | Effect |
|---|---|
| `hands=leap\|webcam\|replay\|sim` | the source |
| `grab=left\|right\|either` | which hand holds (default left) |
| `spark=0` | a flat gold dot on the screen instead of the 3D spark |
| `hold=0` | the older one-fist grab (orbit / pan / dolly) instead of 1:1 holding |
| `jev=1` | ask the intent model about uncertain gestures |

Remembered in the browser:
- `dreamtalk.pinch-calibration` (the live one) and `…​.fitted` (the last C fit)
- `dreamtalk.hands.grab`
- `dreamtalk.mudras` (gestures and their bindings)

## Measured on your hand (Leap, 2026-10-15)

All distances are in hand sizes (wrist to middle knuckle, ~88 mm).

| | |
|---|---|
| pinched (thumb–index) | 0.15–0.22 (~15–18 mm) |
| relaxed hand | 0.32–0.45 |
| open hand | 0.6–0.8 |
| jitter | < 0.006 per frame |
| fist: farthest fingertip from the palm | 0.38–0.50 |
| your natural pinch (the others curled) | 0.65–0.75 |
| open | 0.9–1.05 |

**What this set:**
- A pinch presses below **0.25** and releases above **0.30**. The release
  used to be 0.40, inside your relaxed range, so a pinch could stay held.
- A fist is read from the joints alone. The Leap's own grab number read
  1.0 for both your pinch and your fist, so it is not used.

## How it is built

| File | What |
|---|---|
| `hands/` (agent *hands*) | sources (Leap bridge, webcam worker, replay, sim), the recorder, the canonical `HandFrame` in mm, `screen.ts` (the screen projection plus the palm's pose, gap and reach measured in mm) |
| `src/gesture/pinch.ts` | the pinch cursor: thumb-weighted point, look-back lock at the press, hysteresis, One-Euro smoothing, depth, calibration fit |
| `src/gesture/grab.ts`, `controller.ts` | fists, hand roles, click vs drag |
| `src/gesture/hold.ts` | holding: one hand rigid (`holdPose`), two hands as a similarity (`twoHandMotion`), the pose filter |
| `src/view.ts` | the viewer camera as a layer over the authored one. `place(pose)` and `pose()` give any orientation, roll included, with no pole while held. Exports never see it. |
| `src/gesture/mudra.ts`, `jev.ts` | gestures (poses by nearest neighbour, motions by time warping, `_rest`), the intent model |
| `demo/handplay.ts` | wiring: one paint and one pick per display frame, the spark, holds, calibration, hand talk |
| `demo/spark.ts` | where the spark stands (the view's frustum, depth included) |
| `demo/game.ts` | `GameLoop.spark`: 3D picking among the walkable symbols, and what hides the spark |
| `demo/handui.ts` | legend, buttons, pinch-point panel, hand-talk panel |

**Cost per frame.** The hand path costs microseconds:
- the controller ~0.5 µs;
- a 3D pick ~2 µs;
- moving gestures are matched at most 30 times a second.

The page's slow screen pick (~70 ms in the gallery) is no longer called on
every hand frame. *hands* is making it fast for the mouse too.

## What to try

1. Calibrate (C), then point at the cube and pinch: it should fold. Pinch
   and drag across it: the fold should follow your hand and settle.
2. Move the spark behind the cube: it should dim and shimmer, and in
   front it should be bright.
3. Close your left hand in the middle of the room and turn it clockwise as
   seen from above: the room should turn clockwise with it, about where
   your hand is. Then tip it, roll it, and carry it. **If any axis feels
   mirrored, say which one** (turning flat, tipping, rolling).
4. Both fists: pull them apart, turn them like a wheel, twist your wrists.
5. Open the pinch point panel and slide the thumb weight while pinching on
   one spot: find the value where the point does not move as you close.

## Open questions

- **Exact ink for the spark** — done (2026-10-18): it picks and dims on
  the strokes themselves (hands' `pickNear` / `pickRay`), no longer on the
  symbols' boxes.
- **Holding is verified by math and headless tests, not yet by your
  hand.** The axis signs follow the Leap frame (= the camera frame for a
  desk-mounted Leap). Your first hold tells whether that is true.
- **Two fists.** Is scaling 1:1 too strong for a whole room? A gain, or a
  logarithmic feel, is one line.
- **The spark's depth range** is ±~8 cm of hand travel to span the room.
  Is that too much or too little?
- **Summoning.** A bound gesture brings a symbol in at your hand. In a
  recorded session it becomes a real holon in the song (editorsm). What
  should the dismiss gesture be by default?
- **Webcam.** Everything works from the webcam too, but its depth is
  estimated, so the spark's depth and the hold's tilt will be rough there.
