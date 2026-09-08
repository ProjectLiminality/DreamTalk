#!/usr/bin/env python3
"""
pl02-masked.py — score a PL02 frame with declared regions excluded.

WHY THIS EXISTS, AND WHY IT IS NOT A CONVENIENT CROP

`overlay.py` scores a whole frame, which is right: a reproduction that
misses half the picture has missed half the picture, and a harness that
lets you hide the miss is worthless. This does not replace it. The
unmasked score stays the headline in every report.

What it adds is DECOMPOSITION. When a frame fails, the useful question is
which of several independent causes it failed for, and the honest way to
answer that is to exclude one cause at a time and watch the number move.
P-3's segment 2 is the worked example: it scores coverage_ref 0.4878
whole-frame, and 47% of that frame's reference ink is five
`TSD.ImageArchive` drawables the importer does not yet compose. Masking
exactly those five takes it to 0.9113 / 0.9263 — which says the builds
are right and the importer has a gap, where the single number said only
"fail".

The discipline that keeps this honest is that every mask is DECLARED
GEOMETRY. The image boxes come from the deck's own
`super.geometry.position` and `.size` for the archives the decode skips,
converted by the same 2/3 the rest of the pipeline uses. Nothing is drawn
around a region because it happened to score badly. A mask that cannot be
justified from the source does not belong in a config file here.

Usage:
  python3 pl02-masked.py CONFIG.json

CONFIG is a list of entries:
  {"label": "...", "ours": "...png", "ref": "...jpg",
   "boxes": [[y0, y1, x0, x1], ...]}   # video pixels, y down

Boxes are in the 1280x720 FRAME, not in slide units. The helper below
converts a deck geometry box, so a caller states the deck's numbers.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import overlay  # noqa: E402

SLIDE_TO_VIDEO = 2 / 3


def deck_box(x, y, w, h, pad=3):
    """A deck geometry box (slide units) as a frame box (video px)."""
    return [
        int(y * SLIDE_TO_VIDEO) - pad,
        int((y + h) * SLIDE_TO_VIDEO) + pad + 1,
        int(x * SLIDE_TO_VIDEO) - pad,
        int((x + w) * SLIDE_TO_VIDEO) + pad + 1,
    ]


def score(ours_path, ref_path, boxes, label):
    ref_mask, _ = overlay.load_mask(ref_path, None, 0)
    size = Image.open(ref_path).size
    our_mask, _ = overlay.load_mask(ours_path, size, 0)

    keep = np.ones_like(ref_mask)
    for (y0, y1, x0, x1) in boxes:
        keep[y0:y1, x0:x1] = False

    total = int(ref_mask.sum())
    mr = ref_mask & keep
    mo = our_mask & keep
    dropped = total - int(mr.sum())

    d_ours = overlay.distance_transform(mo)
    d_ref = overlay.distance_transform(mr)
    cov_ref = float((d_ours[mr] <= overlay.TOL_PX).mean()) if mr.any() else 0.0
    cov_ours = float((d_ref[mo] <= overlay.TOL_PX).mean()) if mo.any() else 0.0
    ch_ours = float(d_ref[mo].mean()) if mo.any() else float("nan")
    ch_ref = float(d_ours[mr].mean()) if mr.any() else float("nan")

    ok = cov_ref >= 0.90 and cov_ours >= 0.90 and ch_ours <= 3.0 and ch_ref <= 3.0
    print(label)
    print(f"   masked ref ink   {dropped:6d} / {total:6d}"
          f"  ({100 * dropped / max(total, 1):.1f}%)")
    print(f"   coverage_ref {cov_ref:.4f}  coverage_ours {cov_ours:.4f}"
          f"  chamfer {ch_ours:.3f}/{ch_ref:.3f}  {'PASS' if ok else 'FAIL'}")
    return {"label": label, "coverage_ref": round(cov_ref, 4),
            "coverage_ours": round(cov_ours, 4),
            "chamfer_ours_px": round(ch_ours, 3),
            "chamfer_ref_px": round(ch_ref, 3),
            "masked_ref_ink": dropped, "total_ref_ink": total,
            "verdict": "PASS" if ok else "FAIL"}


if __name__ == "__main__":
    out = [score(e["ours"], e["ref"], [tuple(b) for b in e["boxes"]], e["label"])
           for e in json.load(open(sys.argv[1]))]
    if len(sys.argv) > 2:
        json.dump(out, open(sys.argv[2], "w"), indent=1)
