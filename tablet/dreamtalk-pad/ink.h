/*
 * ink.h — the pure part of dreamtalk-pad: rasterising strokes and fills into
 * an RGB565 page, tracking dirty rectangles, and parsing the display list.
 * No sockets, no shared memory: it builds and is tested on the Mac.
 */
#ifndef DREAMTALK_INK_H
#define DREAMTALK_INK_H

#include <stddef.h>
#include <stdint.h>

#define INK_WHITE 0xFFFF
#define INK_BLACK 0x0000

/* Half-open pixel rectangle [x0, x1) x [y0, y1). Empty when x0 >= x1 or y0 >= y1. */
typedef struct {
    int x0, y0, x1, y1;
} ink_rect;

/*
 * A page. `clip`, when not empty, limits every drawing call to that
 * rectangle — how a region is repainted from the display list without
 * touching its neighbours. Zero-initialised (empty) means the whole page.
 */
typedef struct {
    uint16_t *px; /* RGB565, row-major, stride == w */
    int w, h;
    ink_rect clip;
} ink_canvas;

ink_rect ink_rect_empty(void);
int ink_rect_is_empty(ink_rect r);
ink_rect ink_rect_union(ink_rect a, ink_rect b);
ink_rect ink_rect_intersect(ink_rect a, ink_rect b);
int ink_rect_overlaps(ink_rect a, ink_rect b);
ink_rect ink_rect_clip(ink_rect r, int w, int h);
/* r grown by d on every side. */
ink_rect ink_rect_grow(ink_rect r, int d);

uint16_t ink_rgb565_from_grey(uint8_t g);
uint8_t ink_grey_from_rgb565(uint16_t c);

/* Fill r (clipped) with one colour; returns the clipped rect. */
ink_rect ink_fill(ink_canvas *c, ink_rect r, uint16_t color);

/*
 * Draw a round-capped segment from (x0,y0) to (x1,y1) whose radius goes from
 * r0 to r1 (a zero-length segment is a dot), in grey level `grey` (0 black).
 * Ink only darkens: each pixel keeps the darker of what was there and the
 * new ink.
 *   aa = 0: hard edges, for the pen waveform (the trail and the lasso).
 *   aa = 1: anti-aliased edges, for settled content.
 * Returns the tight bounding rect of the pixels that changed (empty if none).
 */
ink_rect ink_segment_grey(ink_canvas *c, float x0, float y0, float r0, float x1, float y1, float r1, uint8_t grey, int aa);
/* ink_segment_grey in black. */
ink_rect ink_segment(ink_canvas *c, float x0, float y0, float r0, float x1, float y1, float r1, int aa);

/*
 * A polyline through n points (x,y pairs). Widths are per point (`w`, n
 * values) or one for all (`w` NULL, `wconst`). dash_on > 0 draws it dashed:
 * on/off lengths along the line. One point is a dot. Returns the dirty rect.
 */
ink_rect ink_polyline(ink_canvas *c, const float *pts, int n, const float *w, float wconst, uint8_t grey,
                      float dash_on, float dash_off, int aa);

/* Fill a polygon (n points, even-odd rule) with grey — painted, not darkened. */
ink_rect ink_polygon(ink_canvas *c, const float *pts, int n, uint8_t grey);

/* Pen pressure (qtfb's d, 0..100) to a radius between wmin/2 and wmax/2. */
float ink_pressure_radius(int d, float wmin, float wmax);

/*
 * The page's own nib (core/sketch/mirror.ts `inkWidth`): width in page units
 * for a pressure 0..1, where 0 (no reading) counts as 0.5. The local trail
 * uses it so the page's copy of the stroke lands on the same pixels.
 */
float ink_page_width(float pressure);

/* ---- display list: one JSON op per line (core/sketch/protocol.ts) ---- */

enum { DL_PUT = 1, DL_DEL = 2, DL_CLEAR = 3, DL_FLUSH = 4 };
enum { DLP_LINE = 1, DLP_FILL = 2 };
enum { DL_LIVE = 1, DL_NOINK = 2, DL_GRAB = 4 };

#define DL_ID_MAX 64

/* One primitive. Its numbers live in the op's `nums` pool. */
typedef struct {
    int kind;      /* DLP_LINE | DLP_FILL */
    uint8_t grey;  /* 0 black .. 255 white */
    int npts;      /* points (x,y pairs) */
    int pts;       /* offset of the first x in nums */
    int w;         /* offset of npts per-point widths in nums, or -1 */
    float wconst;  /* the width when w < 0 */
    float dash_on, dash_off; /* dash_on <= 0: solid */
} dl_prim;

typedef struct {
    int kind;           /* DL_PUT | DL_DEL | DL_CLEAR | DL_FLUSH */
    char id[DL_ID_MAX]; /* empty if absent; truncated if longer */
    float z;
    int flags;          /* DL_LIVE | DL_NOINK | DL_GRAB */
    dl_prim *prims;
    int nprims;
    float *nums;
    int nnums;
} dl_op;

/*
 * Parse one line, e.g.
 *   {"op":"put","id":"ink:a","z":20,"prims":[{"k":"line","pts":[10,20,30,40],"w":[3,4]}]}
 *   {"op":"put","id":"chrome:chip","z":40,"noInk":true,"prims":[{"k":"fill","pts":[…],"grey":255}]}
 *   {"op":"del","id":"ink:a"}   {"op":"clear"}   {"op":"flush"}
 * Keys may come in any order; unknown keys are skipped. The caller provides
 * the pools: at most maxprims primitives and maxnums numbers. Returns 0 on
 * success, -1 on malformed JSON or an unknown op, -2 if the pools were too
 * small.
 */
int dl_parse(const char *line, size_t len, dl_op *out, dl_prim *prims, int maxprims, float *nums, int maxnums);

/* The bounding rect of an op's primitives, widths included, plus an AA pixel. */
ink_rect dl_bounds(const dl_prim *prims, int nprims, const float *nums);

/* Draw one primitive (lines anti-aliased, fills painted). */
ink_rect dl_draw(ink_canvas *c, const dl_prim *p, const float *nums);

#endif
