"""Experiment B: pin the cylinder cap-arc draw ORDER under `bottom_top`.

See docs/reports/stroke-connection.md §3.3 for why this is the open question:
the near cap is split at the silhouette generators into a camera-facing arc
and an away-facing arc, and which one inks first flips between S01 (pitch 0.4,
away-facing first) and S06 (pitch pi/2, camera-facing first). Arc length is a
proven non-explanation (§3.1). This sweeps pitch to find the flip point, or to
show there isn't one and the real key is something else.

One cylinder r=100 h=200, pydeation's exact Sketch settings,
stroke_order="bottom_top" (ANIMATE_STROKES = 3), pitch swept 0.1 -> pi/2 in
ten steps. Renders the early frames of each draw; the first cap arc to receive
ink is read off them.

NOT YET RUN. Blocked 2026-09-07 on `Error: License Expired` from c4dpy — see
stroke-connection.md §6. Run under a licensed c4dpy:

    c4dpy c4d-expB-cylinder.py <outdir>

Shares its material/videopost setup with c4d-expA-scheduler.py; the two files
are kept standalone rather than sharing an import, so either can be run alone.
"""
import c4d
import c4d.documents as c4doc
import os
import sys
import math

PI = math.pi

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/expB"

XRES, YRES = 640, 360
FPS = 5
NFRAMES = 12            # early frames are what matter; the flip shows at once
DRAW_SPEED = 1000.0     # px/s

RADIUS = 100.0
HEIGHT = 200.0

# pitch sweep: S01 sits at 0.4, S06 at pi/2. Ten steps spanning both.
PITCHES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 0.9, 1.1, 1.4, PI / 2]

CAM_DIST = 1000.0


def log(*a):
    print(*a)
    sys.stdout.flush()


def apply_sketch_material(mat, tag, stroke_order, stroke_method, draw_speed):
    """pydeation set_sketch_mat (object.py:176-230), on the params that matter."""
    mat[c4d.OUTLINEMAT_COLOR] = c4d.Vector(1, 1, 1)
    mat[c4d.OUTLINEMAT_THICKNESS] = 5.0
    mat[c4d.OUTLINEMAT_ANIMATE_AUTODRAW] = True
    mat[c4d.OUTLINEMAT_ANIMATE_STROKE_SPEED_TYPE] = 0      # "pixels"
    mat[c4d.OUTLINEMAT_ANIMATE_STROKE_SPEED] = draw_speed
    mat[c4d.OUTLINEMAT_ANIMATE_STROKE_SPEED_COMPLETE] = 0
    mat[c4d.OUTLINEMAT_ANIMATE_STROKE_MODE] = 0            # draw
    mat[c4d.OUTLINEMAT_ANIMATE_STROKES] = stroke_order     # 3 = bottom_top
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


def build(pitch):
    doc = c4d.documents.BaseDocument()
    doc[c4d.DOCUMENT_FPS] = FPS

    rd = doc.GetActiveRenderData()
    sketch_vp = c4doc.BaseVideoPost(1011015)      # VPsketch
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
    rd[c4d.RDATA_RENDERENGINE] = 0     # Standard, required for Sketch & Toon
    rd[c4d.RDATA_ANTIALIASING] = 0

    cyl = c4d.BaseObject(c4d.Ocylinder)
    cyl.SetName("cylinder")
    cyl[c4d.PRIM_CYLINDER_RADIUS] = RADIUS
    cyl[c4d.PRIM_CYLINDER_HEIGHT] = HEIGHT
    cyl[c4d.PRIM_AXIS] = 1             # +Y
    # `pitch` here is the cap-normal elevation relative to the camera ray:
    # rotate the cylinder about X so the cap turns from edge-on to face-on.
    cyl[c4d.ID_BASEOBJECT_REL_ROTATION, c4d.VECTOR_X] = pitch
    doc.InsertObject(cyl)

    cam = c4d.CameraObject()
    cam[c4d.CAMERA_PROJECTION] = 0     # perspective, as the pitch scenes use
    cam[c4d.ID_BASEOBJECT_REL_POSITION, c4d.VECTOR_Z] = -CAM_DIST
    doc.InsertObject(cam)
    bd = doc.GetActiveBaseDraw()
    if bd:
        bd.SetSceneCamera(cam)

    mat = c4d.BaseMaterial(1011014)    # Msketch
    doc.InsertMaterial(mat)
    tag = cyl.MakeTag(1011012)         # Tsketch
    apply_sketch_material(mat, tag, 3, 0, DRAW_SPEED)   # bottom_top, single

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
        rdata[c4d.RDATA_FRAMESEQUENCE] = 0     # manual / single frame
        bmp = c4d.bitmaps.BaseBitmap()
        bmp.Init(XRES, YRES, 32)
        res = c4d.documents.RenderDocument(
            doc, rdata, bmp, c4d.RENDERFLAGS_EXTERNAL)
        path = os.path.join(outdir, "f%03d.png" % f)
        bmp.Save(path, c4d.FILTER_PNG, c4d.BaseContainer(), c4d.SAVEBIT_NONE)
        log("  frame %d -> %s (res=%s)" % (f, path, res))


def main():
    for pitch in PITCHES:
        name = "pitch_%.3f" % pitch
        log("=== %s (%.1f deg)" % (name, math.degrees(pitch)))
        try:
            doc, rd, mat = build(pitch)
            render_frames(doc, rd, os.path.join(OUT, name), NFRAMES)
        except Exception:
            import traceback
            traceback.print_exc()
            sys.stdout.flush()


main()
log("DONE")
