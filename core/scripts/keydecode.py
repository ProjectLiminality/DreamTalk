#!/usr/bin/env python3
"""
keydecode.py — the Python half of the .key importer (core/scripts/key2ts.ts).

`keynote-parser` is a Python library and there is no TypeScript decoder
for Apple's .iwa protobuf format, so the pipeline is split exactly where
the language boundary is:

    .key/Index/*.iwa  --[this script]-->  slides.json  --[key2ts.ts]-->  *.ts

This script does DECODING ONLY. It walks the archives, resolves the
style-inheritance chains, and emits one flat JSON record per slide with
typed path elements untouched — no flattening, no fitting, no frame
change. All of that lives in core/src/geometry/keynote.ts, in TypeScript,
where it is testable alongside the rest of the framework. The rule is the
same one svg2ts.ts follows: the transformation is framework code, the
build step only feeds it.

Run it with keynote-parser's own interpreter (the system python3 lacks
the library, and the venv lacks numpy — the two halves of the PL02
analysis were split the same way):

    /Users/davidrug/.local/pipx/venvs/keynote-parser/bin/python \
        core/scripts/keydecode.py refs/pitch/pl02/key OUT.json

Output is deterministic: archives are visited in the show's own slide
order and drawables in each slide's stored z-order.
"""

import hashlib
import json
import os
import sys

from keynote_parser.codec import IWAFile


def load(path):
    """Every archive in one .iwa, by identifier."""
    with open(path, "rb") as f:
        raw = f.read()
    doc = IWAFile.from_buffer(raw, os.path.basename(path)).to_dict()
    out = {}
    for chunk in doc["chunks"]:
        for archive in chunk["archives"]:
            objs = archive.get("objects") or []
            if objs:
                out[archive["header"]["identifier"]] = objs[0]
    return out


def sha16(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()[:16]


# --- style resolution -------------------------------------------------------
#
# A Keynote style is a chain: a per-shape variation overrides a theme
# style overrides its parent. Properties are merged CHILD-FIRST walking
# up the chain, which is what "overrideCount" is counting. Both
# TSWP.ShapeStyleArchive and TSD.ShapeStyleArchive nest their properties
# one level down under "super"; the loop reads both levels so it does not
# have to care which archive type it landed on.


def style_chain(ident, tables):
    seen = set()
    while ident and ident not in seen:
        seen.add(ident)
        obj = None
        for t in tables:
            if ident in t:
                obj = t[ident]
                break
        if obj is None:
            return
        yield obj
        sup = obj.get("super") or {}
        parent = sup.get("parent") or (sup.get("super") or {}).get("parent")
        ident = parent["identifier"] if parent else None


def resolve_shape_props(ident, tables):
    """Merge shapeProperties up the inheritance chain, child wins."""
    merged = {}
    for obj in style_chain(ident, tables):
        for level in (obj, obj.get("super") or {}):
            props = level.get("shapeProperties")
            if isinstance(props, dict):
                for k, v in props.items():
                    merged.setdefault(k, v)
    return merged


def resolve_char_props(ident, tables):
    merged = {}
    para = {}
    for obj in style_chain(ident, tables):
        for level in (obj, obj.get("super") or {}):
            cp = level.get("charProperties")
            if isinstance(cp, dict):
                for k, v in cp.items():
                    merged.setdefault(k, v)
            pp = level.get("paraProperties")
            if isinstance(pp, dict):
                for k, v in pp.items():
                    para.setdefault(k, v)
    return merged, para


def color(c):
    if not isinstance(c, dict):
        return None
    return {
        "r": c.get("r", 0.0),
        "g": c.get("g", 0.0),
        "b": c.get("b", 0.0),
        "a": c.get("a", 1.0),
    }


def stroke_of(props):
    s = props.get("stroke")
    if not isinstance(s, dict):
        return None
    pat = s.get("pattern") or {}
    ptype = pat.get("type", "TSDSolidPattern")
    count = pat.get("count", 0) or 0
    arr = list(pat.get("pattern") or [])[:count]
    col = color(s.get("color"))
    if col is None:
        return None
    return {
        "color": col,
        "width": s.get("width", 1.0),
        "patternType": ptype,
        "pattern": arr,
        "cap": s.get("cap", "ButtCap"),
        "join": s.get("join", "MiterJoin"),
    }


def fill_of(props, skipped):
    f = props.get("fill")
    if not isinstance(f, dict) or not f:
        return None
    if "gradient" in f:
        # A gradient is not expressible as a flat fill and no slide in
        # 1-58 depends on one; named rather than silently averaged.
        skipped.append("gradientFill")
        return None
    col = color(f.get("color"))
    return {"color": col} if col else None


# TATvalueN — Keynote's paragraph alignment enum.
ALIGN = {
    "TATvalue0": "left",
    "TATvalue1": "right",
    "TATvalue2": "center",
    "TATvalue3": "justify",
    "TATvalue4": "justify",
}
# kFrameAlign* — where the laid-out lines sit inside the text box. This is
# NOT a detail: the title card's own string is bottom-aligned in a 366-unit
# box, which puts its baseline 100px below where a middle guess lands.
VALIGN = {
    "kFrameAlignTop": "top",
    "kFrameAlignMiddle": "middle",
    "kFrameAlignBottom": "bottom",
    "kFrameAlignJustify": "middle",
}


# --- path sources -----------------------------------------------------------
#
# Five kinds appear in this deck (874 / 700 / 46 / 24 / 6 instances).
# bezierPathSource and connectionLinePathSource already carry typed
# elements; the other three state a construction that is turned into the
# same element form here, so the TypeScript side sees ONE shape of data.


def elements_from(src, skipped):
    """(elements, localizationKey) for whichever path source this is."""
    key = src.get("localizationKey")

    bp = src.get("bezierPathSource")
    if isinstance(bp, dict):
        return bp.get("path", {}).get("elements", []), key

    cl = src.get("connectionLinePathSource")
    if isinstance(cl, dict):
        return (cl.get("super") or {}).get("path", {}).get("elements", []), key

    eb = src.get("editableBezierPathSource")
    if isinstance(eb, dict):
        return editable_elements(eb), key

    sp = src.get("scalarPathSource")
    if isinstance(sp, dict):
        return scalar_elements(sp, skipped), key

    pp = src.get("pointPathSource")
    if isinstance(pp, dict):
        return point_elements(pp, skipped), key

    skipped.append("unknownPathSource")
    return [], key


def editable_elements(eb):
    """A node list with in/out control points → moveTo/curveTo records."""
    out = []
    for subpath in eb.get("subpaths") or []:
        nodes = subpath.get("nodes") or []
        if not nodes:
            continue
        first = nodes[0]["nodePoint"]
        out.append({"type": "moveTo", "points": [first]})
        seq = nodes[1:] + ([nodes[0]] if subpath.get("closed") else [])
        prev = nodes[0]
        for node in seq:
            out.append(
                {
                    "type": "curveTo",
                    "points": [
                        prev.get("outControlPoint", prev["nodePoint"]),
                        node.get("inControlPoint", node["nodePoint"]),
                        node["nodePoint"],
                    ],
                }
            )
            prev = node
        if subpath.get("closed"):
            out.append({"type": "closeSubpath"})
    return out


def polyline_elements(pts, closed=True):
    """A point list as moveTo/lineTo records — the parametric shapes' output."""
    out = [{"type": "moveTo", "points": [pts[0]]}]
    out += [{"type": "lineTo", "points": [p]} for p in pts[1:]]
    if closed:
        out.append({"type": "closeSubpath"})
    return out


def scalar_elements(sp, skipped):
    """The `scalar` family: a shape parameterised by one number.

    Both members are emitted in the source's OWN naturalSize box rather
    than a normalised one, because the scalar is stated in those units
    (kTSDRoundedRectangle's 13.17 is a corner RADIUS, not a fraction) —
    and the fit in keynote.ts rescales the curve box onto the geometry
    box afterwards either way.
    """
    import math

    kind = sp.get("type")
    nat = sp.get("naturalSize") or {"width": 100.0, "height": 100.0}
    w, h = nat.get("width", 100.0), nat.get("height", 100.0)

    if kind == "kTSDRegularPolygon":
        n = int(sp.get("scalar", 3))
        if n < 3:
            return []
        pts = []
        for i in range(n):
            a = -math.pi / 2 + 2 * math.pi * i / n
            pts.append({"x": w / 2 + (w / 2) * math.cos(a), "y": h / 2 + (h / 2) * math.sin(a)})
        return polyline_elements(pts)

    if kind == "kTSDRoundedRectangle":
        r = min(sp.get("scalar", 0.0), w / 2, h / 2)
        if r <= 0:
            return polyline_elements(
                [{"x": 0, "y": 0}, {"x": w, "y": 0}, {"x": w, "y": h}, {"x": 0, "y": h}]
            )
        # Four straight runs joined by quarter arcs, sampled finely enough
        # that the flattener's tolerance is what governs the final density.
        seg = 12
        pts = []
        for cx, cy, a0 in (
            (w - r, r, -math.pi / 2),
            (w - r, h - r, 0.0),
            (r, h - r, math.pi / 2),
            (r, r, math.pi),
        ):
            for i in range(seg + 1):
                a = a0 + (math.pi / 2) * i / seg
                pts.append({"x": cx + r * math.cos(a), "y": cy + r * math.sin(a)})
        return polyline_elements(pts)

    skipped.append(kind or "scalarPathSource")
    return []


def point_elements(pp, skipped):
    """The `point` family: a shape parameterised by an (x, y) pair.

    The two arrows read their `point` as (shaft thickness in natural
    units, head length as a fraction of the width) — the geometry that
    reproduces Keynote's own arrows and, more to the point, the geometry
    whose curve box has the aspect the shape's `size` records.
    """
    import math

    kind = pp.get("type")
    nat = pp.get("naturalSize") or {"width": 100.0, "height": 100.0}
    w, h = nat.get("width", 100.0), nat.get("height", 100.0)
    px = pp.get("point", {}).get("x", 0.0)
    py = pp.get("point", {}).get("y", 0.5)

    if kind == "kTSDStar":
        n = int(px) if px >= 3 else 5
        inner = py
        pts = []
        for i in range(2 * n):
            r = 0.5 if i % 2 == 0 else 0.5 * inner
            a = -math.pi / 2 + math.pi * i / n
            pts.append({"x": w / 2 + w * r * math.cos(a), "y": h / 2 + h * r * math.sin(a)})
        return polyline_elements(pts)

    if kind == "kTSDRightSingleArrow":
        # Shaft of half-thickness `t` running left to the head's base at
        # x = w - head, then the head's three points.
        t = min(px, h) / 2
        head = min(max(py, 0.0), 1.0) * w
        base = w - head
        cy = h / 2
        return polyline_elements(
            [
                {"x": 0.0, "y": cy - t},
                {"x": base, "y": cy - t},
                {"x": base, "y": 0.0},
                {"x": w, "y": cy},
                {"x": base, "y": h},
                {"x": base, "y": cy + t},
                {"x": 0.0, "y": cy + t},
            ]
        )

    if kind == "kTSDDoubleArrow":
        t = min(px, h) / 2
        head = min(max(py, 0.0), 0.5) * w
        cy = h / 2
        return polyline_elements(
            [
                {"x": 0.0, "y": cy},
                {"x": head, "y": 0.0},
                {"x": head, "y": cy - t},
                {"x": w - head, "y": cy - t},
                {"x": w - head, "y": 0.0},
                {"x": w, "y": cy},
                {"x": w - head, "y": h},
                {"x": w - head, "y": cy + t},
                {"x": head, "y": cy + t},
                {"x": head, "y": h},
            ]
        )

    skipped.append(kind or "pointPathSource")
    return []


# --- drawables --------------------------------------------------------------


def geometry_of(drawable):
    """Every drawable nests its geometry at a different depth; find it."""
    node = drawable
    for _ in range(4):
        if not isinstance(node, dict):
            return None
        g = node.get("geometry")
        if isinstance(g, dict):
            return {
                "position": g.get("position", {"x": 0.0, "y": 0.0}),
                "size": g.get("size", {"width": 0.0, "height": 0.0}),
                "angle": g.get("angle", 0.0),
                "flags": g.get("flags", 0),
            }
        node = node.get("super")
    return None


def descend(drawable, depth):
    node = drawable
    for _ in range(depth):
        node = (node or {}).get("super") or {}
    return node


def text_of(drawable, slide, doc_styles, skipped, shape_props=None):
    """The string + its resolved face, or None when the shape is not text."""
    # ownedStorage sits one or two levels down depending on placeholder-ness.
    storage_ref = None
    node = drawable
    for _ in range(4):
        if not isinstance(node, dict):
            break
        if node.get("ownedStorage"):
            storage_ref = node["ownedStorage"]
            break
        node = node.get("super")
    if not storage_ref:
        return None
    storage = slide.get(storage_ref["identifier"])
    if not storage:
        return None
    runs = storage.get("text") or []
    content = "".join(runs).rstrip("\n")
    if not content.strip():
        return None

    entries = (storage.get("tableParaStyle") or {}).get("entries") or []
    style_id = entries[0]["object"]["identifier"] if entries else None
    char, para = resolve_char_props(style_id, (slide, doc_styles))
    if not char:
        skipped.append("unresolvedTextStyle")

    col = color(char.get("fontColor")) or {"r": 1.0, "g": 1.0, "b": 1.0, "a": 1.0}
    props = shape_props or {}
    padding = props.get("padding") or {}
    return {
        "content": content,
        "align": ALIGN.get(para.get("alignment", "TATvalue0"), "left"),
        "verticalAlign": VALIGN.get(props.get("verticalAlignment", "kFrameAlignTop"), "top"),
        "padding": {
            "left": padding.get("left", 0.0),
            "top": padding.get("top", 0.0),
            "right": padding.get("right", 0.0),
            "bottom": padding.get("bottom", 0.0),
        },
        "lineSpacing": (para.get("lineSpacing") or {}).get("amount", 1.0),
        "fontSize": char.get("fontSize", 50.0),
        # TRACKING: extra advance after each character as a fraction of
        # the em. It lives in the THEME stylesheet's character style, not
        # in the slide, so it arrives here only through the merged
        # resolve_char_props chain — and it is load-bearing: the title
        # card's -0.02 is the difference between the deck's 610 px word
        # and HelveticaNeue-Bold's untracked 640 at 720p (P-2).
        "tracking": char.get("tracking", 0.0),
        "fontName": char.get("fontName", "HelveticaNeue"),
        "bold": bool(char.get("bold", False)),
        "italic": bool(char.get("italic", False)),
        "color": col,
    }


def opacity_of(drawable):
    node = drawable
    for _ in range(4):
        if not isinstance(node, dict):
            break
        if "opacity" in node:
            return node["opacity"]
        node = node.get("super")
    return 1.0


SHAPE_TYPES = ("TSWP.ShapeInfoArchive", "KN.PlaceholderArchive", "TSD.ConnectionLineArchive")


def walk(ident, slide, doc_styles, out_drawables, out_groups, skipped, order, offset=(0.0, 0.0)):
    """Depth-first over ownedDrawables, flattening groups to membership.

    GROUP CHILDREN ARE STORED RELATIVE TO THEIR PARENT GROUP, and groups
    nest — so `offset` accumulates every enclosing group's position down
    the chain and is added to each drawable's own position.

    This corrects P-1's original claim that children were absolute. That
    claim was never exercised by P-1's gate (the title slide has no
    groups) and it is false: on slide 32 the "InterLogos" text box has
    geometry (118.41, 121.54) inside group 5688069 at (841.59, 773.70),
    and the sum (960.00, 895.24) is where frame f_02826 draws it —
    horizontally dead centre on the 1920 canvas. Taken as absolute it
    sits against the canvas's top-left corner, which is what our render
    did (P-2 measured coverage 0.29/0.28 on that slide).

    The composition is a pure TRANSLATION, verified across all 678 groups
    in the deck: not one carries a nonzero angle, and every apparent
    group-box/child-extent mismatch is either a rotated child (whose
    axis-aligned box does not bound its own ink) or a stale group box
    that does not tightly bound its children. In every case each child
    sits at its natural size — group 4524553's box is 51.13x18.75 and its
    child 4524569 is exactly 51.13x18.75 at (0, 0), while two siblings
    simply overflow the box; group 4095005's 8.9-unit "excess" is
    entirely its two 67deg/113deg rotated Logo legs. So there is no scale
    to apply, and deriving one from the box ratio would move geometry
    that is currently correct.
    """
    obj = slide.get(ident)
    if obj is None:
        return
    pbtype = obj.get("_pbtype")

    if pbtype == "TSD.GroupArchive":
        gg = geometry_of(obj)
        inner = offset
        if gg:
            inner = (
                offset[0] + gg["position"].get("x", 0.0),
                offset[1] + gg["position"].get("y", 0.0),
            )
        members = []
        for child in (obj.get("children") or obj.get("childInfos") or []):
            cid = child["identifier"]
            before = len(out_drawables)
            walk(cid, slide, doc_styles, out_drawables, out_groups, skipped, order, inner)
            if len(out_drawables) > before:
                members.append(cid)
        if members:
            out_groups.append({"id": ident, "members": members})
        return

    if pbtype not in SHAPE_TYPES:
        if pbtype and pbtype not in ("TSD.ImageArchive",):
            skipped.append(pbtype)
        elif pbtype:
            skipped.append(pbtype)
        return

    geom = geometry_of(obj)
    if geom is None:
        return
    # Lift the drawable out of its group chain and onto the canvas. Done
    # here, once, so everything downstream — the fit, the frame change,
    # the emitted module — sees plain canvas coordinates and no consumer
    # has to know groups existed.
    if offset != (0.0, 0.0):
        geom = dict(geom)
        geom["position"] = {
            "x": geom["position"].get("x", 0.0) + offset[0],
            "y": geom["position"].get("y", 0.0) + offset[1],
        }

    # Find the pathsource and the style, at whatever nesting this archive uses.
    src, style_ref = None, None
    node = obj
    for _ in range(4):
        if not isinstance(node, dict):
            break
        if src is None and isinstance(node.get("pathsource"), dict):
            src = node["pathsource"]
        if style_ref is None and isinstance(node.get("style"), dict):
            style_ref = node["style"]
        node = node.get("super")

    props = resolve_shape_props(style_ref["identifier"], (slide, doc_styles)) if style_ref else {}
    text = text_of(obj, slide, doc_styles, skipped, props)
    opacity = opacity_of(obj)

    if text is not None:
        out_drawables.append(
            {"kind": "text", "id": ident, "frame": geom, "opacity": opacity, **text}
        )
        return

    if src is None:
        return
    elements, icon = elements_from(src, skipped)
    if not elements:
        return
    st = stroke_of(props)
    fl = fill_of(props, skipped)
    if st is None and fl is None:
        # A shape with neither surface draws nothing; the text boxes that
        # produced no string land here and are correctly dropped.
        return
    if st is not None and st["patternType"] == "TSDEmptyPattern":
        st = None
    if st is None and fl is None:
        return

    # Keynote's flip bits live alongside the path source, not in geometry.
    flags = 0
    if src.get("horizontalFlip"):
        flags |= 1
    if src.get("verticalFlip"):
        flags |= 2
    geom["flags"] = flags

    rec = {
        "kind": "shape",
        "id": ident,
        "frame": geom,
        "elements": elements,
        "opacity": opacity,
    }
    if icon:
        rec["icon"] = icon
    if st:
        rec["stroke"] = st
    if fl:
        rec["fill"] = fl
    out_drawables.append(rec)


def builds_of(slide, slide_archive):
    """The slide's builds, IN THE DECK'S OWN ORDER.

    The order is the `KN.SlideArchive.builds` list, which is the slide's
    own declared sequence — not archive iteration order, and emphatically
    not a sort. An earlier version of this function sorted by
    (target, effect) to defend the determinism test against unstable
    archive iteration. That defence was unnecessary (decoding the same
    .iwa three times yields identical archive order) and it destroyed the
    sequence a reproduction needs, so it is gone. `builds` is the right
    key anyway: it is stated by the format rather than observed.

    `direction` is carried because LineDrawForLine needs it and it cannot
    be recovered from geometry. It selects which END of the stroke the
    draw starts from, and the deck's stored point order does NOT predict
    it — P-3 measured slide 2's four connection lines in the footage and
    found all four draw centre-outward, two of them against their stored
    order (dir 52) and one with it (dir 51).

    It appears on only 5 slides and is absent on 114 of the 158
    LineDrawForLine builds, so absence is the default and slide 2 is
    unrepresentative. Deck slide 9 (archive 4705361) uses direction 53
    for all fifteen of its builds. Emitted as-is, uninterpreted: naming
    what 51/52/53 mean in general would be a guess from four samples, and
    the consumer that needs a rule should state its own reading against
    the footage rather than inherit one from here.
    """
    ordered = [ref["identifier"] for ref in (slide_archive.get("builds") or [])]
    seen = set(ordered)
    # Anything the list somehow omits still gets carried, after the
    # declared ones, so a malformed slide loses no build.
    for ident, obj in slide.items():
        if obj.get("_pbtype") == "KN.BuildArchive" and ident not in seen:
            ordered.append(ident)

    out = []
    for ident in ordered:
        obj = slide.get(ident)
        if not obj or obj.get("_pbtype") != "KN.BuildArchive":
            continue
        attrs = obj.get("attributes") or {}
        anim = attrs.get("animationAttributes") or {}
        drawable = obj.get("drawable") or {}
        rec = {
            "id": ident,
            "target": drawable.get("identifier", ""),
            "effect": anim.get("effect", "none"),
            "animationType": anim.get("animationType", "In"),
            "duration": anim.get("duration", 0.0),
            "delay": anim.get("delay", 0.0),
            "delivery": obj.get("delivery", "All at Once"),
            "acceleration": attrs.get("actionAcceleration"),
            # Keynote's on-click / after-previous flag. 320 of the 384
            # builds in slides 1-58 are 1. Carried alongside the chunk's
            # `automatic` because the two disagree and neither alone
            # predicts the footage — see KeyBuildChunk's header.
            "eventTrigger": attrs.get("eventTrigger"),
        }
        if anim.get("direction") is not None:
            rec["direction"] = anim["direction"]
        out.append(rec)
    return out


def build_chunks_of(slide, slide_archive):
    """The CLICK grouping — how the builds fire, and when.

    A `KN.BuildChunkArchive` is what one click advances, in click order,
    and it is where the real timing lives: the build's own `duration` is
    often 0.0 while its chunk carries 1.0, and `automatic: false` is the
    click-advance the recon measured (every one of the deck's builds
    advances on click; nothing is auto-timed).

    This is what turns the recon's "413 declared builds compress to 141
    visible events" from an observation into a readable structure —
    several builds share a chunk and fire together. P-3 owns the
    interpretation; the importer's job is to stop throwing it away.
    """
    out = []
    for ref in slide_archive.get("buildChunks") or []:
        obj = slide.get(ref["identifier"])
        if not obj or obj.get("_pbtype") != "KN.BuildChunkArchive":
            continue
        build = obj.get("build") or {}
        out.append(
            {
                "build": build.get("identifier", ""),
                "duration": obj.get("duration", 0.0),
                "delay": obj.get("delay", 0.0),
                "automatic": bool(obj.get("automatic", False)),
                "chunkId": (obj.get("buildChunkIdentifier") or {}).get("buildChunkId", 0),
            }
        )
    return out


def transition_of(slide_archive):
    t = slide_archive.get("transition")
    if not isinstance(t, dict):
        return None
    attrs = t.get("attributes") or {}
    anim = attrs.get("animationAttributes") or {}
    return {
        "effect": anim.get("effect", "none"),
        "duration": anim.get("duration", 0.0),
        "delay": anim.get("delay", 0.0),
        "timingCurve": attrs.get("customTimingCurveType"),
        "fadeUnmatched": attrs.get("customMagicMoveFadeUnmatchedObjects"),
    }


def main():
    if len(sys.argv) < 3:
        print("usage: keydecode.py <unpacked .key dir> <out.json> [maxSlides]", file=sys.stderr)
        return 1
    key_dir, out_path = sys.argv[1], sys.argv[2]
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    index_dir = os.path.join(key_dir, "Index")

    document = load(os.path.join(index_dir, "Document.iwa"))
    doc_styles = load(os.path.join(index_dir, "DocumentStylesheet.iwa"))

    # The show's slide order — the deck's stored order, which the recon
    # proved tiles the whole runtime monotonically.
    show = next(o for o in document.values() if o.get("_pbtype") == "KN.ShowArchive")
    node_ids = [s["identifier"] for s in show["slideTree"]["slides"]]
    # KN.SlideNodeArchive -> the KN.SlideArchive it holds.
    slide_ids = []
    for nid in node_ids:
        node = document.get(nid) or {}
        ref = node.get("slide") or {}
        if ref.get("identifier"):
            slide_ids.append(ref["identifier"])

    # slide id -> its .iwa file. Most are `Slide-<id>.iwa`, but ONE slide
    # in this deck (18, id 4593439) lives in an unsuffixed `Slide.iwa` —
    # Keynote's own naming, not a corruption — so the map is built by
    # opening every candidate rather than by parsing the filename.
    files = {}
    for name in sorted(os.listdir(index_dir)):
        if not (name == "Slide.iwa" or (name.startswith("Slide-") and name.endswith(".iwa"))):
            continue
        path = os.path.join(index_dir, name)
        if name != "Slide.iwa":
            files.setdefault(name[len("Slide-"):-len(".iwa")], path)
            continue
        for ident, obj in load(path).items():
            if obj.get("_pbtype") == "KN.SlideArchive":
                files.setdefault(ident, path)

    slides = []
    # Per the canon policy (DECISIONS 2026-09-07) only slides 1-58 are in
    # the video; 59-83 are later additions and out of scope.
    wanted = slide_ids[: limit or 58]
    for i, sid in enumerate(wanted, start=1):
        path = files.get(sid)
        if not path:
            print(f"  slide {i}: no archive for {sid}", file=sys.stderr)
            continue
        slide = load(path)
        archive = slide.get(sid)
        if archive is None:
            archive = next(
                (o for o in slide.values() if o.get("_pbtype") == "KN.SlideArchive"), {}
            )
        drawables, groups, skipped = [], [], []
        z = archive.get("drawablesZOrder") or archive.get("ownedDrawables") or []
        for ref in z:
            walk(ref["identifier"], slide, doc_styles, drawables, groups, skipped, len(drawables))
        slides.append(
            {
                "index": i,
                "id": sid,
                "source": f"refs/pitch/pl02/key/Index/Slide-{sid}.iwa",
                "hash": sha16(path),
                "drawables": drawables,
                "groups": groups,
                "builds": builds_of(slide, archive),
                "buildChunks": build_chunks_of(slide, archive),
                "transition": transition_of(archive),
                "skipped": sorted(set(skipped)),
            }
        )
        shapes = sum(1 for d in drawables if d["kind"] == "shape")
        texts = sum(1 for d in drawables if d["kind"] == "text")
        print(
            f"  slide {i:2d} {sid}  {shapes:4d} shapes  {texts:2d} texts"
            f"  {len(groups):3d} groups  {len(slides[-1]['builds']):3d} builds"
            + (f"  skipped: {','.join(slides[-1]['skipped'])}" if skipped else ""),
            file=sys.stderr,
        )

    with open(out_path, "w") as f:
        json.dump({"slides": slides}, f, indent=1, sort_keys=False)
    print(f"\n{len(slides)} slides -> {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
