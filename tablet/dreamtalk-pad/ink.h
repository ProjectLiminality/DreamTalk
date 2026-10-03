/*
 * ink.h — the pure part of dreamtalk-pad: rasterising strokes into an
 * RGB565 page, tracking dirty rectangles, and parsing display-list lines.
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

typedef struct {
    uint16_t *px; /* RGB565, row-major, stride == w */
    int w, h;
} ink_canvas;

ink_rect ink_rect_empty(void);
int ink_rect_is_empty(ink_rect r);
ink_rect ink_rect_union(ink_rect a, ink_rect b);
ink_rect ink_rect_clip(ink_rect r, int w, int h);

uint16_t ink_rgb565_from_grey(uint8_t g);
uint8_t ink_grey_from_rgb565(uint16_t c);

/* Fill r (clipped) with one colour; returns the clipped rect. */
ink_rect ink_fill(ink_canvas *c, ink_rect r, uint16_t color);

/*
 * Draw a round-capped segment from (x0,y0) to (x1,y1) whose radius goes from
 * r0 to r1 (a zero-length segment is a dot). Ink only darkens: each pixel
 * keeps the darker of what was there and the new ink.
 *   aa = 0: 1-bit black, for the pen waveform (the trail and the lasso).
 *   aa = 1: anti-aliased grey edges, for settled symbols.
 * Returns the tight bounding rect of the pixels that changed (empty if none).
 */
ink_rect ink_segment(ink_canvas *c, float x0, float y0, float r0, float x1, float y1, float r1, int aa);

/* Pen pressure (qtfb's d, 0..100) to a radius between wmin/2 and wmax/2. */
float ink_pressure_radius(int d, float wmin, float wmax);

/* ---- display list: one newline-delimited JSON object per command ---- */

enum { DL_DRAW = 1, DL_CLEAR = 2, DL_REMOVE = 3 };

#define DL_ID_MAX 64

typedef struct {
    int kind;
    char id[DL_ID_MAX]; /* empty if absent; truncated if longer */
    float width;        /* page units (= rM2 pixels); <= 0 if absent */
    float *pts;         /* x,y pairs, filled from the caller's buffer */
    int npts;           /* number of points (pairs) */
} dl_cmd;

/*
 * Parse one line, e.g.
 *   {"kind":"draw","id":"s1","points":[[10,20],[30,40]],"width":3}
 *   {"kind":"clear"}
 *   {"kind":"remove","id":"s1"}
 * Keys may come in any order; unknown keys are skipped. "points" may be
 * nested pairs or one flat [x,y,x,y,...] list. pts receives at most maxpts
 * points. Returns 0 on success, -1 on malformed JSON or an unknown kind,
 * -2 if the points did not fit.
 */
int dl_parse(const char *line, size_t len, dl_cmd *out, float *pts, int maxpts);

#endif
