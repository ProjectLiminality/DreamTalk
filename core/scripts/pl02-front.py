"""pl02-front.py — measure a connection line's DRAW FRONT in the footage.

Built for P-10's eased-front finding and generalised so any chapter can
re-run it on its own slide. Two questions it answers, both of which are
invisible in a settled frame:

  1. Does the front advance LINEARLY or on Keynote's ease? (`--fit`)
  2. Does the arrowhead ride at the advancing front, or wait at the far
     end? (`--head`)

WHY A DEDICATED INSTRUMENT. The obvious probe — walk the chord and look
for ink — fails on exactly the slides worth measuring, because a mesh's
lines cross each other and a chord walk picks up its neighbours' ink.
Three things make this one work:

  * it samples each line's own QUADRATIC (through the stored middle
    point, per Connections.ts), not its chord, so the samples sit on the
    line rather than near it;
  * it EXCLUDES both endpoint objects' boxes, so a node's own ink can
    never be read as its line's;
  * it reports the front as the furthest CONTIGUOUS lit fraction from
    the `from` end, so a crossing line's ink beyond a gap does not
    advance the front.

Resolution is set by the sample count (default 1/80 of a line) rather
than by the frame rate, which is what lets it separate two curves that
differ by ~0.05 of the line — P-4's discrete-fraction probe resolves 0.1
at best and reports no separation on the same data.

USAGE

    python3 core/scripts/pl02-front.py <deckSlide> --from T0 --to T1 \\
        [--duration D] [--fit] [--head] [--longest N] [--samples N]

    # P-10's deck 11: 70 lines, one simultaneous 2.25s draw
    python3 core/scripts/pl02-front.py 11 --from 209.8 --to 213.0 \\
        --duration 2.25 --fit --head

    # P-4's deck 9: fifteen lines, 2.0s, direction 53 (midpoint-outward)
    python3 core/scripts/pl02-front.py 9 --from 171.8 --to 175.0 \\
        --duration 2.0 --fit --from-middle

Frame N of refs/pitch/pl02/frames5 is video second (N-1)/5.
"""

import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FRAMES = os.path.join(REPO, "refs", "pitch", "pl02", "frames5", "f_%05d.jpg")
ASSETS = os.path.join(REPO, "core", "vocabulary", "Slides", "assets", "pl02")
SLIDE_TO_PX = 2.0 / 3.0  # 1920 canvas -> 1280 frame; see keynote.ts §2


def keynote_ease(u):
    """CSS ease-in-out, cubic-bezier(0.42, 0, 0.58, 1) — P-8's reading of
    Keynote's kEaseBoth. Solves x(s) = u by Newton, returns y(s)."""
    u = np.clip(np.asarray(u, dtype=float), 0.0, 1.0)
    s = u.copy()
    for _ in range(60):
        x = 3 * (1 - s) ** 2 * s * 0.42 + 3 * (1 - s) * s**2 * 0.58 + s**3
        dx = 3 * (1 - s) ** 2 * 0.42 + 6 * (1 - s) * s * 0.16 + 3 * s**2 * 0.42
        s = np.clip(s - (x - u) / np.maximum(dx, 1e-9), 0.0, 1.0)
    return 3 * (1 - s) * s**2 + s**3


def quad_at(p0, p1, p2, t):
    """The quadratic THROUGH p1 at parameter t (control = 2*p1 - (p0+p2)/2)."""
    cx = 2 * p1[0] - (p0[0] + p2[0]) / 2
    cy = 2 * p1[1] - (p0[1] + p2[1]) / 2
    u = 1 - t
    return (u * u * p0[0] + 2 * u * t * cx + t * t * p2[0],
            u * u * p0[1] + 2 * u * t * cy + t * t * p2[1])


def load_slide(index):
    """The slide, read from its EMITTED TypeScript module.

    Deliberately not from `refs/.../keyslides.json`, which is gitignored
    and may not exist: the checked-in modules under
    `core/vocabulary/Slides/assets/pl02/` are what every scene and test
    reads, so measuring against them means this instrument and the
    renderer are looking at the same geometry by construction.

    Bun evaluates the module and hands back JSON — no TypeScript parsing
    here, and no second decoder to drift from the first.
    """
    import subprocess

    path = os.path.join(ASSETS, "slide%02d.ts" % index)
    if not os.path.exists(path):
        sys.exit(
            "deck slide %d is not emitted (%s missing) — add it to "
            "CHAPTER_SLIDES in key2ts.ts and re-run" % (index, path)
        )
    script = (
        'import {slide%02d as s} from "%s";'
        "console.log(JSON.stringify(s));" % (index, path)
    )
    out = subprocess.run(
        ["bun", "-e", script], capture_output=True, text=True,
        cwd=os.path.join(REPO, "core"),
    )
    if out.returncode != 0:
        sys.exit("could not read %s:\n%s" % (path, out.stderr))
    return json.loads(out.stdout)


def boxes_of(slide):
    """Every shape's and group's bounding box, groups resolved recursively.

    A group has no geometry of its own — P-4's finding — so its box is the
    union of its members', which is also how a connection resolves a group
    endpoint's centre.
    """
    by_id = {s["id"]: s for s in slide.get("shapes", [])}
    groups = {g["id"]: g for g in slide.get("groups", [])}
    cache = {}

    def box(ident):
        if ident in cache:
            return cache[ident]
        shape = by_id.get(ident)
        if shape is not None:
            xs, ys = [], []
            for sp in shape.get("subpaths", []):
                xs.extend(sp[0::2])
                ys.extend(sp[1::2])
            cache[ident] = (min(xs), min(ys), max(xs), max(ys)) if xs else None
            return cache[ident]
        group = groups.get(ident)
        if group is None:
            cache[ident] = None
            return None
        acc = None
        for member in group.get("members", []):
            b = box(member)
            if b is None:
                continue
            acc = b if acc is None else (
                min(acc[0], b[0]), min(acc[1], b[1]),
                max(acc[2], b[2]), max(acc[3], b[3]),
            )
        cache[ident] = acc
        return acc

    return box


def corridor(line, box, samples, pad):
    """The line's own sample points, with both endpoint boxes excluded."""
    pts = line["subpaths"][0]
    if len(pts) < 6:
        return [], []
    p0, p1, p2 = pts[0:2], pts[2:4], pts[4:6]
    connects = line.get("connects") or {}
    b_from = box(connects.get("from")) if connects.get("from") else None
    b_to = box(connects.get("to")) if connects.get("to") else None

    def inside(b, x, y):
        return b is not None and (b[0] - pad <= x <= b[2] + pad
                                  and b[1] - pad <= y <= b[3] + pad)

    fracs, pixels = [], []
    for i in range(1, samples):
        t = i / float(samples)
        x, y = quad_at(p0, p1, p2, t)
        if inside(b_from, x, y) or inside(b_to, x, y):
            continue
        fracs.append(t)
        pixels.append((int(round(x * SLIDE_TO_PX)), int(round(y * SLIDE_TO_PX))))
    return fracs, pixels


def lit(img, px, py, tol=2, thresh=100):
    w = img[max(0, py - tol):py + tol + 1, max(0, px - tol):px + tol + 1]
    return bool(w.size and w.max() > thresh)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slide", type=int, help="deck slide index")
    ap.add_argument("--from", dest="t0", type=float, required=True)
    ap.add_argument("--to", dest="t1", type=float, required=True)
    ap.add_argument("--duration", type=float, default=None,
                    help="the build's DECLARED duration; required for --fit")
    ap.add_argument("--longest", type=int, default=20,
                    help="use the N longest lines (they resolve the front best)")
    ap.add_argument("--samples", type=int, default=80)
    ap.add_argument("--pad", type=float, default=6.0,
                    help="slide units of padding on each excluded endpoint box")
    ap.add_argument("--fit", action="store_true",
                    help="fit the onset under both curves and compare")
    ap.add_argument("--head", action="store_true",
                    help="test whether the arrowhead waits at the far end")
    ap.add_argument("--from-middle", action="store_true",
                    help="direction 53: measure the front outward from the middle")
    args = ap.parse_args()

    slide = load_slide(args.slide)
    box = boxes_of(slide)
    lines = [s for s in slide.get("shapes", []) if s.get("isConnectionLine")]
    if not lines:
        sys.exit("deck slide %d has no connection lines" % args.slide)

    def chord(l):
        p = l["subpaths"][0]
        return ((p[4] - p[0]) ** 2 + (p[5] - p[1]) ** 2) ** 0.5

    lines.sort(key=chord, reverse=True)
    picked = lines[:args.longest]

    lo = int(round(args.t0 * 5)) + 1
    hi = int(round(args.t1 * 5)) + 1
    frames = list(range(lo, hi + 1))
    imgs = {n: np.asarray(Image.open(FRAMES % n).convert("L"), dtype=np.float32)
            for n in frames}

    corridors = []
    for line in picked:
        fracs, pixels = corridor(line, box, args.samples, args.pad)
        if len(fracs) >= 8:
            corridors.append((line["id"], fracs, pixels))
    if not corridors:
        sys.exit("no line kept enough samples — try a smaller --pad")

    print("deck slide %d: %d connection lines, measuring the %d longest"
          % (args.slide, len(lines), len(corridors)))
    print()

    series = []
    for n in frames:
        img = imgs[n]
        fronts = []
        for _, fracs, pixels in corridors:
            if args.from_middle:
                # Direction 53 draws outward from the middle, so the front
                # is how far the LIT RUN AROUND THE MIDDLE extends.
                mid = len(pixels) // 2
                reach = 0
                for step in range(1, mid + 1):
                    a, b = mid - step, mid + step
                    ok_a = a < 0 or lit(img, *pixels[a])
                    ok_b = b >= len(pixels) or lit(img, *pixels[b])
                    if ok_a and ok_b:
                        reach = step
                    else:
                        break
                fronts.append(reach / float(max(mid, 1)))
            else:
                front = 0.0
                for frac, (px, py) in zip(fracs, pixels):
                    if lit(img, px, py):
                        front = frac
                    else:
                        break
                fronts.append(front)
        series.append(float(np.mean(fronts)))

    t = np.array([(n - 1) / 5.0 for n in frames])
    f = np.array(series)
    peak = f.max()
    if peak <= 0:
        sys.exit("no ink found in the window — check --from/--to")
    f = f / peak

    print("  video s   mean front fraction")
    for a, b in zip(t, f):
        print("  %7.2f   %6.3f  %s" % (a, b, "#" * int(round(b * 50))))
    print()

    if args.fit:
        if args.duration is None:
            sys.exit("--fit needs --duration (the DECLARED duration; never fitted)")
        print("onset fit, duration held at the declared %.2fs, only the offset free:"
              % args.duration)
        results = {}
        for name, fn in (("eased", keynote_ease),
                         ("linear", lambda u: np.clip(u, 0.0, 1.0))):
            best = None
            for onset in np.arange(t[0] - 1.0, t[-1], 0.005):
                pred = fn((t - onset) / args.duration)
                r = float(np.sum((pred - f) ** 2))
                if best is None or r < best[1]:
                    best = (onset, r)
            rms = (best[1] / len(t)) ** 0.5
            results[name] = (best[0], rms)
            print("  %-7s onset %8.3f s   rms %.4f" % (name, best[0], rms))
        ratio = results["linear"][1] / max(results["eased"][1], 1e-12)
        print()
        print("  the ease fits %.1fx better than linear" % ratio)
        if ratio < 1.5:
            print("  -- NOT a separation. This window cannot tell the two apart;")
            print("     report no result rather than the better-by-a-hair one.")
        print()

    if args.head:
        print("does the arrowhead wait at the far end?")
        print("  (ink in the far 15%% of the corridor, while the front advances)")
        print()
        print("  video s   mean front   far-corridor ink")
        for n in frames:
            img = imgs[n]
            fronts, fars = [], []
            for _, fracs, pixels in corridors:
                front = 0.0
                for frac, (px, py) in zip(fracs, pixels):
                    if lit(img, px, py):
                        front = frac
                    else:
                        break
                if front <= 0.05 or front >= 0.90:
                    continue
                fronts.append(front)
                tail = [lit(img, px, py)
                        for frac, (px, py) in zip(fracs, pixels) if frac > 0.85]
                fars.append(sum(tail) / float(max(len(tail), 1)))
            if fronts:
                print("  %7.2f   %8.3f   %14.3f"
                      % ((n - 1) / 5.0, np.mean(fronts), np.mean(fars)))
        print()
        print("  A head WAITING at its final position reads ~1.0 in the right")
        print("  column while the left column is mid-draw. A head that TRAVELS")
        print("  with the front reads ~0.0 throughout.")


if __name__ == "__main__":
    main()
