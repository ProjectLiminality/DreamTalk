/*
 * Host tests for ink.c: line widths, caps, clipping, dirty rects and the
 * display-list parser. Run via ./build.sh test. Writes build/ink_test.ppm,
 * a full rM2 page you can look at.
 */
#include "../ink.h"

#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define W 1404
#define H 1872

static int failures = 0, checks = 0;
#define CHECK(cond, ...)                                       \
    do {                                                       \
        checks++;                                              \
        if (!(cond)) {                                         \
            failures++;                                        \
            fprintf(stderr, "FAIL %s:%d: ", __FILE__, __LINE__); \
            fprintf(stderr, __VA_ARGS__);                      \
            fprintf(stderr, "\n");                             \
        }                                                      \
    } while (0)

static uint16_t buf[W * H];
static ink_canvas cv = {buf, W, H};

static void blank(void) {
    for (int i = 0; i < W * H; i++) buf[i] = INK_WHITE;
}

static int is_ink(int x, int y) { return buf[y * W + x] != INK_WHITE; }

static ink_rect ink_bbox(void) {
    ink_rect r = ink_rect_empty();
    for (int y = 0; y < H; y++)
        for (int x = 0; x < W; x++)
            if (is_ink(x, y)) {
                ink_rect p = {x, y, x + 1, y + 1};
                r = ink_rect_union(r, p);
            }
    return r;
}

static int column_run(int x) {
    int n = 0;
    for (int y = 0; y < H; y++) n += is_ink(x, y);
    return n;
}

static int rect_eq(ink_rect a, ink_rect b) {
    if (ink_rect_is_empty(a) && ink_rect_is_empty(b)) return 1;
    return a.x0 == b.x0 && a.y0 == b.y0 && a.x1 == b.x1 && a.y1 == b.y1;
}

#define R(r) (r).x0, (r).y0, (r).x1, (r).y1

static void test_rects(void) {
    ink_rect a = {10, 10, 20, 20}, b = {15, 5, 30, 12};
    ink_rect u = ink_rect_union(a, b);
    CHECK(u.x0 == 10 && u.y0 == 5 && u.x1 == 30 && u.y1 == 20, "union %d,%d,%d,%d", R(u));
    CHECK(rect_eq(ink_rect_union(ink_rect_empty(), a), a), "union with empty");
    ink_rect c = {-5, -5, 2000, 3000};
    ink_rect k = ink_rect_clip(c, W, H);
    CHECK(k.x0 == 0 && k.y0 == 0 && k.x1 == W && k.y1 == H, "clip %d,%d,%d,%d", R(k));
    ink_rect off = {W + 10, 0, W + 20, 5};
    CHECK(ink_rect_is_empty(ink_rect_clip(off, W, H)), "clip off-page is empty");
}

static void test_colour(void) {
    CHECK(ink_rgb565_from_grey(255) == 0xFFFF, "white");
    CHECK(ink_rgb565_from_grey(0) == 0x0000, "black");
    for (int g = 0; g < 256; g += 17) {
        int back = ink_grey_from_rgb565(ink_rgb565_from_grey((uint8_t)g));
        CHECK(abs(back - g) <= 3, "grey %d round-trips to %d", g, back);
    }
}

static void test_width(void) {
    /* Horizontal 1-bit line, radius 3, on pixel centres: 7 px tall (2r+1). */
    blank();
    ink_rect d = ink_segment(&cv, 100, 500.5f, 3, 400, 500.5f, 3, 0);
    CHECK(column_run(250) == 7, "r=3 line is %d px tall, want 7", column_run(250));
    CHECK(rect_eq(d, ink_bbox()), "dirty %d,%d,%d,%d != ink bbox", R(d));
    /* Round caps: ink reaches r past each end, no further. */
    CHECK(d.x0 == 97 && d.x1 == 403, "caps: x %d..%d, want 97..403", d.x0, d.x1);

    /* A thin 1-bit line never breaks up: every column along a diagonal has ink. */
    blank();
    ink_segment(&cv, 10, 10, 0.1f, 600, 333, 0.1f, 0);
    int gaps = 0;
    for (int x = 11; x < 599; x++) gaps += column_run(x) == 0;
    CHECK(gaps == 0, "hairline has %d empty columns", gaps);

    /* Width grows with radius. */
    for (int r = 1; r <= 8; r++) {
        blank();
        ink_segment(&cv, 100, 300.5f, (float)r, 300, 300.5f, (float)r, 0);
        CHECK(column_run(200) == 2 * r + 1, "r=%d: %d px", r, column_run(200));
    }
}

static void test_taper(void) {
    blank();
    ink_segment(&cv, 100, 700.5f, 1, 500, 700.5f, 6, 0);
    int near = column_run(120), far = column_run(480);
    CHECK(near < far, "taper: %d px near start, %d near end", near, far);
    CHECK(near <= 3 && far >= 11, "taper widths %d / %d", near, far);
}

static void test_dot(void) {
    blank();
    ink_rect d = ink_segment(&cv, 700, 900, 5, 700, 900, 5, 0);
    int area = 0;
    for (int y = d.y0; y < d.y1; y++)
        for (int x = d.x0; x < d.x1; x++) area += is_ink(x, y);
    CHECK(fabs(area - M_PI * 25) < 12, "dot area %d, want ~79", area);
    CHECK(d.x1 - d.x0 == 10 && d.y1 - d.y0 == 10, "dot box %dx%d", d.x1 - d.x0, d.y1 - d.y0);
}

static void test_dirty(void) {
    /* For many segments the dirty rect is exactly the bbox of new ink. */
    srand(7);
    for (int i = 0; i < 200; i++) {
        blank();
        float x0 = (float)(rand() % (W + 200) - 100), y0 = (float)(rand() % (H + 200) - 100);
        float x1 = x0 + (float)(rand() % 120 - 60), y1 = y0 + (float)(rand() % 120 - 60);
        float r0 = (float)(rand() % 80) / 10.0f, r1 = (float)(rand() % 80) / 10.0f;
        int aa = i & 1;
        ink_rect d = ink_segment(&cv, x0, y0, r0, x1, y1, r1, aa);
        ink_rect b = ink_bbox();
        CHECK(rect_eq(d, b), "seg %d (aa=%d): dirty %d,%d,%d,%d bbox %d,%d,%d,%d", i, aa, R(d), R(b));
    }
    /* Redrawing the same 1-bit stroke changes nothing, so nothing is dirty. */
    blank();
    ink_segment(&cv, 50, 50, 4, 150, 90, 4, 0);
    ink_rect again = ink_segment(&cv, 50, 50, 4, 150, 90, 4, 0);
    CHECK(ink_rect_is_empty(again), "redraw dirty %d,%d,%d,%d", R(again));
    /* A polyline's dirty union covers every changed pixel. */
    blank();
    float poly[][2] = {{200, 200}, {260, 230}, {300, 330}, {240, 380}};
    ink_rect u = ink_rect_empty();
    for (int k = 1; k < 4; k++) u = ink_rect_union(u, ink_segment(&cv, poly[k - 1][0], poly[k - 1][1], 3, poly[k][0], poly[k][1], 3, 1));
    CHECK(rect_eq(u, ink_bbox()), "polyline union %d,%d,%d,%d", R(u));
}

static void test_clip(void) {
    blank();
    ink_rect d = ink_segment(&cv, -50, -50, 4, 20, 20, 4, 0);
    CHECK(d.x0 == 0 && d.y0 == 0 && d.x1 > 15 && d.x1 <= 25, "corner clip %d,%d,%d,%d", R(d));
    d = ink_segment(&cv, W - 5, H - 5, 8, W + 50, H + 50, 8, 0);
    CHECK(d.x1 == W && d.y1 == H, "far corner clip %d,%d,%d,%d", R(d));
    d = ink_segment(&cv, -500, -500, 4, -400, -300, 4, 0);
    CHECK(ink_rect_is_empty(d), "off-page is empty");
    d = ink_segment(&cv, 1e30f, 0, 4, -1e30f, 10, 4, 1);
    CHECK(!ink_rect_is_empty(d) && d.x0 == 0 && d.x1 == W, "huge coordinates clip without overflow %d,%d,%d,%d", R(d));
    d = ink_segment(&cv, NAN, 0, 4, 10, 10, 4, 1);
    CHECK(ink_rect_is_empty(d), "NaN is ignored");
}

static void test_aa(void) {
    blank();
    ink_segment(&cv, 100, 1000.3f, 4, 600, 1040.7f, 4, 1);
    int black = 0, grey = 0;
    for (int i = 0; i < W * H; i++) {
        uint8_t g = ink_grey_from_rgb565(buf[i]);
        if (g < 16) black++;
        else if (g < 240) grey++;
    }
    CHECK(black > 2000 && grey > 300, "aa line: %d black, %d grey px", black, grey);
}

static void test_pressure(void) {
    CHECK(fabsf(ink_pressure_radius(0, 2, 6) - 1.0f) < 1e-6, "d=0");
    CHECK(fabsf(ink_pressure_radius(100, 2, 6) - 3.0f) < 1e-6, "d=100");
    CHECK(fabsf(ink_pressure_radius(50, 2, 6) - 2.0f) < 1e-6, "d=50");
    CHECK(fabsf(ink_pressure_radius(250, 2, 6) - 3.0f) < 1e-6, "d clamps high");
    CHECK(fabsf(ink_pressure_radius(-9, 2, 6) - 1.0f) < 1e-6, "d clamps low");
}

static int parse(const char *s, dl_cmd *c, float *p, int max) { return dl_parse(s, strlen(s), c, p, max); }

static void test_json(void) {
    float p[64];
    dl_cmd c;
    CHECK(parse("{\"kind\":\"draw\",\"id\":\"s1\",\"points\":[[10,20],[30.5,-4e1]],\"width\":3}", &c, p, 32) == 0, "draw");
    CHECK(c.kind == DL_DRAW && !strcmp(c.id, "s1") && c.npts == 2 && c.width == 3.0f, "draw fields");
    CHECK(p[0] == 10 && p[1] == 20 && p[2] == 30.5f && p[3] == -40, "draw points %g %g %g %g", p[0], p[1], p[2], p[3]);

    CHECK(parse("  { \"width\" : 2 , \"points\" : [ 1, 2, 3, 4, 5, 6 ] ,\"kind\":\"draw\" , \"extra\":{\"a\":[1,{\"b\":null}],\"t\":true} }\r", &c, p, 32) == 0, "flat points, any order, unknown keys");
    CHECK(c.npts == 3 && c.width == 2 && !c.id[0], "flat fields npts=%d", c.npts);

    CHECK(parse("{\"kind\":\"draw\",\"id\":42,\"points\":[[1,1]]}", &c, p, 32) == 0 && !strcmp(c.id, "42") && c.width < 0, "numeric id, no width");
    CHECK(parse("{\"kind\":\"draw\",\"id\":\"a\\\"b\\u00e9\",\"points\":[[1,1]]}", &c, p, 32) == 0 && !strcmp(c.id, "a\"b?"), "escaped id '%s'", c.id);
    CHECK(parse("{\"kind\":\"clear\"}", &c, p, 32) == 0 && c.kind == DL_CLEAR, "clear");
    CHECK(parse("{\"kind\":\"remove\",\"id\":\"s1\"}", &c, p, 32) == 0 && c.kind == DL_REMOVE, "remove");

    const char *bad[] = {
        "",
        "{",
        "{\"kind\":\"draw\"}",                                  /* no points */
        "{\"kind\":\"draw\",\"points\":[[1,2],[3]]}",           /* odd count */
        "{\"kind\":\"draw\",\"points\":[[1,2],[3,4]]",          /* unterminated */
        "{\"kind\":\"draw\",\"points\":[[1,\"x\"]]}",           /* not a number */
        "{\"kind\":\"draw\",\"points\":[[1,2]]} trailing",      /* junk after */
        "{\"kind\":\"explode\"}",                               /* unknown kind */
        "{\"kind\":\"remove\"}",                                /* remove needs an id */
        "{\"kind\":\"draw\",\"points\":[[1e999,2]]}",           /* not finite */
        "[1,2,3]",
        "{\"kind\":\"draw\",\"points\":[[[[[1,2]]]]]}",         /* nested too deep */
    };
    for (size_t i = 0; i < sizeof bad / sizeof *bad; i++) CHECK(parse(bad[i], &c, p, 32) == -1, "bad[%zu] accepted: %s", i, bad[i]);

    /* Too many points for the buffer: reported, never written past it. */
    float small[4] = {0, 0, 0, 0};
    CHECK(parse("{\"kind\":\"draw\",\"points\":[[1,2],[3,4],[5,6]]}", &c, small, 2) == -2, "overflow is -2");
    CHECK(small[2] == 3 && small[3] == 4, "overflow keeps what fits");

    /* Not NUL-terminated: the parser must stop at len. */
    const char *s = "{\"kind\":\"clear\"}XXXX";
    CHECK(dl_parse(s, 16, &c, p, 32) == 0 && c.kind == DL_CLEAR, "respects len");
}

/* A page to look at: pressure sweeps, a taper, AA symbol, the clip corner. */
static void dump_page(const char *path) {
    blank();
    for (int s = 0; s < 6; s++) {
        float y = 200.0f + s * 60.0f, lr = 0;
        for (int i = 0; i <= 100; i++) {
            float x = 120.0f + i * 11.0f;
            float r = ink_pressure_radius(s == 5 ? 100 - i : i, 2.0f + s, 6.0f + 2 * s);
            float yy = y + 12.0f * sinf(i * 0.25f);
            if (i) ink_segment(&cv, x - 11.0f, y + 12.0f * sinf((i - 1) * 0.25f), lr, x, yy, r, 0);
            lr = r;
        }
    }
    /* An AA flower-of-life-ish ring of circles, as a display list would draw it. */
    for (int k = 0; k < 7; k++) {
        float cx = 702 + (k ? 120 * cosf(k * (float)M_PI / 3) : 0), cy = 1100 + (k ? 120 * sinf(k * (float)M_PI / 3) : 0);
        for (int i = 0; i < 96; i++) {
            float a0 = i * 2 * (float)M_PI / 96, a1 = (i + 1) * 2 * (float)M_PI / 96;
            ink_segment(&cv, cx + 120 * cosf(a0), cy + 120 * sinf(a0), 1.5f, cx + 120 * cosf(a1), cy + 120 * sinf(a1), 1.5f, 1);
        }
    }
    ink_segment(&cv, 100, 1600, 1, 1300, 1700, 9, 0);  /* taper */
    ink_segment(&cv, -40, 1850, 6, 60, 1900, 6, 0);    /* clipped at the corner */
    FILE *f = fopen(path, "wb");
    if (!f) return;
    fprintf(f, "P6\n%d %d\n255\n", W, H);
    for (int i = 0; i < W * H; i++) {
        uint16_t c = buf[i];
        unsigned char rgb[3] = {(unsigned char)(((c >> 11) & 31) * 255 / 31), (unsigned char)(((c >> 5) & 63) * 255 / 63), (unsigned char)((c & 31) * 255 / 31)};
        fwrite(rgb, 1, 3, f);
    }
    fclose(f);
}

int main(int argc, char **argv) {
    test_rects();
    test_colour();
    test_width();
    test_taper();
    test_dot();
    test_dirty();
    test_clip();
    test_aa();
    test_pressure();
    test_json();
    dump_page(argc > 1 ? argv[1] : "ink_test.ppm");
    printf("%d/%d checks passed\n", checks - failures, checks);
    return failures ? 1 : 0;
}
