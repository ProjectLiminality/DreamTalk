"""Experiment A: pin the Sketch & Toon draw scheduler.

Six straight-line splines of very different lengths, pydeation's exact Sketch
material settings, sketch_speed="pixels" (STROKE_SPEED_TYPE=0) with a fixed
draw_speed. Render at 5 fps. Each spline occupies its own horizontal band of
the frame, so per-stroke inked arc is trivially segmented by y-region.

Renders three variants:
  A0: stroke_method=0 (single), stroke_order=0 (long_short)
  A1: stroke_method=1 (all),    stroke_order=0 (long_short)
  A2: stroke_method=0 (single), stroke_order=7-ish document order

See docs/reports/stroke-connection.md §2.6 for what this decides: the frames
prove S&T draws many strokes concurrently on a global px/s budget, but the
scheduling law itself is unpinned (best fitted family scored 0.27).

NOT YET RUN. Blocked 2026-09-07 on `Error: License Expired` from c4dpy — see
stroke-connection.md §6. Run under a licensed c4dpy:

    c4dpy c4d-expA-scheduler.py <outdir>
"""
import c4d
import c4d.documents as c4doc
import os
import sys
import math

PI = math.pi

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/expA"

XRES, YRES = 640, 360
FPS = 5
NFRAMES = 30            # 6 seconds at 5fps
DRAW_SPEED = 1000.0     # px/s in the material's pixel units

# Lengths in *world units*. Camera is an ortho (parallel) 2D camera at zoom 1.
# pydeation's TwoDCamera: CAMERA_PROJECTION=6 (front/parallel), zoom=1.
# Scene00's documented framing: 1.25122 px per world unit at 1280 wide.
# We render at 640 so px/unit halves -> but the Sketch pixel-unit basis is
# pinned to 1280x700 by OUTLINEMAT_PIXELUNITS_BASEW/H, exactly as pydeation
# does, so stroke pixel lengths are resolution-independent.
LENGTHS_PX = [2000.0, 1000.0, 500.0, 250.0, 125.0, 62.0]

PX_PER_UNIT = 1.25122   # matches the Scene00 framing used in the report


def log(*a):
    print(*a)
    sys.stdout.flush()


def make_line(length_units, y_units, name):
    """A 2-point straight spline, horizontal, centred at x=0, at height y."""
    sp = c4d.SplineObject(2, c4d.SPLINETYPE_LINEAR)
    sp.SetName(name)
    half = length_units / 2.0
    sp.SetPoint(0, c4d.Vector(-half, y_units, 0))
    sp.SetPoint(1, c4d.Vector(half, y_units, 0))
    sp.Message(c4d.MSG_UPDATE)
    return sp


def apply_sketch_material(doc, mat, tag, stroke_order, stroke_method,
                          draw_speed):
    """pydeation set_sketch_mat, verbatim on the parameters that matter."""
    mat[c4d.OUTLINEMAT_COLOR] = c4d.Vector(1, 1, 1)
    mat[c4d.OUTLINEMAT_THICKNESS] = 5.0
    mat[c4d.OUTLINEMAT_ANIMATE_AUTODRAW] = True
    # sketch_speed: pydeation sets TYPE=2 (completion) at construction; the
    # animator flips it to 0 ("pixels") when draw_speed is used.
    mat[c4d.OUTLINEMAT_ANIMATE_STROKE_SPEED_TYPE] = 0     # pixels
    mat[c4d.OUTLINEMAT_ANIMATE_STROKE_SPEED] = draw_speed
    mat[c4d.OUTLINEMAT_ANIMATE_STROKE_SPEED_COMPLETE] = 0
    mat[c4d.OUTLINEMAT_ANIMATE_STROKE_MODE] = 0           # draw
    mat[c4d.OUTLINEMAT_ANIMATE_STROKES] = stroke_order
    mat[c4d.OUTLINEMAT_ANIMATE_STROKE_METHOD] = stroke_method
    mat[c4d.OUTLINEMAT_ANIMATE_START] = c4d.BaseTime(0)
    mat[c4d.OUTLINEMAT_FILTER_STROKES] = False
    mat[c4d.OUTLINEMAT_OPACITY] = 1.0
    mat[c4d.OUTLINEMAT_ADV_SELFBLENDMODE] = 1
    mat[c4d.OUTLINEMAT_CONNECTIIONZ] = 3
    mat[c4d.OUTLINEMAT_JOIN_ANGLE_LIMIT] = PI
    mat[c4d.OUTLINEMAT_CLOSECONNECTION] = True
    mat[c4d.OUTLINEMAT_THICKNESS_DISTANCE] = True
    mat[c4d.OUTLINEMAT_THICKNESS_DISTANCE_STRENGTH] = 0.6
    mat[c4d.OUTLINEMAT_THICKNESS_DISTANCE_RANGE] = 1
    mat[c4d.OUTLINEMAT_PATTERN] = 1
    mat[c4d.OUTLINEMAT_PATTERN_PRESET] = 0
    mat[c4d.OUTLINEMAT_ADJUSTMENT_STROKE_RESIZE] = True
    mat[c4d.OUTLINEMAT_ADJUSTMENT_STROKESTART] = 0
    mat[c4d.OUTLINEMAT_ADJUSTMENT_STROKEEND] = 1
    mat[c4d.OUTLINEMAT_LINE_RENDERCLIP] = 0
    mat[c4d.OUTLINEMAT_STOKECLIP_TOSCREEN] = False
    mat.Update(True, True)

    tag[c4d.OUTLINEMAT_LINE_DEFAULT_MAT_V] = mat
    tag[c4d.OUTLINEMAT_LINE_DEFAULT_MAT_H] = mat
    tag[c4d.OUTLINEMAT_LINE_INTERSECTION] = False
    tag[c4d.OUTLINEMAT_LINE_INTERESTION_OBJS] = 3
    tag[c4d.OUTLINEMAT_LINE_FOLD] = True
    tag[c4d.OUTLINEMAT_LINE_CREASE] = True
    tag[c4d.OUTLINEMAT_LINE_BORDER] = True
    tag[c4d.OUTLINEMAT_LINE_SPLINES] = True


def build(stroke_order, stroke_method, draw_speed=DRAW_SPEED):
    doc = c4d.documents.BaseDocument()
    doc[c4d.DOCUMENT_FPS] = FPS

    rd = doc.GetActiveRenderData()
    sketch_vp = c4doc.BaseVideoPost(1011015)   # VPsketch
    rd.InsertVideoPost(sketch_vp)
    sketch_vp[c4d.OUTLINEMAT_SHADING_BACK_COL] = c4d.Vector(0, 0, 0)
    sketch_vp[c4d.OUTLINEMAT_SHADING_OBJECT] = False
    sketch_vp[c4d.OUTLINEMAT_PIXELUNITS_INDEPENDENT] = True
    sketch_vp[c4d.OUTLINEMAT_PIXELUNITS_INDEPENDENT_MODE] = 1
    sketch_vp[c4d.OUTLINEMAT_PIXELUNITS_BASEW] = 1280
    sketch_vp[c4d.OUTLINEMAT_PIXELUNITS_BASEH] = 700
    sketch_vp[c4d.OUTLINEMAT_EDLINES_LINE_DRAW] = 1
    sketch_vp[c4d.OUTLINEMAT_EDLINES_SHOWLINES] = True
    sketch_vp[c4d.OUTLINEMAT_EDLINES_REDRAW_FULL] = True
    sketch_vp[c4d.OUTLINEMAT_LINE_SPLINES] = True

    rd[c4d.RDATA_XRES] = XRES
    rd[c4d.RDATA_YRES] = YRES
    rd[c4d.RDATA_FRAMERATE] = FPS
    rd[c4d.RDATA_FRAMESEQUENCE] = 3
    rd[c4d.RDATA_RENDERENGINE] = 0    # Standard
    rd[c4d.RDATA_ANTIALIASING] = 0    # none, keeps ink measurement clean

    # camera: pydeation TwoDCamera (parallel projection), looking down -Z
    cam = c4d.CameraObject()
    cam[c4d.CAMERA_PROJECTION] = 0        # perspective? -> use parallel below
    cam[c4d.CAMERA_PROJECTION] = 4        # parallel (front)
    cam[c4d.CAMERA_ZOOM] = 1.0
    cam[c4d.ID_BASEOBJECT_REL_POSITION, c4d.VECTOR_Z] = -1000
    doc.InsertObject(cam)
    bd = doc.GetActiveBaseDraw()
    if bd:
        bd.SetSceneCamera(cam)

    mat = c4d.BaseMaterial(1011014)   # Msketch
    doc.InsertMaterial(mat)

    # single sketch tag on a null parent holding all six splines, so all six
    # are one Sketch stroke set - exactly like one object with many subpaths.
    root = c4d.BaseObject(c4d.Onull)
    root.SetName("root")
    doc.InsertObject(root)
    tag = root.MakeTag(1011012)       # Tsketch
    apply_sketch_material(doc, mat, tag, stroke_order, stroke_method,
                          draw_speed)

    spacing_units = 40.0
    y0 = spacing_units * (len(LENGTHS_PX) - 1) / 2.0
    for i, Lpx in enumerate(LENGTHS_PX):
        Lu = Lpx / PX_PER_UNIT
        y = y0 - i * spacing_units
        sp = make_line(Lu, y, "sp%d_%dpx" % (i, int(Lpx)))
        sp.InsertUnder(root)

    doc.SetTime(c4d.BaseTime(0, FPS))
    doc.ExecutePasses(None, True, True, True, c4d.BUILDFLAGS_NONE)
    return doc, rd, mat


def render_frames(doc, rd, outdir, nframes):
    os.makedirs(outdir, exist_ok=True)
    rdata = rd.GetData()
    for f in range(nframes):
        t = c4d.BaseTime(f, FPS)
        doc.SetTime(t)
        doc.ExecutePasses(None, True, True, True, c4d.BUILDFLAGS_NONE)
        rdata[c4d.RDATA_FRAMEFROM] = t
        rdata[c4d.RDATA_FRAMETO] = t
        rdata[c4d.RDATA_FRAMESEQUENCE] = 0   # manual
        bmp = c4d.bitmaps.BaseBitmap()
        bmp.Init(XRES, YRES, 32)
        res = c4d.documents.RenderDocument(
            doc, rdata, bmp, c4d.RENDERFLAGS_EXTERNAL)
        path = os.path.join(outdir, "f%03d.png" % f)
        bmp.Save(path, c4d.FILTER_PNG, c4d.BaseContainer(),
                 c4d.SAVEBIT_NONE)
        log("  frame %d -> %s (res=%s)" % (f, path, res))


def main():
    variants = [
        ("A0_single_longshort", 0, 0),
        ("A1_all_longshort",    0, 1),
        ("A2_single_document",  7, 0),   # 7 may be out of range; probed below
    ]
    for name, order, method in variants:
        log("=== variant %s (order=%d method=%d)" % (name, order, method))
        try:
            doc, rd, mat = build(order, method)
            log("   actual order in mat:",
                mat[c4d.OUTLINEMAT_ANIMATE_STROKES],
                "method:", mat[c4d.OUTLINEMAT_ANIMATE_STROKE_METHOD],
                "speedtype:", mat[c4d.OUTLINEMAT_ANIMATE_STROKE_SPEED_TYPE],
                "speed:", mat[c4d.OUTLINEMAT_ANIMATE_STROKE_SPEED])
            render_frames(doc, rd, os.path.join(OUT, name), NFRAMES)
        except Exception as e:
            import traceback
            log("   FAILED:", e)
            traceback.print_exc()
            sys.stdout.flush()


main()
log("DONE")
