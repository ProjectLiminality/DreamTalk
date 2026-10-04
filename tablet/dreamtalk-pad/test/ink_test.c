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
static ink_canvas cv = {buf, W, H, {0, 0, 0, 0}};

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

static dl_prim P[64];
static float N[256];
static int parse(const char *s, dl_op *o) { return dl_parse(s, strlen(s), o, P, 64, N, 256); }

static void test_json(void) {
    dl_op o;
    CHECK(parse("{\"op\":\"put\",\"id\":\"ink:a\",\"z\":20,\"prims\":[{\"k\":\"line\",\"pts\":[10,20,30.5,-4e1],\"w\":[3,4]}]}", &o) == 0, "put");
    CHECK(o.kind == DL_PUT && !strcmp(o.id, "ink:a") && o.z == 20 && o.nprims == 1 && !o.flags, "put fields");
    CHECK(P[0].kind == DLP_LINE && P[0].npts == 2 && P[0].w >= 0 && P[0].grey == 0 && P[0].dash_on == 0, "line prim");
    CHECK(N[P[0].pts] == 10 && N[P[0].pts + 3] == -40 && N[P[0].w] == 3 && N[P[0].w + 1] == 4, "line numbers");

    CHECK(parse("  { \"prims\" : [ {\"w\":2.5,\"dash\":[6,4],\"grey\":170,\"pts\":[1,2,3,4,5,6],\"k\":\"line\",\"x\":{\"a\":[1,{\"b\":null}]}},"
                "{\"k\":\"fill\",\"pts\":[0,0,10,0,10,10],\"grey\":255} ] ,\"op\":\"put\", \"live\":true,\"noInk\":false,\"grab\":true,\"id\":\"frame\" }\r",
                &o) == 0,
          "any order, unknown keys, flags");
    CHECK(o.nprims == 2 && o.flags == (DL_LIVE | DL_GRAB), "flags %d", o.flags);
    CHECK(P[0].npts == 3 && P[0].w < 0 && P[0].wconst == 2.5f && P[0].grey == 170 && P[0].dash_on == 6 && P[0].dash_off == 4, "line options");
    CHECK(P[1].kind == DLP_FILL && P[1].npts == 3 && P[1].grey == 255, "fill prim");
    CHECK(parse("{\"op\":\"put\",\"id\":\"m\",\"prims\":[{\"k\":\"line\",\"pts\":[1,1,2,2],\"w\":[7]}]}", &o) == 0 && P[0].w < 0 && P[0].wconst == 7,
          "mismatched widths: the first for all");
    CHECK(parse("{\"op\":\"put\",\"id\":\"a\\\"b\\u00e9\",\"prims\":[]}", &o) == 0 && !strcmp(o.id, "a\"b?") && o.nprims == 0, "escaped id '%s'", o.id);
    CHECK(parse("{\"op\":\"clear\"}", &o) == 0 && o.kind == DL_CLEAR, "clear");
    CHECK(parse("{\"op\":\"flush\"}", &o) == 0 && o.kind == DL_FLUSH, "flush");
    CHECK(parse("{\"op\":\"del\",\"id\":\"s1\"}", &o) == 0 && o.kind == DL_DEL && !strcmp(o.id, "s1"), "del");

    const char *bad[] = {
        "",
        "{",
        "{\"op\":\"put\",\"id\":\"a\"}",                                          /* no prims */
        "{\"op\":\"put\",\"prims\":[]}",                                          /* no id */
        "{\"op\":\"put\",\"id\":\"a\",\"prims\":[{\"k\":\"line\",\"pts\":[1,2,3]}]}",   /* odd count */
        "{\"op\":\"put\",\"id\":\"a\",\"prims\":[{\"k\":\"fill\",\"pts\":[1,2,3,4]}]}", /* a fill needs 3 points */
        "{\"op\":\"put\",\"id\":\"a\",\"prims\":[{\"k\":\"blob\",\"pts\":[1,2]}]}",    /* unknown primitive */
        "{\"op\":\"put\",\"id\":\"a\",\"prims\":[{\"k\":\"line\",\"pts\":[1,\"x\"]}]}", /* not a number */
        "{\"op\":\"put\",\"id\":\"a\",\"prims\":[{\"k\":\"line\",\"pts\":[1e999,2]}]}", /* not finite */
        "{\"op\":\"put\",\"id\":\"a\",\"prims\":[]",                              /* unterminated */
        "{\"op\":\"clear\"} trailing",                                            /* junk after */
        "{\"op\":\"explode\"}",                                                   /* unknown op */
        "{\"op\":\"del\"}",                                                       /* del needs an id */
        "{\"op\":\"put\",\"id\":\"a\",\"live\":7,\"prims\":[]}",                       /* flags are booleans */
        "[1,2,3]",
    };
    for (size_t i = 0; i < sizeof bad / sizeof *bad; i++) CHECK(parse(bad[i], &o) == -1, "bad[%zu] accepted: %s", i, bad[i]);

    /* Fills with counters: rings are contour point counts. */
    CHECK(parse("{\"op\":\"put\",\"id\":\"t\",\"prims\":[{\"k\":\"fill\",\"pts\":[0,0,9,0,9,9,0,9,3,3,3,6,6,6,6,3],\"grey\":0,\"rings\":[4,4]}]}", &o) == 0,
          "fill with rings");
    CHECK(P[0].nrings == 2 && P[0].rings >= 0 && N[P[0].rings] == 4 && N[P[0].rings + 1] == 4, "rings parsed");
    CHECK(parse("{\"op\":\"put\",\"id\":\"t\",\"prims\":[{\"k\":\"fill\",\"pts\":[0,0,9,0,9,9]}]}", &o) == 0 && P[0].rings < 0, "no rings: one contour");
    const char *badrings[] = {
        "{\"op\":\"put\",\"id\":\"t\",\"prims\":[{\"k\":\"fill\",\"pts\":[0,0,9,0,9,9,0,9],\"rings\":[3]}]}",     /* doesn't add up */
        "{\"op\":\"put\",\"id\":\"t\",\"prims\":[{\"k\":\"fill\",\"pts\":[0,0,9,0,9,9,0,9],\"rings\":[2.5,1.5]}]}", /* not whole */
        "{\"op\":\"put\",\"id\":\"t\",\"prims\":[{\"k\":\"fill\",\"pts\":[0,0,9,0,9,9,0,9],\"rings\":[5,-1]}]}",   /* negative */
        "{\"op\":\"put\",\"id\":\"t\",\"prims\":[{\"k\":\"fill\",\"pts\":[0,0,9,0,9,9,0,9],\"rings\":[]}]}",       /* empty */
    };
    for (size_t i = 0; i < sizeof badrings / sizeof *badrings; i++) CHECK(parse(badrings[i], &o) == -1, "badrings[%zu] accepted", i);
    {
        /* drawn through dl_draw: the counter stays white */
        blank();
        parse("{\"op\":\"put\",\"id\":\"t\",\"prims\":[{\"k\":\"fill\",\"pts\":[500,500,600,500,600,600,500,600,530,530,530,570,570,570,570,530],\"grey\":0,\"rings\":[4,4]}]}", &o);
        dl_draw(&cv, &P[0], N);
        CHECK(is_ink(510, 550) && !is_ink(550, 550), "dl_draw honours the counter");
    }

    /* Too many numbers or primitives for the pools: reported, never written past. */
    float small[5] = {0, 0, 0, 0, -1};
    const char *many = "{\"op\":\"put\",\"id\":\"a\",\"prims\":[{\"k\":\"line\",\"pts\":[1,2,3,4,5,6]}]}";
    CHECK(dl_parse(many, strlen(many), &o, P, 64, small, 4) == -2, "numbers overflow is -2");
    CHECK(small[4] == -1, "overflow never writes past the pool");
    dl_prim one[1];
    const char *two = "{\"op\":\"put\",\"id\":\"a\",\"prims\":[{\"k\":\"line\",\"pts\":[1,2]},{\"k\":\"line\",\"pts\":[3,4]}]}";
    CHECK(dl_parse(two, strlen(two), &o, one, 1, N, 256) == -2, "prims overflow is -2");

    /* Not NUL-terminated: the parser must stop at len. */
    const char *s = "{\"op\":\"clear\"}XXXX";
    CHECK(dl_parse(s, 14, &o, P, 64, N, 256) == 0 && o.kind == DL_CLEAR, "respects len");

    /* Bounds include half the widest width and an AA pixel. */
    parse("{\"op\":\"put\",\"id\":\"b\",\"prims\":[{\"k\":\"line\",\"pts\":[100,100,200,100],\"w\":[2,10]}]}", &o);
    ink_rect b = dl_bounds(o.prims, o.nprims, o.nums);
    CHECK(b.x0 == 93 && b.y0 == 93 && b.x1 == 207 && b.y1 == 107, "bounds %d,%d,%d,%d", R(b));
}

static void test_canvas_clip(void) {
    /* A clip rect confines every call; outside it the page is untouched. */
    blank();
    ink_rect clip = {300, 300, 400, 400};
    cv.clip = clip;
    ink_rect d = ink_segment(&cv, 200, 350.5f, 6, 500, 350.5f, 6, 1);
    ink_rect f = ink_fill(&cv, (ink_rect){0, 0, W, H}, INK_BLACK);
    float tri[] = {250, 250, 450, 300, 300, 450};
    ink_rect p = ink_polygon(&cv, tri, 3, 0);
    cv.clip = ink_rect_empty();
    ink_rect bb = ink_bbox();
    CHECK(rect_eq(f, clip) && bb.x0 >= 300 && bb.y0 >= 300 && bb.x1 <= 400 && bb.y1 <= 400, "clipped %d,%d,%d,%d", R(bb));
    CHECK(d.x0 == 300 && d.x1 == 400, "segment dirty clipped %d,%d,%d,%d", R(d));
    CHECK(p.x0 >= 300 && p.x1 <= 400, "polygon dirty clipped %d,%d,%d,%d", R(p));
}

static void test_polygon(void) {
    blank();
    /* A 100x100 square: exactly 10000 pixel centres inside. */
    float sq[] = {100, 100, 200, 100, 200, 200, 100, 200};
    ink_rect d = ink_polygon(&cv, sq, 4, 0);
    int n = 0;
    for (int y = 0; y < 300; y++)
        for (int x = 0; x < 300; x++) n += is_ink(x, y);
    CHECK(n == 10000 && d.x0 == 100 && d.y0 == 100 && d.x1 == 200 && d.y1 == 200, "square fill %d px, %d,%d,%d,%d", n, R(d));
    /* Fills PAINT: a white fill knocks out ink under it (FoldableCube's faces). */
    float in[] = {120, 120, 180, 120, 180, 180, 120, 180};
    ink_polygon(&cv, in, 4, 255);
    CHECK(!is_ink(150, 150) && is_ink(110, 110), "white fill knocks out");
    /* Nonzero (the font's rule): a self-crossing star is solid at its centre. */
    blank();
    float st[10];
    for (int k = 0; k < 5; k++) st[2 * k] = 700 + 200 * cosf(k * 4 * (float)M_PI / 5 - (float)M_PI / 2), st[2 * k + 1] = 900 + 200 * sinf(k * 4 * (float)M_PI / 5 - (float)M_PI / 2);
    ink_polygon(&cv, st, 5, 0);
    CHECK(is_ink(700, 900) && is_ink(700, 730), "nonzero star");

    /* A glyph: an outside and a counter wound against it — the hole of an `o`. */
    blank();
    float o[] = {/* outer, clockwise on the page */ 100, 1300, 300, 1300, 300, 1500, 100, 1500,
                 /* counter, the other way */ 150, 1350, 150, 1450, 250, 1450, 250, 1350};
    int rings[] = {4, 4};
    ink_rect d2 = ink_polygon_rings(&cv, o, 8, rings, 2, 0);
    CHECK(is_ink(120, 1400) && is_ink(200, 1320) && !is_ink(200, 1400), "counter is a hole");
    CHECK(d2.x0 == 100 && d2.y0 == 1300 && d2.x1 == 300 && d2.y1 == 1500, "glyph dirty %d,%d,%d,%d", R(d2));
    /* Two contours wound the same way overlap solid, as a composite glyph does. */
    blank();
    float two[] = {100, 1600, 300, 1600, 300, 1700, 100, 1700, 200, 1650, 400, 1650, 400, 1750, 200, 1750};
    ink_polygon_rings(&cv, two, 8, rings, 2, 0);
    CHECK(is_ink(250, 1675) && is_ink(150, 1620) && is_ink(350, 1720), "same-wound overlap stays solid");
    /* Counts that don't add up draw nothing rather than garbage. */
    int bad[] = {4, 3};
    CHECK(ink_rect_is_empty(ink_polygon_rings(&cv, two, 8, bad, 2, 0)), "mismatched rings draw nothing");
}

static void test_polyline(void) {
    /* Dashes: on/off along the line, phase carried across vertices. */
    blank();
    float line[] = {100, 500.5f, 300, 500.5f, 500, 500.5f};
    ink_polyline(&cv, line, 3, NULL, 2, 0, 10, 10, 0);
    int on = 0;
    for (int x = 100; x < 500; x++) on += is_ink(x, 500);
    /* 20 dashes of 10, each a round cap (r = 1) longer at both ends */
    CHECK(on >= 200 && on <= 250, "dashed: %d of 400 px on", on);
    CHECK(is_ink(105, 500) && !is_ink(115, 500) && is_ink(305, 500) && !is_ink(315, 500), "dash phase");
    /* Grey lines are grey, and never lighten black ink. */
    blank();
    float g[] = {100, 800.5f, 400, 800.5f};
    ink_polyline(&cv, g, 2, NULL, 4, 170, 0, 0, 0);
    CHECK(abs(ink_grey_from_rgb565(buf[800 * W + 200]) - 170) <= 4, "grey %d", ink_grey_from_rgb565(buf[800 * W + 200]));
    ink_segment(&cv, 250, 790, 3, 250, 810, 3, 0);
    ink_polyline(&cv, g, 2, NULL, 4, 170, 0, 0, 0);
    CHECK(buf[800 * W + 250] == INK_BLACK, "grey over black stays black");
    /* Per-point widths widen the line. */
    blank();
    float t[] = {100, 1200.5f, 600, 1200.5f};
    float w[] = {2, 12};
    ink_polyline(&cv, t, 2, w, 0, 0, 0, 0, 0);
    CHECK(column_run(150) < column_run(550), "per-point widths %d < %d", column_run(150), column_run(550));
    CHECK(fabsf(ink_page_width(0) - 3.8f) < 1e-5 && fabsf(ink_page_width(1) - 5.4f) < 1e-5, "the page's nib");
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
    test_canvas_clip();
    test_polygon();
    test_polyline();
    dump_page(argc > 1 ? argv[1] : "ink_test.ppm");
    printf("%d/%d checks passed\n", checks - failures, checks);
    return failures ? 1 : 0;
}
