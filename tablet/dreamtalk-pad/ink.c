/* ink.c — see ink.h. Pure C99 + libm; no I/O. */
#include "ink.h"

#include <math.h>
#include <stdlib.h>
#include <string.h>

/* ---- rectangles ---- */

ink_rect ink_rect_empty(void) {
    ink_rect r = {0, 0, 0, 0};
    return r;
}

int ink_rect_is_empty(ink_rect r) { return r.x0 >= r.x1 || r.y0 >= r.y1; }

static int imin(int a, int b) { return a < b ? a : b; }
static int imax(int a, int b) { return a > b ? a : b; }

ink_rect ink_rect_union(ink_rect a, ink_rect b) {
    if (ink_rect_is_empty(a)) return b;
    if (ink_rect_is_empty(b)) return a;
    ink_rect r = {imin(a.x0, b.x0), imin(a.y0, b.y0), imax(a.x1, b.x1), imax(a.y1, b.y1)};
    return r;
}

ink_rect ink_rect_intersect(ink_rect a, ink_rect b) {
    ink_rect r = {imax(a.x0, b.x0), imax(a.y0, b.y0), imin(a.x1, b.x1), imin(a.y1, b.y1)};
    return ink_rect_is_empty(r) ? ink_rect_empty() : r;
}

int ink_rect_overlaps(ink_rect a, ink_rect b) { return !ink_rect_is_empty(ink_rect_intersect(a, b)); }

ink_rect ink_rect_clip(ink_rect r, int w, int h) {
    ink_rect c = {imax(r.x0, 0), imax(r.y0, 0), imin(r.x1, w), imin(r.y1, h)};
    return ink_rect_is_empty(c) ? ink_rect_empty() : c;
}

ink_rect ink_rect_grow(ink_rect r, int d) {
    if (ink_rect_is_empty(r)) return r;
    ink_rect g = {r.x0 - d, r.y0 - d, r.x1 + d, r.y1 + d};
    return g;
}

/* Where drawing may land: the clip if one is set, always within the page. */
static ink_rect drawable(const ink_canvas *c) {
    ink_rect page = {0, 0, c->w, c->h};
    return ink_rect_is_empty(c->clip) ? page : ink_rect_intersect(c->clip, page);
}

/* ---- colour ---- */

uint16_t ink_rgb565_from_grey(uint8_t g) {
    return (uint16_t)(((g >> 3) << 11) | ((g >> 2) << 5) | (g >> 3));
}

/* Green has the most bits; it is what xochitl's greyscale conversion leans on too. */
uint8_t ink_grey_from_rgb565(uint16_t c) {
    unsigned g6 = (c >> 5) & 0x3F;
    return (uint8_t)((g6 << 2) | (g6 >> 4));
}

ink_rect ink_fill(ink_canvas *c, ink_rect r, uint16_t color) {
    r = ink_rect_intersect(r, drawable(c));
    for (int y = r.y0; y < r.y1; y++) {
        uint16_t *row = c->px + (size_t)y * c->w;
        for (int x = r.x0; x < r.x1; x++) row[x] = color;
    }
    return r;
}

/* ---- strokes ---- */

ink_rect ink_segment_grey(ink_canvas *c, float x0, float y0, float r0, float x1, float y1, float r1, uint8_t grey, int aa) {
    /* A hard-edged line thinner than a pixel would break up; keep it at least one pixel wide. */
    if (!aa) {
        if (r0 < 0.5f) r0 = 0.5f;
        if (r1 < 0.5f) r1 = 0.5f;
    }
    if (!(r0 > 0.0f) && !(r1 > 0.0f)) return ink_rect_empty();
    if (!isfinite(x0) || !isfinite(y0) || !isfinite(x1) || !isfinite(y1)) return ink_rect_empty();

    ink_rect area = drawable(c);
    float rmax = r0 > r1 ? r0 : r1;
    float pad = rmax + 1.0f;
    float fx0 = fminf(x0, x1) - pad, fx1 = fmaxf(x0, x1) + pad;
    float fy0 = fminf(y0, y1) - pad, fy1 = fmaxf(y0, y1) + pad;
    /* Clip in float first so huge coordinates can't overflow int. */
    if (fx1 < area.x0 || fy1 < area.y0 || fx0 > area.x1 || fy0 > area.y1) return ink_rect_empty();
    ink_rect box = {(int)floorf(fmaxf(fx0, (float)area.x0)), (int)floorf(fmaxf(fy0, (float)area.y0)),
                    (int)ceilf(fminf(fx1, (float)area.x1)), (int)ceilf(fminf(fy1, (float)area.y1))};
    box = ink_rect_intersect(box, area);

    float dx = x1 - x0, dy = y1 - y0;
    float len2 = dx * dx + dy * dy;
    ink_rect dirty = ink_rect_empty();
    int first = 1;
    float span = 255.0f - (float)grey;

    for (int y = box.y0; y < box.y1; y++) {
        float py = (float)y + 0.5f;
        uint16_t *row = c->px + (size_t)y * c->w;
        for (int x = box.x0; x < box.x1; x++) {
            float px = (float)x + 0.5f;
            float t = len2 > 0.0f ? ((px - x0) * dx + (py - y0) * dy) / len2 : 0.0f;
            if (t < 0.0f) t = 0.0f;
            if (t > 1.0f) t = 1.0f;
            float ex = x0 + t * dx - px, ey = y0 + t * dy - py;
            float d = sqrtf(ex * ex + ey * ey);
            float r = r0 + (r1 - r0) * t;

            uint8_t g;
            if (aa) {
                float cov = r + 0.5f - d;
                if (cov <= 0.0f) continue;
                if (cov > 1.0f) cov = 1.0f;
                g = (uint8_t)(255.0f - span * cov + 0.5f);
            } else {
                if (d > r) continue;
                g = grey;
            }
            if (g >= ink_grey_from_rgb565(row[x])) continue; /* ink only darkens */
            row[x] = ink_rgb565_from_grey(g);

            if (first) {
                dirty.x0 = x, dirty.y0 = y, dirty.x1 = x + 1, dirty.y1 = y + 1;
                first = 0;
            } else {
                if (x < dirty.x0) dirty.x0 = x;
                if (x + 1 > dirty.x1) dirty.x1 = x + 1;
                dirty.y1 = y + 1; /* rows are visited in order */
            }
        }
    }
    return dirty;
}

ink_rect ink_segment(ink_canvas *c, float x0, float y0, float r0, float x1, float y1, float r1, int aa) {
    return ink_segment_grey(c, x0, y0, r0, x1, y1, r1, 0, aa);
}

ink_rect ink_polyline(ink_canvas *c, const float *pts, int n, const float *w, float wconst, uint8_t grey,
                      float dash_on, float dash_off, int aa) {
#define RAD(i) (0.5f * (w ? w[i] : wconst))
    ink_rect d = ink_rect_empty();
    if (n <= 0) return d;
    if (n == 1) return ink_segment_grey(c, pts[0], pts[1], RAD(0), pts[0], pts[1], RAD(0), grey, aa);
    int dashed = dash_on > 0.0f && dash_off > 0.0f;
    float phase = 0.0f; /* distance into the current on+off period */
    for (int k = 1; k < n; k++) {
        float ax = pts[2 * k - 2], ay = pts[2 * k - 1], bx = pts[2 * k], by = pts[2 * k + 1];
        float ra = RAD(k - 1), rb = RAD(k);
        if (!dashed) {
            d = ink_rect_union(d, ink_segment_grey(c, ax, ay, ra, bx, by, rb, grey, aa));
            continue;
        }
        float len = hypotf(bx - ax, by - ay);
        float s = 0.0f;
        while (s < len) {
            float period = dash_on + dash_off;
            float left = (phase < dash_on ? dash_on : period) - phase;
            /* Always advance (float rounding near a dash boundary could make
             * `left` vanish and spin this loop forever). */
            float e = fminf(len, s + fmaxf(left, 0.05f));
            if (phase < dash_on && len > 0.0f) {
                float u0 = s / len, u1 = e / len;
                d = ink_rect_union(d, ink_segment_grey(c, ax + (bx - ax) * u0, ay + (by - ay) * u0, ra + (rb - ra) * u0,
                                                       ax + (bx - ax) * u1, ay + (by - ay) * u1, ra + (rb - ra) * u1, grey, aa));
            }
            phase += e - s;
            if (phase >= period - 1e-4f) phase = 0.0f;
            s = e;
            if (len <= 0.0f) break;
        }
    }
    return d;
#undef RAD
}

/* One crossing of a scanline: where, and which way the edge runs (+1 down, -1 up). */
typedef struct {
    float x;
    int dir;
} crossing;

static int cmp_crossing(const void *a, const void *b) {
    float x = ((const crossing *)a)->x, y = ((const crossing *)b)->x;
    return x < y ? -1 : x > y;
}

ink_rect ink_polygon(ink_canvas *c, const float *pts, int n, uint8_t grey) {
    return ink_polygon_rings(c, pts, n, NULL, 0, grey);
}

ink_rect ink_polygon_rings(ink_canvas *c, const float *pts, int n, const int *rings, int nrings, uint8_t grey) {
    if (n < 3) return ink_rect_empty();
    int one = n;
    if (!rings || nrings <= 0) rings = &one, nrings = 1;
    int total = 0;
    for (int r = 0; r < nrings; r++) {
        if (rings[r] < 0) return ink_rect_empty();
        total += rings[r];
    }
    if (total != n) return ink_rect_empty();
    float minx = pts[0], maxx = pts[0], miny = pts[1], maxy = pts[1];
    for (int i = 0; i < n; i++) {
        if (!isfinite(pts[2 * i]) || !isfinite(pts[2 * i + 1])) return ink_rect_empty();
        minx = fminf(minx, pts[2 * i]), maxx = fmaxf(maxx, pts[2 * i]);
        miny = fminf(miny, pts[2 * i + 1]), maxy = fmaxf(maxy, pts[2 * i + 1]);
    }
    ink_rect area = drawable(c);
    if (maxx < area.x0 || maxy < area.y0 || minx > area.x1 || miny > area.y1) return ink_rect_empty();
    ink_rect box = {(int)floorf(fmaxf(minx, (float)area.x0)), (int)floorf(fmaxf(miny, (float)area.y0)),
                    (int)ceilf(fminf(maxx, (float)area.x1)), (int)ceilf(fminf(maxy, (float)area.y1))};
    box = ink_rect_intersect(box, area);
    crossing stack[256];
    crossing *xs = n <= 256 ? stack : malloc(sizeof(crossing) * (size_t)n);
    if (!xs) return ink_rect_empty();
    uint16_t color = ink_rgb565_from_grey(grey);
    ink_rect dirty = ink_rect_empty();
    for (int y = box.y0; y < box.y1; y++) {
        float py = (float)y + 0.5f;
        int m = 0;
        /* every edge of every ring (each ring closes on itself) */
        for (int r = 0, base = 0; r < nrings; base += rings[r++]) {
            for (int k = 0; k < rings[r]; k++) {
                int i = base + k, j = base + (k + rings[r] - 1) % rings[r];
                float yi = pts[2 * i + 1], yj = pts[2 * j + 1];
                if ((yi > py) == (yj > py)) continue;
                xs[m].x = pts[2 * j] + (py - yj) * (pts[2 * i] - pts[2 * j]) / (yi - yj);
                xs[m++].dir = yi > yj ? 1 : -1;
            }
        }
        if (m < 2) continue;
        qsort(xs, (size_t)m, sizeof(crossing), cmp_crossing);
        uint16_t *row = c->px + (size_t)y * c->w;
        /* nonzero winding: inside wherever the running sum isn't zero —
         * the font's own rule, so a counter wound against its outside is a
         * hole and overlapping contours stay solid */
        int wind = 0;
        for (int k = 0; k + 1 < m; k++) {
            wind += xs[k].dir;
            if (!wind) continue;
            /* pixel centres inside [xs[k], xs[k+1]) */
            int xa = imax(area.x0, (int)ceilf(xs[k].x - 0.5f));
            int xb = imin(area.x1, (int)ceilf(xs[k + 1].x - 0.5f));
            if (xa >= xb) continue;
            for (int x = xa; x < xb; x++) row[x] = color;
            ink_rect span = {xa, y, xb, y + 1};
            dirty = ink_rect_union(dirty, span);
        }
    }
    if (xs != stack) free(xs);
    return dirty;
}

float ink_pressure_radius(int d, float wmin, float wmax) {
    if (d < 0) d = 0;
    if (d > 100) d = 100;
    return 0.5f * (wmin + (wmax - wmin) * (float)d / 100.0f);
}

float ink_page_width(float pressure) {
    if (!(pressure > 0.0f)) pressure = 0.5f;
    if (pressure > 1.0f) pressure = 1.0f;
    return 2.2f + 3.2f * pressure;
}

/* ---- display-list JSON ---- */

typedef struct {
    const char *p, *end;
} cur;

static void ws(cur *c) {
    while (c->p < c->end && (*c->p == ' ' || *c->p == '\t' || *c->p == '\n' || *c->p == '\r')) c->p++;
}

static int eat(cur *c, char ch) {
    ws(c);
    if (c->p < c->end && *c->p == ch) {
        c->p++;
        return 1;
    }
    return 0;
}

static int peek(cur *c, char ch) {
    ws(c);
    return c->p < c->end && *c->p == ch;
}

/* A string into buf (truncated to cap-1; buf may be NULL to skip). Escapes
 * are honoured for finding the end; \uXXXX becomes '?'. */
static int parse_string(cur *c, char *buf, size_t cap) {
    if (!eat(c, '"')) return -1;
    size_t n = 0;
    while (c->p < c->end) {
        char ch = *c->p++;
        if (ch == '"') {
            if (buf && cap) buf[n < cap ? n : cap - 1] = 0;
            return 0;
        }
        if ((unsigned char)ch < 0x20) return -1;
        if (ch == '\\') {
            if (c->p >= c->end) return -1;
            char e = *c->p++;
            switch (e) {
                case '"': case '\\': case '/': ch = e; break;
                case 'b': ch = '\b'; break;
                case 'f': ch = '\f'; break;
                case 'n': ch = '\n'; break;
                case 'r': ch = '\r'; break;
                case 't': ch = '\t'; break;
                case 'u':
                    if (c->end - c->p < 4) return -1;
                    c->p += 4;
                    ch = '?';
                    break;
                default: return -1;
            }
        }
        if (buf && n + 1 < cap) buf[n++] = ch;
    }
    return -1;
}

static int parse_number(cur *c, double *out) {
    ws(c);
    char tmp[64];
    size_t n = 0;
    while (c->p + n < c->end && n < sizeof tmp - 1 && strchr("+-0123456789.eE", c->p[n]) && c->p[n]) n++;
    if (n == 0) return -1;
    memcpy(tmp, c->p, n);
    tmp[n] = 0;
    char *stop;
    double v = strtod(tmp, &stop);
    if (stop != tmp + n || !isfinite(v)) return -1;
    c->p += n;
    *out = v;
    return 0;
}

static int parse_word(cur *c, const char *w) {
    ws(c);
    size_t l = strlen(w);
    if ((size_t)(c->end - c->p) >= l && !memcmp(c->p, w, l)) {
        c->p += l;
        return 1;
    }
    return 0;
}

/* true / false / null (null and false are both false). */
static int parse_bool(cur *c, int *out) {
    if (parse_word(c, "true")) return *out = 1, 0;
    if (parse_word(c, "false") || parse_word(c, "null")) return *out = 0, 0;
    return -1;
}

static int skip_value(cur *c, int depth) {
    if (depth > 32) return -1;
    ws(c);
    if (c->p >= c->end) return -1;
    char ch = *c->p;
    if (ch == '"') return parse_string(c, NULL, 0);
    if (ch == '{' || ch == '[') {
        char close = ch == '{' ? '}' : ']';
        c->p++;
        if (eat(c, close)) return 0;
        for (;;) {
            if (ch == '{') {
                if (parse_string(c, NULL, 0) || !eat(c, ':')) return -1;
            }
            if (skip_value(c, depth + 1)) return -1;
            if (eat(c, ',')) continue;
            return eat(c, close) ? 0 : -1;
        }
    }
    int b;
    if (!parse_bool(c, &b)) return 0;
    double ignored;
    return parse_number(c, &ignored);
}

/* Append every number of a (possibly nested) array to the pool. */
static int collect_numbers(cur *c, float *nums, int cap, int *n, int *overflow, int depth) {
    if (depth > 3 || !eat(c, '[')) return -1;
    if (eat(c, ']')) return 0;
    for (;;) {
        if (peek(c, '[')) {
            if (collect_numbers(c, nums, cap, n, overflow, depth + 1)) return -1;
        } else {
            double v;
            if (parse_number(c, &v)) return -1;
            if (*n < cap) nums[*n] = (float)v;
            else *overflow = 1;
            (*n)++;
        }
        if (eat(c, ',')) continue;
        return eat(c, ']') ? 0 : -1;
    }
}

typedef struct {
    float *nums;
    int cap, n, overflow;
} pool;

/* {"k":"line","pts":[…],"w":3|[…],"grey":0,"dash":[on,off]} */
static int parse_prim(cur *c, dl_prim *p, pool *pl) {
    char kind[8] = "";
    int pts_at = -1, pts_n = 0, w_at = -1, w_n = 0, r_at = -1, r_n = 0;
    memset(p, 0, sizeof *p);
    p->w = -1;
    p->rings = -1;
    p->wconst = 3.0f;
    if (!eat(c, '{')) return -1;
    if (!eat(c, '}')) {
        for (;;) {
            char key[16];
            if (parse_string(c, key, sizeof key) || !eat(c, ':')) return -1;
            if (!strcmp(key, "k")) {
                if (parse_string(c, kind, sizeof kind)) return -1;
            } else if (!strcmp(key, "pts")) {
                int before = pl->n;
                if (collect_numbers(c, pl->nums, pl->cap, &pl->n, &pl->overflow, 0)) return -1;
                pts_at = before, pts_n = pl->n - before;
            } else if (!strcmp(key, "w")) {
                if (peek(c, '[')) {
                    int before = pl->n;
                    if (collect_numbers(c, pl->nums, pl->cap, &pl->n, &pl->overflow, 0)) return -1;
                    w_at = before, w_n = pl->n - before;
                } else {
                    double v;
                    if (parse_number(c, &v)) return -1;
                    p->wconst = (float)v;
                }
            } else if (!strcmp(key, "grey")) {
                double v;
                if (parse_number(c, &v)) return -1;
                p->grey = (uint8_t)(v < 0 ? 0 : v > 255 ? 255 : v);
            } else if (!strcmp(key, "rings")) {
                int before = pl->n;
                if (collect_numbers(c, pl->nums, pl->cap, &pl->n, &pl->overflow, 0)) return -1;
                r_at = before, r_n = pl->n - before;
            } else if (!strcmp(key, "dash")) {
                float tmp[8];
                int n = 0, of = 0;
                if (collect_numbers(c, tmp, 8, &n, &of, 0)) return -1;
                if (n >= 2) p->dash_on = tmp[0], p->dash_off = tmp[1];
            } else if (skip_value(c, 0)) {
                return -1;
            }
            if (eat(c, ',')) continue;
            if (eat(c, '}')) break;
            return -1;
        }
    }
    if (!strcmp(kind, "line")) p->kind = DLP_LINE;
    else if (!strcmp(kind, "fill")) p->kind = DLP_FILL;
    else return -1;
    if (pts_at < 0 || pts_n < 2 || pts_n % 2) return -1;
    p->pts = pts_at, p->npts = pts_n / 2;
    if (p->kind == DLP_FILL && p->npts < 3) return -1;
    if (p->kind == DLP_FILL && r_at >= 0 && !pl->overflow) {
        /* contour point counts: whole, positive, and adding up to the points */
        int sum = 0;
        for (int i = 0; i < r_n; i++) {
            float v = pl->nums[r_at + i];
            if (!(v >= 1.0f) || v != floorf(v) || v > (float)p->npts) return -1;
            sum += (int)v;
        }
        if (r_n == 0 || sum != p->npts) return -1;
        p->rings = r_at, p->nrings = r_n;
    }
    if (w_at >= 0) {
        if (w_n == p->npts) p->w = w_at;
        else if (w_n > 0 && !pl->overflow) p->wconst = pl->nums[w_at]; /* mismatched: the first width for all */
    }
    return 0;
}

int dl_parse(const char *line, size_t len, dl_op *out, dl_prim *prims, int maxprims, float *nums, int maxnums) {
    cur c = {line, line + len};
    char op[8] = "";
    pool pl = {nums, maxnums, 0, 0};
    int prim_overflow = 0, have_prims = 0;
    memset(out, 0, sizeof *out);
    out->prims = prims, out->nums = nums;

    if (!eat(&c, '{')) return -1;
    if (!eat(&c, '}')) {
        for (;;) {
            char key[16];
            if (parse_string(&c, key, sizeof key) || !eat(&c, ':')) return -1;
            if (!strcmp(key, "op")) {
                if (parse_string(&c, op, sizeof op)) return -1;
            } else if (!strcmp(key, "id")) {
                if (parse_string(&c, out->id, sizeof out->id)) return -1;
            } else if (!strcmp(key, "z")) {
                double z;
                if (parse_number(&c, &z)) return -1;
                out->z = (float)z;
            } else if (!strcmp(key, "live") || !strcmp(key, "noInk") || !strcmp(key, "grab")) {
                int b;
                if (parse_bool(&c, &b)) return -1;
                int bit = key[0] == 'l' ? DL_LIVE : key[0] == 'n' ? DL_NOINK : DL_GRAB;
                if (b) out->flags |= bit;
            } else if (!strcmp(key, "prims")) {
                if (!eat(&c, '[')) return -1;
                have_prims = 1;
                if (!eat(&c, ']')) {
                    for (;;) {
                        dl_prim tmp;
                        if (parse_prim(&c, out->nprims < maxprims ? &prims[out->nprims] : &tmp, &pl)) return -1;
                        if (out->nprims < maxprims) out->nprims++;
                        else prim_overflow = 1;
                        if (eat(&c, ',')) continue;
                        if (eat(&c, ']')) break;
                        return -1;
                    }
                }
            } else if (skip_value(&c, 0)) {
                return -1;
            }
            if (eat(&c, ',')) continue;
            if (eat(&c, '}')) break;
            return -1;
        }
    }
    ws(&c);
    if (c.p != c.end) return -1;

    if (!strcmp(op, "put")) {
        if (!out->id[0] || !have_prims) return -1;
        if (prim_overflow || pl.overflow) return -2;
        out->kind = DL_PUT;
        out->nnums = pl.n;
    } else if (!strcmp(op, "del")) {
        if (!out->id[0]) return -1;
        out->kind = DL_DEL;
    } else if (!strcmp(op, "clear")) {
        out->kind = DL_CLEAR;
    } else if (!strcmp(op, "flush")) {
        out->kind = DL_FLUSH;
    } else {
        return -1;
    }
    return 0;
}

ink_rect dl_bounds(const dl_prim *prims, int nprims, const float *nums) {
    ink_rect r = ink_rect_empty();
    for (int i = 0; i < nprims; i++) {
        const dl_prim *p = &prims[i];
        float wmax = p->kind == DLP_FILL ? 0.0f : p->wconst;
        if (p->kind == DLP_LINE && p->w >= 0)
            for (int k = 0; k < p->npts; k++) wmax = fmaxf(wmax, nums[p->w + k]);
        float pad = 0.5f * wmax + 2.0f;
        for (int k = 0; k < p->npts; k++) {
            float x = nums[p->pts + 2 * k], y = nums[p->pts + 2 * k + 1];
            if (!isfinite(x) || !isfinite(y) || fabsf(x) > 1e6f || fabsf(y) > 1e6f) continue;
            ink_rect b = {(int)floorf(x - pad), (int)floorf(y - pad), (int)ceilf(x + pad), (int)ceilf(y + pad)};
            r = ink_rect_union(r, b);
        }
    }
    return r;
}

ink_rect dl_draw(ink_canvas *c, const dl_prim *p, const float *nums) {
    if (p->kind == DLP_FILL) {
        if (p->rings < 0) return ink_polygon(c, nums + p->pts, p->npts, p->grey);
        int stack[64];
        int *rings = p->nrings <= 64 ? stack : malloc(sizeof(int) * (size_t)p->nrings);
        if (!rings) return ink_rect_empty();
        for (int i = 0; i < p->nrings; i++) rings[i] = (int)nums[p->rings + i];
        ink_rect d = ink_polygon_rings(c, nums + p->pts, p->npts, rings, p->nrings, p->grey);
        if (rings != stack) free(rings);
        return d;
    }
    return ink_polyline(c, nums + p->pts, p->npts, p->w >= 0 ? nums + p->w : NULL, p->wconst, p->grey, p->dash_on,
                        p->dash_off, 1);
}
