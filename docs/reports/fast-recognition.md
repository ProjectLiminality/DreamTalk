# Fast recognition: from a doodle to a fitted symbol, near-instantly

*Research + prototype report, 2026-10-04. Question: how do we get the
whiteboard's "magic replacement" (a scribble becomes the imported DreamTalk
symbol it means, with fitted params) from today's 5–16 s to near-instant?*

## Recommendation in one paragraph

Split the job into its two halves. **Geometry is solved locally, with no
model**: `core/sketch/fit.ts` tunes any imported symbol's params until its
flattened outline lies on the ink (symmetric chamfer, Nelder–Mead + compass
search, 200 evaluations in **10–60 ms**). For flat symbols it also *chooses*
the symbol by racing the whole imported vocabulary (**30–330 ms, 30/30
right** on seeded scribbles of circles, triangles, squares, flowers and
cylinders, plus the real hand-drawn cylinder on the scratch board), and it
says plainly when its answer is not clear enough. **Meaning is left to a
model, and only when geometry can't tell**: the MindVirus (it needs its
cable traced), cube vs cylinder, words, anything outside the vocabulary. The
model then only has to *name* the symbol, because the fitter makes the
numbers. A **decision model** fits that job exactly. Cloudflare's
**Clef-flash** (Workers AI, released 2026-10-01) is Jev-compatible, reads
images, and is reported at a ~40 ms median. Jev itself is text-only. See
§2–4.

    pen up ─▶ instantReading (≤ 0.3 s, local) ── clear? ──▶ replace
                     │ not clear
                     ▼
              vision model: symbol + rough params ─▶ fitSymbol (≤ 60 ms) ─▶ replace / ring

## 1. The fitter (built: `core/sketch/fit.ts`, tests in `core/test/sketch-fit.test.ts`)

- **Geometry**: `symbolOutline` reuses mirror.ts's `flattenSymbol` (pure, no
  GPU): every drawn line, plus the rim of every dark fill. The cylinder is
  the exception: its wireframe is computed per frame by the host, so
  `flattenSymbol` returns **nothing** for it (a gap in the mirror too: the
  tablet can't show a placed cylinder). `fit.ts` uses an analytic outline
  instead (two cap ellipses + two sides).
- **Score**: symmetric chamfer between ink and symbol at one arc-length
  step. Ink→symbol is measured to the symbol's *segments*, so the objective
  doesn't jitter as samples slide; each distance is truncated at 0.35 of the
  ink's bbox diagonal and divided by that diagonal. ~0.01 = a careful
  hand-drawn circle; above ~0.03 is a different shape.
- **The pose shortcut** (the main speed-up): a symbol is flattened once per
  *shape*, and every position, size and angle is a 2D similarity of that
  template, which takes microseconds instead of milliseconds (a
  Regenaissance flattens in ~6 ms). This is checked against two real
  flattenings, not assumed. Flat symbols pass exactly. Cube and MindVirus
  (perspective) pass approximately per local anchor and get a short final
  polish on the real flattening. An absolute cable path fails and takes the
  exact path.
- **Optimiser**: coarse-to-fine. First a grid over shape params (a cube's
  yaw/pitch, a MindVirus fold), then Nelder–Mead over the pose, then compass
  search. Params the drawing doesn't show are dropped automatically. Point
  paths, strings and enums are never touched.
- **Race** (`raceVocabulary`): each raceable symbol (and each enum option)
  starts with its bbox scaled and centred on the ink's. It scans 12 angles
  (and, for symbols with several lengths, each length on its own), prunes
  any hypothesis whose best start is more than 1.6× worse than the leader,
  and tunes the two best distinct starts. Ranking adds a small cost per param
  (Occam) and penalises **degenerate** readings: a cylinder seen edge-on is
  the rectangle, and one with no height is an ellipse.
  `instantReading` answers only when the best score is ≤ 0.03, the reading
  isn't degenerate, and the runner-up symbol scores ≥ 1.5× worse. Otherwise
  it returns `undefined`, which means "ask the model".

### Measured (M-series Mac, bun, seeded scribbles from `test/scribbles.ts`)

**Refine from a model-like guess** (±15 % position, ±15 % size, ±0.25 rad), 200 evals, mean of 5:

| symbol | score before → after | ms | evals/s |
|---|---|---|---|
| circle | 0.033 → 0.010 | 20 | 9 400 |
| triangle | 0.054 → 0.005 | 17 | 11 600 |
| square | 0.048 → 0.007 | 16 | 12 500 |
| flower of life | 0.023 → 0.009 | 24 | 8 400 |
| cube (perspective, approx shortcut) | 0.042 → 0.025 | 61 | 3 400 |
| cylinder (analytic) | 0.031 → 0.004 | 17 | 12 200 |
| MindVirus with cable (exact path) | 0.023 → 0.014 | 627 | 330 |

**Race without a model** (12 hypotheses, 120 evals each):

| scribble | race picks right | `instantReading` answers / right | ms |
|---|---|---|---|
| wobbly circle | 5/5 | 5/5 / 5 | 30–60 |
| searched circle (4 overlapping loops) | 5/5 | 5/5 / 5 | 30 |
| triangle | 5/5 | 5/5 / 5 | 50–100 |
| square | 5/5 | 5/5 / 5 | 120–160 |
| flower of life (7 circles) | 5/5 | 5/5 / 5 | 170–220 |
| cylinder | 5/5 | 5/5 / 5 | 250–330 |
| cube (schoolbook oblique) | 5/5 | 0/5 (defers: cylinder is close) | 260 |
| MindVirus | not raced (cable) | 0/5 (defers) | 120 |
| real cylinder, 59 searching strokes | ✓ | answers, score 0.017 | 290 |

**No false answers on non-vocabulary input**: a cross, a spiral, a heart, a
zigzag, a line, an ellipse and two separate circles all defer. One soft
spot: a long thin *rectangle* is answered as a cylinder lying on its side,
seen nearly edge-on. That is plausible, but a rectangle in the vocabulary
would fix it.

**Real model → fit** (`claude -p --model claude-opus-5-5`, the current
recognizer):

| scribble | model time | model's numbers score | after fit (ms) |
|---|---|---|---|
| real cylinder | 16.0 s (first call) | 0.029 | 0.014 (16 ms) |
| wobbly circle | 12.3 s | 0.0097 | 0.0095 (19 ms) |
| MindVirus | 7.9 s | 0.016 | 0.014 (582 ms) |
| cube | 7.5 s | 0.027 | 0.024 (66 ms) |
| cross (not in vocabulary) | 8.6 s | — (correctly: nothing) | — |

Opus's numbers are already good when it reads the stroke coordinates and
the circle-fit hint, so the fit mostly matters for 3D symbols and when the
model is a *small fast* one. Its time is the whole cost: 8–16 s for a
reading the race makes in 0.05–0.3 s.

## 2–4. Research: fast vision models

*Checked on the web 2026-10-04. The ecosystem moves fast: re-check the
links before you build on them.*

### 2. "Jev": real, fast, and **text-only**

- **Jev** is TypeSafe AI's "System One" *decision* model. It takes a state
  (text or JSON) and a schema of typed questions — **Choice** over the
  candidates you supply, **Noul** (a yes/no probability), **Score** (an
  ordinal rubric) — and returns calibrated probabilities in **one forward
  pass, with no decoding**. TypeSafe quotes **70–500 ms end to end**
  ([TypeSafe blog](https://typesafe.ai/blog/introducing-system-one-models-and-jev),
  [InfoQ, Oct 2026](https://www.infoq.com/news/2026/10/typesafe-ai-jev-released/)).
- **No image input.** "Jev reads text only … no images, audio or video yet"
  ([flaviocopes](https://flaviocopes.com/jev/),
  [firecrawl](https://www.firecrawl.dev/blog/what-is-jev)).
- The open recreations David remembered all exist:
  [Open-Jev 2B/9B/27B](https://zefan-cai.github.io/open-jev/) (LoRA +
  decision head on Qwen; <100 ms median for the 2B on an H100; its docs
  mention no vision),
  [AutoTrust JEV-9B](https://huggingface.co/autotrust/JEV-9B),
  [kyegomez/open-jev](https://github.com/kyegomez/open-jev), and
  [APUS-OpenJev](https://huggingface.co/apus-ailab/APUS-OpenJev-v1).
- **The one that sees: Cloudflare Clef / Clef-flash** (released
  2026-10-01). These are open-weight decision models with a Jev-compatible
  API that **accept images** (up to 4 PNG/JPEG/WebP per request). Model ids:
  `@cf/cloudflare/clef` (27B, Qwen3.8-27B base) and
  `@cf/cloudflare/clef-flash` (9B), on Workers AI. Reported medians are
  **209 ms (Clef)** and **39 ms (Clef-flash)**. Clef-flash costs $0.09 per
  M input tokens and takes up to 64 questions per request
  ([CF model docs](https://developers.cloudflare.com/workers-ai/models/clef-flash/),
  [CF catalogue](https://developers.cloudflare.com/workers-ai/models/),
  [datanorth](https://datanorth.ai/news/cloudflare-releases-clef-and-clef-flash)).
  The latency figures come from press coverage. I have not measured them.

A decision model returns **probabilities over the choices, not numbers**.
That is exactly the split the fitter makes possible: Clef gets the crop
image (plus the stroke summary as text) and answers **Choice: which
imported symbol** (and Choice/Score for enums such as rings 1|2 or
framed). `fitSymbol` then supplies every param. Its calibrated
probabilities can feed the options ring directly.

### 3. Groq

- Vision on Groq today is **one preview model, `qwen/qwen3.8-27b`**. It
  takes text and image input, base64 data URIs, up to 3 images per request
  (each counted as 2 048 input tokens), JSON mode with images, and tool use.
  The models page lists it under *preview* at ~450 tokens/s, $0.80 in /
  $4.00 out per M tokens. **No Llama 4 Scout/Maverick is listed anymore**
  ([vision docs](https://console.groq.com/docs/vision),
  [models](https://console.groq.com/docs/models)). I did not find
  time-to-first-token or free-tier limits for it. For a ~2k-token image and
  a ~100-token JSON reply, ~0.5–1 s round trip is plausible but unmeasured.
  It needs a Groq API key.

### 4. Other fast paths

- **Workers AI general VLMs**: Llama-4-Scout-17B, Llama-3.2-11B-vision,
  Mistral-Small-3.1-24B, moondream3.1 (9B MoE, detection/pointing),
  GLM-5.3-flash ([catalogue](https://developers.cloudflare.com/workers-ai/models/)).
  These generate text, so they are slower than Clef, but they could return
  rough params as JSON if ever needed.
- **Claude Haiku 4.5 via the API**: it has vision and is fast, and it would
  replace the CLI's ~8 s of process and session overhead. But **there is no
  Anthropic API key on this Mac** (only the Claude Code subscription, which
  is why recognize.ts spawns `claude -p`). Its latency is unmeasured here.
- **Local MLX on this Mac (M1 Max, 64 GB)**: `mlx-vlm` isn't installed.
  Small VLMs (SmolVLM, Qwen-VL 2–3B, moondream) are the candidates. I
  didn't benchmark them, and I'd expect several hundred ms per image on an
  M1 Max, not tens of ms. Unverified.

### Recommendation for sub-second CHOICE

1. **Geometry first, locally** (`instantReading`, built). It answers flat
   shapes in 30–330 ms at zero cost.
2. **Otherwise Clef-flash on Workers AI**: one Choice question over the
   imported ids, with the crop PNG and stroke text. The reported ~40 ms
   median plus network is well under a second, and `fitSymbol` adds
   ≤ 60 ms. This fits the stack David already runs (the PL dashboard
   already calls Workers AI for Whisper). **What David provides**: a
   Cloudflare API token with Workers AI access (or a tiny Worker binding
   `env.AI`, which is how the dashboard does it). No download.
3. **Keep the Opus CLI path as the slow, semantic fallback** for words,
   notes and "what did he mean", and for anything Clef is unsure about
   (top probability < ~0.6).
4. Groq's Qwen-VL is the alternative if Clef disappoints (needs a Groq
   key). Haiku 4.5 needs an Anthropic API key.

## 5. Built: the fast pipeline (David's direction, 2026-10-04)

David's call: keep the current behaviour (an LLM reads the scribble with
the same prompt, vocabulary and notes), just much faster. The model is now
pluggable, and Groq is the primary backend.

    pen rests 300 ms ─▶ read ahead (speculate.ts, fast backends only)
         first look:   Groq qwen/qwen3.8-27b, JSON schema, reasoning off  (~0.45 s est.)
         fit:          fit.ts tunes every candidate onto the ink           (20–120 ms)
         fit > 0.03 ─▶ second look: Groq sees its reading in red over the ink, once
         still poor ─▶ escalate: Claude (Anthropic API; the CLI only when ✦ was pressed)
    ✦ pressed ─▶ the reading already here (remembered by ink): ~0 ms

- **`core/scripts/backends.ts`** has three backends behind one question.
  - **Groq**: plain REST, a strict JSON schema, `reasoning_effort: "none"`.
  - **Anthropic**: the official SDK, default `claude-haiku-4-5`, the image as
    a base64 block, `output_config.format`.
  - **CLI**: `claude -p`, unchanged.
  - The chain holds every backend whose key is set (`RECOGNIZE_BACKENDS`
    sets the order). The CLI is always last. If a backend fails, the next
    one gets the question.
  - With **no keys** the CLI runs alone and everything works exactly as
    before. Measured: 5.6 s for a circle, fit 0.010.
- **`recognize.ts`**:
  - One prompt; the API backends see the image inline.
  - One strict schema: params come back as a list of name/value entries, so
    a single schema covers every symbol.
  - Each answer is staged (look, fit, second look, escalate). It reports
    `backend`, `fit` and the per-stage `stages` timings, and the daemon logs
    them.
  - `recognizeMemo` remembers readings by ink, so a reading asked ahead is
    the answer when ✦ is pressed. `instruct.ts` uses the same chain.
- **`overlay.ts`**: a self-contained PNG rasteriser for the second-look
  image (ink in black, the reading in red).
- **`sketch/speculate.ts` + 3 small hooks in main.ts**:
  - It reads the selection, or failing that the burst just drawn.
  - It waits for 300 ms of idle and keeps at most one reading in flight; new
    ink aborts it.
  - It is on only when `GET /api/recognize/config` reports a fast backend,
    so the CLI is never called speculatively.
  - When the reading is already there, the ✦ button glows faintly.
- **Measured with a mocked Groq** (a 450 ms network and model, answers ±15 %
  off), reading ahead:

  | symbol | total | fit |
  |---|---|---|
  | circle | 0.49 s (0.69 s on the first call) | 0.010 |
  | cylinder | 0.47–0.58 s | 0.004 |
  | cube | 0.50 s | 0.024 |
  | MindVirus | 0.57 s | 0.016 (exact path, now held to a 150 ms budget) |

  **✦ afterwards: 0.0–0.1 ms.** The real Groq latency is unmeasured until
  David adds his key.

### For David to try it

1. Put `GROQ_API_KEY=gsk_…` in `core/.env` (gitignored by `core/.gitignore`).
   Optionally add `ANTHROPIC_API_KEY=…` as the second backend.
2. Rebuild the page and restart the daemon: `cd core && bun run studio`.
   That rebuilds `sketch/dist`, which carries the speculation hooks.
3. The daemon log prints `[recognize] … groq qwen/qwen3.8-27b 4xx ms → fit … ms`
   for every reading. These are the real numbers.

Switches: `RECOGNIZE_BACKENDS`, `GROQ_MODEL`, `ANTHROPIC_MODEL`,
`RECOGNIZE_FIT=0`, `RECOGNIZE_ESCALATE=0`, `RECOGNIZE_GEOMETRY_FIRST=1` (fit.ts
answers clear flat shapes with no model).

## 6. Still open

- **The real Groq latency**, and whether Qwen's first look is good enough
  that the second look rarely runs. One session with David's key settles
  both.
- **Trace the MindVirus cable from the ink**, so its body takes the fast
  shortcut path (today ~2.5 ms per evaluation).
- **Flatten the cylinder in mirror.ts** from the same analytic outline.
