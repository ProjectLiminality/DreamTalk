# Harness report — deterministic frame plumbing (Chapter 2)

Date: 2026-08-22 · Machine: David's Mac (Apple Silicon, macOS 15.6) ·
Chrome (system) headless=new, `--enable-unsafe-webgpu --use-angle=metal` ·
three 0.185.1 WebGPURenderer · Bun 1.3.13.

## Setup

- `core/scripts/serve.ts` — static server for the demo page.
- `core/scripts/screenshot.ts` — puppeteer-core drives headless Chrome:
  waits for `window.__dt.ready`, calls `__dt.setT(t)` (which pauses
  playback and renders exactly one frame via `host.renderFrame(t)`), then
  screenshots. This is the plumbing under the editor's overlay evaluation
  (TASTE: The Editor) and CI — the workflow itself is realtime playback.
- Scene: `core/demo/FoundingSmoke.ts` (square + circle draw-on, move,
  scale; 7.5 s).

## Result: byte-identical across 3 independent browser launches

| t | run1 vs run2 | run1 vs run3 |
|---|---|---|
| 3.00 s | identical (`cmp`) | identical (`cmp`) |
| 5.00 s | identical (`cmp`) | identical (`cmp`) |

WebGPU (Metal via ANGLE) rasterization is bit-stable for this content on
this machine. Overlay comparison can therefore assume exact reproducibility
of our own frames; perceptual tolerance is only needed against the
reference videos (720p YouTube encodes).

Caveats to re-verify later: different GPU/driver (other machines), MSAA
changes, and TSL compute-generated geometry (Chapter 6) may perturb
stability — re-run this check when the stroke pipeline lands (Chapter 4).

## Visual smoke verification (Claude-evaluated)

Frames at t ∈ {0.5, 1.9, 3.0, 5.0, 6.5}: draw-on animates segment-wise
(square edge growing at 0.5 s), sequencing correct (circle arc mid-draw at
3.0 s while square holds), convergence correct (circle inscribed in square
at 6.5 s), palette exact (RED 255,100,78 / BLUE 0,162,255 on black).
Known v0 stroke limitations (Chapter 4 replaces this path): segment-
quantized draw-on, no caps/joins control, screen-space width only.
