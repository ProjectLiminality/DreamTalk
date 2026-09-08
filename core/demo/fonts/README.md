# Vendored faces

Both files are committed to the repo and served by `core/scripts/serve.ts`
off the repo root — never fetched from a CDN, for the same reason the
HarfBuzz WASM is not: network dependency and non-determinism (see
`core/src/render/text.ts`'s header).

| File | Face | Licence | Selected by |
|------|------|---------|-------------|
| `Arimo-Regular.ttf` | Arimo Regular — proportional, metric-compatible with Arial, i.e. the Helvetica-class look of the C4D default in video-01 | Apache 2.0 | the default; `Text.font` unset |
| `Cousine-Regular.ttf` | Cousine Regular — MONOSPACE, the fixed-pitch sibling of Arimo (same designer, Steve Matteson; same metric-compatibility programme, matching Courier New) | SIL Open Font License 1.1 — `OFL-Cousine.txt` | `Text.font = "mono"` |

Cousine was taken from `google/fonts` at `ofl/cousine/Cousine-Regular.ttf`
(**not** `apache/cousine` — the family moved to the OFL upstream; its
licence file is vendored beside it, unmodified).

Why Cousine and not one of the classic code faces: Scene07's code panel
is a *reproduction* target, and its three layout constants were measured
off a reference whose panel is a screenshot of a Courier-class monospace.
Cousine matching Courier New's metrics means our advance lands near the
reference's without a second free parameter to tune — and it keeps the
whole corpus inside the same metric-compatible family Arimo already sits
in.
