#!/usr/bin/env python3
"""
overlay.py — the gauntlet's fidelity instrument (quantitative half).

Compares a DreamTalk render against a reference frame, both lines-on-black.
Hue-TOLERANT (DECISIONS 2026-08-23: reproduction uses the canonical palette,
the reference carries 2021 hues + YouTube encode), geometry-STRICT.

Usage:
  python3 overlay.py OURS.png REF.png OUTDIR [--name S01-key1] [--json]

Outputs in OUTDIR:
  <name>-composite.png   ref tinted red, ours green, screen-blended
                         (overlap → yellow/white; deviation → pure color)
  <name>-report.json     metrics + verdict

Metrics (computed on binarized line masks, luminance > threshold):
  iou            intersection-over-union of dilated line masks
  chamfer_ours   mean px distance from our line pixels to nearest ref line px
  chamfer_ref    mean px distance from ref line pixels to nearest ours px
  coverage_ref   fraction of ref line pixels within TOL px of ours (recall)
  coverage_ours  fraction of our line pixels within TOL px of ref (precision)

Verdict: PASS if coverage_ref >= 0.90 and coverage_ours >= 0.90 and both
chamfer means <= 3.0 px (720p frame). These thresholds are the gauntlet's
"delta acceptable" bar — tighten as reproduction matures ("absolutely
flawless" is the asymptote; encode blur and 1px AA differences set the
floor). Text/readout regions can be excluded via --ignore-bottom N.
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

LUMA_THRESHOLD = 32  # of 255 — line pixels vs black background
TOL_PX = 3.0


def load_mask(path: str, size: tuple[int, int] | None, ignore_bottom: int) -> tuple[np.ndarray, np.ndarray]:
    img = Image.open(path).convert("RGB")
    if size and img.size != size:
        img = img.resize(size, Image.LANCZOS)
    arr = np.asarray(img, dtype=np.float32)
    luma = arr @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    if ignore_bottom > 0:
        luma[-ignore_bottom:, :] = 0
    return luma > LUMA_THRESHOLD, arr


def distance_transform(mask: np.ndarray) -> np.ndarray:
    """Chamfer distance to nearest True pixel — vectorized row/column sweeps.

    Four axis sweeps (numpy-accumulated) + one diagonal correction pass via
    3x3 min-filter iterations bounded by TOL: distances beyond TOL_PX*2 are
    clamped (we never need exact values past the tolerance band). Runs in
    ~100ms on 1280x720 vs ~20s for the naive python loop.
    """
    cap = TOL_PX * 4 + 2
    inf = np.float32(cap)
    d = np.where(mask, np.float32(0), inf)
    h, w = d.shape
    # column sweeps
    for y in range(1, h):
        d[y] = np.minimum(d[y], d[y - 1] + 1)
    for y in range(h - 2, -1, -1):
        d[y] = np.minimum(d[y], d[y + 1] + 1)
    # row sweeps
    for x in range(1, w):
        d[:, x] = np.minimum(d[:, x], d[:, x - 1] + 1)
    for x in range(w - 2, -1, -1):
        d[:, x] = np.minimum(d[:, x], d[:, x + 1] + 1)
    # diagonal relaxation: a few 8-neighborhood min passes tighten the
    # city-block overestimate toward euclidean within the tolerance band
    for _ in range(3):
        padded = np.pad(d, 1, constant_values=cap)
        neigh = np.stack([
            padded[:-2, :-2] + 1.414, padded[:-2, 1:-1] + 1, padded[:-2, 2:] + 1.414,
            padded[1:-1, :-2] + 1, padded[1:-1, 2:] + 1,
            padded[2:, :-2] + 1.414, padded[2:, 1:-1] + 1, padded[2:, 2:] + 1.414,
        ])
        d = np.minimum(d, neigh.min(axis=0))
    return np.minimum(d, cap)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("ours")
    ap.add_argument("ref")
    ap.add_argument("outdir")
    ap.add_argument("--name", default="overlay")
    ap.add_argument("--ignore-bottom", type=int, default=0,
                    help="rows to zero at the bottom (readout bar in editor shots)")
    ap.add_argument("--json", action="store_true", help="print report JSON to stdout")
    args = ap.parse_args()

    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)

    ref_img = Image.open(args.ref)
    size = ref_img.size
    ours_mask, ours_rgb = load_mask(args.ours, size, args.ignore_bottom)
    ref_mask, ref_rgb = load_mask(args.ref, None, args.ignore_bottom)

    if not ours_mask.any() or not ref_mask.any():
        print("ERROR: empty line mask", "ours" if not ours_mask.any() else "ref", file=sys.stderr)
        return 2

    d_to_ref = distance_transform(ref_mask)
    d_to_ours = distance_transform(ours_mask)

    chamfer_ours = float(d_to_ref[ours_mask].mean())
    chamfer_ref = float(d_to_ours[ref_mask].mean())
    coverage_ref = float((d_to_ours[ref_mask] <= TOL_PX).mean())
    coverage_ours = float((d_to_ref[ours_mask] <= TOL_PX).mean())

    # IoU on 3px-dilated masks (cheap dilation via distance fields)
    ours_d = d_to_ours <= 1.5
    ref_d = d_to_ref <= 1.5
    iou = float((ours_d & ref_d).sum() / max(1, (ours_d | ref_d).sum()))

    # Composite: ref → red channel, ours → green channel, luminance-based.
    ref_l = np.clip(ref_rgb.max(axis=2), 0, 255)
    ours_l = np.clip(ours_rgb.max(axis=2), 0, 255)
    comp = np.zeros((*ref_mask.shape, 3), dtype=np.uint8)
    comp[..., 0] = ref_l.astype(np.uint8)
    comp[..., 1] = ours_l.astype(np.uint8)
    Image.fromarray(comp).save(out / f"{args.name}-composite.png")

    passed = (
        coverage_ref >= 0.90 and coverage_ours >= 0.90
        and chamfer_ours <= 3.0 and chamfer_ref <= 3.0
    )
    report = {
        "name": args.name,
        "ours": args.ours,
        "ref": args.ref,
        "iou": round(iou, 4),
        "chamfer_ours_px": round(chamfer_ours, 3),
        "chamfer_ref_px": round(chamfer_ref, 3),
        "coverage_ref": round(coverage_ref, 4),
        "coverage_ours": round(coverage_ours, 4),
        "verdict": "PASS" if passed else "FAIL",
    }
    (out / f"{args.name}-report.json").write_text(json.dumps(report, indent=2))
    if args.json:
        print(json.dumps(report))
    else:
        print(f"{report['verdict']}  iou={report['iou']}  chamfer(ours→ref)={report['chamfer_ours_px']}px "
              f"(ref→ours)={report['chamfer_ref_px']}px  coverage ref={report['coverage_ref']} ours={report['coverage_ours']}")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
