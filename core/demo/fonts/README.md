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

## The faces that are NOT here, and cannot be

The PL02 deck sets every string in **HelveticaNeue** — regular, `-Medium`
and `-Bold` (`docs/reports/pl02-vocabulary.md`). Apple's fonts are
proprietary: they are licensed for use on the machine that ships them and
may **not** be redistributed, so they cannot be committed to this repo,
and no amount of wanting the fidelity changes that.

What happens instead is a two-link chain, `core/src/render/fonts.ts`:

1. **the locally extracted face**, if this machine has it. macOS ships
   `/System/Library/Fonts/HelveticaNeue.ttc`, a 14-face collection.
   `bun core/scripts/system-font.ts --all` unpacks the faces the deck
   names into `refs/fonts/` — which `.gitignore` already excludes, and
   which is the honest shelf for exactly this: things that exist on
   David's machine and are not the repo's to give away. The unpack is an
   sfnt repack (`core/src/render/ttc.ts`), not a re-encoding: every glyph
   outline is the bytes Apple shipped, and the same input always produces
   the same file. It is needed because `three-text` rejects the `ttcf`
   signature outright and hardcodes face index 0, which would hand back
   Regular where the title card wants Bold.
2. **the vendored fallback above**, everywhere else. A checkout on Linux,
   or on a Mac that has not run the extraction, renders every scene — in
   Arimo, at a stated fidelity cost.

**What the fidelity cost is, measured.** On the PL02 title card at 720p,
scored against `refs/pitch/pl02/frames5/f_04510.jpg`:

| face | coverage_ref | coverage_ours | verdict |
|---|---|---|---|
| HelveticaNeue-Bold (extracted) | **0.9986** | **0.9757** | PASS |
| Arimo (fallback) | 0.8168 | 0.8809 | FAIL |

Arimo is Arial-metric, which is Helvetica-*class* but not Helvetica-*Neue*:
it sets "Project Liminality" 580 px wide where HelveticaNeue-Bold sets it
608. That 4.6% is why the fallback is a fallback and not a substitute.

A free metric-compatible clone was considered and not taken. TeX Gyre
Heros and Nimbus Sans clone **Helvetica**, whose widths differ from
Helvetica *Neue*'s, so vendoring one would have swapped a known
approximation for an unmeasured one. If the real face is ever needed on a
machine that cannot have it, measure a clone against the numbers above
before adopting it — do not assume the family name is enough.
