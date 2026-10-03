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

ink_rect ink_rect_clip(ink_rect r, int w, int h) {
    ink_rect c = {imax(r.x0, 0), imax(r.y0, 0), imin(r.x1, w), imin(r.y1, h)};
    return ink_rect_is_empty(c) ? ink_rect_empty() : c;
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
    r = ink_rect_clip(r, c->w, c->h);
    for (int y = r.y0; y < r.y1; y++) {
        uint16_t *row = c->px + (size_t)y * c->w;
        for (int x = r.x0; x < r.x1; x++) row[x] = color;
    }
    return r;
}

/* ---- strokes ---- */

ink_rect ink_segment(ink_canvas *c, float x0, float y0, float r0, float x1, float y1, float r1, int aa) {
    /* A 1-bit line thinner than a pixel would break up; keep it at least one pixel wide. */
    if (!aa) {
        if (r0 < 0.5f) r0 = 0.5f;
        if (r1 < 0.5f) r1 = 0.5f;
    }
    if (!(r0 > 0.0f) && !(r1 > 0.0f)) return ink_rect_empty();
    if (!isfinite(x0) || !isfinite(y0) || !isfinite(x1) || !isfinite(y1)) return ink_rect_empty();

    float rmax = r0 > r1 ? r0 : r1;
    float pad = rmax + 1.0f;
    float fx0 = fminf(x0, x1) - pad, fx1 = fmaxf(x0, x1) + pad;
    float fy0 = fminf(y0, y1) - pad, fy1 = fmaxf(y0, y1) + pad;
    /* Clip in float first so huge coordinates can't overflow int. */
    if (fx1 < 0 || fy1 < 0 || fx0 > c->w || fy0 > c->h) return ink_rect_empty();
    ink_rect box = {(int)floorf(fmaxf(fx0, 0)), (int)floorf(fmaxf(fy0, 0)),
                    (int)ceilf(fminf(fx1, (float)c->w)), (int)ceilf(fminf(fy1, (float)c->h))};
    box = ink_rect_clip(box, c->w, c->h);

    float dx = x1 - x0, dy = y1 - y0;
    float len2 = dx * dx + dy * dy;
    ink_rect dirty = ink_rect_empty();
    int first = 1;

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
                g = (uint8_t)(255.0f * (1.0f - cov) + 0.5f);
            } else {
                if (d > r) continue;
                g = 0;
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

float ink_pressure_radius(int d, float wmin, float wmax) {
    if (d < 0) d = 0;
    if (d > 100) d = 100;
    return 0.5f * (wmin + (wmax - wmin) * (float)d / 100.0f);
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
    static const char *words[] = {"true", "false", "null"};
    for (int i = 0; i < 3; i++) {
        size_t l = strlen(words[i]);
        if ((size_t)(c->end - c->p) >= l && !memcmp(c->p, words[i], l)) {
            c->p += l;
            return 0;
        }
    }
    double ignored;
    return parse_number(c, &ignored);
}

/* Collect every number in a (possibly nested) array, in order, as floats. */
static int collect_numbers(cur *c, float *nums, int cap, int *n, int *overflow, int depth) {
    if (depth > 3 || !eat(c, '[')) return -1;
    if (eat(c, ']')) return 0;
    for (;;) {
        ws(c);
        if (c->p < c->end && *c->p == '[') {
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

int dl_parse(const char *line, size_t len, dl_cmd *out, float *pts, int maxpts) {
    cur c = {line, line + len};
    char kind[16] = "";
    int nnums = 0, overflow = 0, have_points = 0;
    memset(out, 0, sizeof *out);
    out->width = -1.0f;
    out->pts = pts;

    if (!eat(&c, '{')) return -1;
    if (!eat(&c, '}')) {
        for (;;) {
            char key[32];
            if (parse_string(&c, key, sizeof key) || !eat(&c, ':')) return -1;
            ws(&c);
            if (!strcmp(key, "kind")) {
                if (parse_string(&c, kind, sizeof kind)) return -1;
            } else if (!strcmp(key, "id")) {
                ws(&c);
                if (c.p < c.end && *c.p == '"') {
                    if (parse_string(&c, out->id, sizeof out->id)) return -1;
                } else { /* a numeric id is fine too: keep its text */
                    const char *s = c.p;
                    double ignored;
                    if (parse_number(&c, &ignored)) return -1;
                    size_t l = (size_t)(c.p - s) < DL_ID_MAX - 1 ? (size_t)(c.p - s) : DL_ID_MAX - 1;
                    memcpy(out->id, s, l);
                    out->id[l] = 0;
                }
            } else if (!strcmp(key, "width")) {
                double w;
                if (parse_number(&c, &w)) return -1;
                out->width = (float)w;
            } else if (!strcmp(key, "points")) {
                if (collect_numbers(&c, pts, maxpts * 2, &nnums, &overflow, 0)) return -1;
                have_points = 1;
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

    if (!strcmp(kind, "draw")) {
        if (!have_points || nnums < 2 || nnums % 2) return -1;
        if (overflow) return -2;
        out->kind = DL_DRAW;
        out->npts = nnums / 2;
    } else if (!strcmp(kind, "clear")) {
        out->kind = DL_CLEAR;
    } else if (!strcmp(kind, "remove")) {
        if (!out->id[0]) return -1;
        out->kind = DL_REMOVE;
    } else {
        return -1;
    }
    return 0;
}
