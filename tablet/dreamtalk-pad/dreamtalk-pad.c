/*
 * dreamtalk-pad — the DreamTalk whiteboard on the reMarkable 2's own screen.
 *
 * ONE UNIVERSE: the whiteboard page on the Mac is the app (state, selection,
 * recognition); this is its e-ink mirror and the hand that writes on it. An
 * AppLoad "external" app with a qtfb framebuffer — it runs fullscreen inside
 * xochitl, which keeps the display, sleep and the OS, and AppLoad's window
 * takes the pen and fingers, so no notebook is inked underneath.
 *
 *   - the DISPLAY LIST (core/sketch/protocol.ts) arrives on TCP
 *     127.0.0.1:7777, where this app listens; the Mac's bridge reaches it
 *     with `ssh -W`. One JSON op per line: put / del / clear, and a flush
 *     that ends each batch. The app keeps the items by id and, at each
 *     flush, repaints only the changed rectangle: cleared to white, then
 *     every item that touches it redrawn in z order, clipped to it.
 *   - the PEN TRAIL is drawn here, at once, 1-bit, in the UFAST (xochitl
 *     "Pen") waveform — the nib can't wait for a round trip. The Mac learns
 *     of the same stroke from the digitizer (its bridge reads it in
 *     parallel) and sends it back as an item on the same pixels; the trail
 *     is kept as a local overlay until the page's batch that ends the
 *     gesture arrives, or 2 s pass (a tap that wasn't ink), so nothing is
 *     darkened twice and nothing the page didn't keep lingers. A lasso
 *     trail goes the moment the pen lifts: a selection is never content.
 *     That trail is the ONLY thing drawn here; every other pixel is the
 *     display list's.
 *   - the PEN BUTTON is read from the digitizer's evdev node directly
 *     (non-exclusive): qtfb forwards the pen as plain Qt mouse events,
 *     without the button (rm-appload FBController.cpp, "TODO -
 *     differentiate between pen / eraser"). Button held → the trail is a
 *     dashed lasso, unless the press is inside the selection frame (a move).
 *     A tip landing on a control (handles, ✦ chip, ring options) leaves no
 *     trail: the page acts on it.
 *   - settled content gets one QUALITY pass (CONTENT waveform, grey AA)
 *     when all is quiet and the pen is out of range: qtfb's server stalls
 *     ~1 s after each waveform switch, so switching is only done while
 *     nobody is writing.
 *
 * Leaving: swipe one finger down from the top centre of the screen to the
 * middle; AppLoad's bar appears with its close button (rm-appload README).
 *
 * Environment (all optional): DTPAD_PORT — display-list port (default 7777,
 * 0 off); DTPAD_PEN_DEV — the digitizer's evdev node (default: found by
 * name in /proc/bus/input/devices); DTPAD_QUALITY=0 — no quality pass;
 * DTPAD_GATE=1 — the latency-gate marker (top right, black while the app
 * sees the pen down; for counting frames in a 240 fps video). QTFB_KEY is
 * set by AppLoad.
 */
#define _GNU_SOURCE
#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <math.h>
#include <netinet/in.h>
#include <poll.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <time.h>
#include <unistd.h>

#include "ink.h"
#include "qtfb.h"

#define W QTFB_RM2_WIDTH
#define H QTFB_RM2_HEIGHT

static volatile sig_atomic_t quitting = 0;
static void on_signal(int sig) {
    (void)sig;
    quitting = 1;
}

static int qfd = -1;
static ink_canvas page;
static int refresh_mode = -1;
static int gate = 0;

static void die(const char *what) {
    fprintf(stderr, "dreamtalk-pad: %s: %s\n", what, errno ? strerror(errno) : "failed");
    exit(1);
}

static double now_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1e3 + ts.tv_nsec / 1e6;
}

/* ---- qtfb ---- */

static void q_send(struct qtfb_client_msg *m) {
    if (send(qfd, m, sizeof *m, MSG_NOSIGNAL) != (ssize_t)sizeof *m) die("qtfb send");
}

static void q_update(ink_rect r) {
    r = ink_rect_clip(r, W, H);
    if (ink_rect_is_empty(r)) return;
    struct qtfb_client_msg m;
    memset(&m, 0, sizeof m);
    m.type = QTFB_MSG_UPDATE;
    m.update.type = QTFB_UPDATE_PARTIAL;
    m.update.x = r.x0, m.update.y = r.y0, m.update.w = r.x1 - r.x0, m.update.h = r.y1 - r.y0;
    q_send(&m);
}

static void q_update_all(void) {
    struct qtfb_client_msg m;
    memset(&m, 0, sizeof m);
    m.type = QTFB_MSG_UPDATE;
    m.update.type = QTFB_UPDATE_ALL;
    q_send(&m);
}

/* NB: the server sleeps 1 s on its side of our socket after every mode
 * change (fbmanagement.cpp, safetyWaitForEventLoopToCatchUp), so updates we
 * send right after a switch reach the screen up to 1 s late. Switch rarely. */
static void q_refresh_mode(int mode) {
    if (mode == refresh_mode) return;
    struct qtfb_client_msg m;
    memset(&m, 0, sizeof m);
    m.type = QTFB_MSG_SET_REFRESH_MODE;
    m.refresh_mode = mode;
    q_send(&m);
    refresh_mode = mode;
}

static void q_connect(int key) {
    qfd = socket(AF_UNIX, SOCK_SEQPACKET | SOCK_CLOEXEC, 0);
    if (qfd < 0) die("socket");
    struct sockaddr_un addr;
    memset(&addr, 0, sizeof addr);
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, QTFB_SOCKET_PATH, sizeof addr.sun_path - 1);
    if (connect(qfd, (struct sockaddr *)&addr, sizeof addr)) die("connect " QTFB_SOCKET_PATH);

    struct qtfb_client_msg init;
    memset(&init, 0, sizeof init);
    init.type = QTFB_MSG_INITIALIZE;
    init.init.key = key;
    init.init.format = QTFB_FBFMT_RM2FB;
    q_send(&init);

    /* The init reply comes first; device-state packets may follow it. */
    struct qtfb_server_msg reply;
    for (;;) {
        ssize_t n = recv(qfd, &reply, sizeof reply, 0);
        if (n <= 0) die("qtfb init reply");
        if (reply.type == QTFB_MSG_INITIALIZE) break;
    }
    size_t want = (size_t)W * H * 2;
    if (reply.init.shm_size != want) {
        fprintf(stderr, "dreamtalk-pad: qtfb gave %zu bytes, expected %zu\n", (size_t)reply.init.shm_size, want);
        exit(1);
    }

    char name[32];
    snprintf(name, sizeof name, QTFB_SHM_NAME_FMT, reply.init.shm_key);
    int shm = shm_open(name, O_RDWR, 0);
    if (shm < 0) die("shm_open");
    void *mem = mmap(NULL, want, PROT_READ | PROT_WRITE, MAP_SHARED, shm, 0);
    if (mem == MAP_FAILED) die("mmap");
    close(shm);
    page.px = mem, page.w = W, page.h = H;
    page.clip = ink_rect_empty();
}

/* ---- the display list: items by id, kept in (z, arrival) order ---- */

typedef struct {
    char id[DL_ID_MAX];
    float z;
    unsigned seq;
    int flags;
    ink_rect box;
    dl_prim *prims;
    int nprims;
    float *nums;
} item;

static item *items;
static int nitems, items_cap;
static unsigned next_seq;

static int find_item(const char *id) {
    for (int i = 0; i < nitems; i++)
        if (!strcmp(items[i].id, id)) return i;
    return -1;
}

/* Remove item i, returning the rect it covered. */
static ink_rect remove_item(int i) {
    ink_rect r = items[i].box;
    free(items[i].prims);
    free(items[i].nums);
    memmove(&items[i], &items[i + 1], sizeof(item) * (size_t)(nitems - i - 1));
    nitems--;
    return r;
}

static ink_rect clear_items(void) {
    ink_rect r = ink_rect_empty();
    while (nitems) r = ink_rect_union(r, remove_item(nitems - 1));
    return r;
}

/* Add or replace (a replaced item keeps its arrival order); returns old ∪ new rects. */
static ink_rect put_item(const dl_op *op) {
    ink_rect dirty = ink_rect_empty();
    unsigned seq = next_seq++;
    int i = find_item(op->id);
    if (i >= 0) {
        seq = items[i].seq;
        dirty = remove_item(i);
    }
    if (nitems == items_cap) {
        int cap = items_cap ? items_cap * 2 : 256;
        item *grown = realloc(items, sizeof(item) * (size_t)cap);
        if (!grown) return dirty;
        items = grown, items_cap = cap;
    }
    item it;
    memset(&it, 0, sizeof it);
    memcpy(it.id, op->id, DL_ID_MAX);
    it.z = op->z, it.seq = seq, it.flags = op->flags;
    it.prims = malloc(sizeof(dl_prim) * (size_t)(op->nprims ? op->nprims : 1));
    it.nums = malloc(sizeof(float) * (size_t)(op->nnums ? op->nnums : 1));
    if (!it.prims || !it.nums) {
        free(it.prims);
        free(it.nums);
        return dirty;
    }
    memcpy(it.prims, op->prims, sizeof(dl_prim) * (size_t)op->nprims);
    memcpy(it.nums, op->nums, sizeof(float) * (size_t)op->nnums);
    it.nprims = op->nprims;
    it.box = ink_rect_clip(dl_bounds(op->prims, op->nprims, op->nums), W, H);
    int at = nitems;
    while (at > 0 && (items[at - 1].z > it.z || (items[at - 1].z == it.z && items[at - 1].seq > it.seq))) at--;
    memmove(&items[at + 1], &items[at], sizeof(item) * (size_t)(nitems - at));
    items[at] = it;
    nitems++;
    return ink_rect_union(dirty, it.box);
}

/* The topmost item with `flag` whose rect holds (x, y), or -1. */
static int item_at(int flag, int x, int y) {
    for (int i = nitems - 1; i >= 0; i--) {
        ink_rect b = items[i].box;
        if ((items[i].flags & flag) && x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1) return i;
    }
    return -1;
}

/* ---- the local trail: what the pen draws before the page has it ---- */

#define MAX_TRAILS 8
#define LASSO_W 2.0f
#define LASSO_ON 12.0f
#define LASSO_OFF 12.0f

typedef struct {
    int lasso;    /* dashed, thin; else ink with pressure widths */
    int done;     /* the pen has lifted */
    double ended; /* when (ms) */
    int n, cap;
    float *xy, *w;
    float dash_s; /* arc length so far (lasso dashing) */
    ink_rect box;
} trail;

static trail trails[MAX_TRAILS];
static int ntrails;
static int cur = -1; /* the trail under the nib, if the gesture leaves one */
/* Rects of trails gone while a batch was half-applied: repainted with it. */
static ink_rect expired = {0, 0, 0, 0};

static ink_rect trail_segment(trail *t, int k) {
    float ax = t->xy[2 * k - 2], ay = t->xy[2 * k - 1], bx = t->xy[2 * k], by = t->xy[2 * k + 1];
    if (!t->lasso) return ink_segment(&page, ax, ay, t->w[k - 1] * 0.5f, bx, by, t->w[k] * 0.5f, 0);
    /* dashed, phase carried along the whole lasso */
    ink_rect d = ink_rect_empty();
    float len = hypotf(bx - ax, by - ay), s = 0.0f, period = LASSO_ON + LASSO_OFF;
    while (s < len) {
        /* Every step must advance: once dash_s is large, float rounding can
         * put the next dash boundary within one ulp of s, and s + tiny == s
         * would spin forever (it froze the pad on David's first lasso). */
        float phase = (float)fmod((double)t->dash_s + (double)s, (double)period);
        float e = fminf(len, s + fmaxf(phase < LASSO_ON ? LASSO_ON - phase : period - phase, 0.05f));
        if (phase < LASSO_ON) {
            float u0 = s / len, u1 = e / len;
            d = ink_rect_union(d, ink_segment(&page, ax + (bx - ax) * u0, ay + (by - ay) * u0, LASSO_W * 0.5f,
                                              ax + (bx - ax) * u1, ay + (by - ay) * u1, LASSO_W * 0.5f, 0));
        }
        s = e;
    }
    t->dash_s += len;
    return d;
}

static ink_rect trail_add(trail *t, float x, float y, float w) {
    if (t->n == t->cap) {
        int cap = t->cap ? t->cap * 2 : 256;
        float *xy = realloc(t->xy, sizeof(float) * 2 * (size_t)cap), *ws = xy ? realloc(t->w, sizeof(float) * (size_t)cap) : NULL;
        if (xy) t->xy = xy;
        if (!xy || !ws) return ink_rect_empty();
        t->w = ws, t->cap = cap;
    }
    t->xy[2 * t->n] = x, t->xy[2 * t->n + 1] = y, t->w[t->n] = w;
    t->n++;
    ink_rect d = t->n == 1 ? (t->lasso ? ink_rect_empty() : ink_segment(&page, x, y, w * 0.5f, x, y, w * 0.5f, 0))
                           : trail_segment(t, t->n - 1);
    ink_rect reach = {(int)(x - w - 2), (int)(y - w - 2), (int)(x + w + 3), (int)(y + w + 3)};
    t->box = ink_rect_union(t->box, ink_rect_clip(reach, W, H));
    return d;
}

static void trail_replay(trail *t) {
    if (t->n == 1 && !t->lasso) ink_segment(&page, t->xy[0], t->xy[1], t->w[0] * 0.5f, t->xy[0], t->xy[1], t->w[0] * 0.5f, 0);
    t->dash_s = 0;
    for (int k = 1; k < t->n; k++) trail_segment(t, k);
}

/* Forget trail i; returns its rect (to repaint without it). */
static ink_rect trail_drop(int i) {
    ink_rect r = trails[i].box;
    free(trails[i].xy);
    free(trails[i].w);
    memmove(&trails[i], &trails[i + 1], sizeof(trail) * (size_t)(ntrails - i - 1));
    ntrails--;
    if (cur == i) cur = -1;
    else if (cur > i) cur--;
    return r;
}

static int trail_start(int lasso) {
    if (ntrails == MAX_TRAILS) expired = ink_rect_union(expired, trail_drop(0));
    trail *t = &trails[ntrails];
    memset(t, 0, sizeof *t);
    t->lasso = lasso;
    t->box = ink_rect_empty();
    return ntrails++;
}

/* ---- repaint ---- */

static int pen_down = 0;
static int mac_connected = 0;

static const ink_rect MARKER = {W - 64, 16, W - 16, 64};

/* A region, from the list: white, then every item touching it in order,
 * then the live trails — all clipped to it. The display list is the truth
 * for every pixel; the trail is the only thing drawn here, and only until
 * the page has the stroke. */
static ink_rect repaint(ink_rect r) {
    r = ink_rect_clip(r, W, H);
    if (ink_rect_is_empty(r)) return r;
    page.clip = r;
    ink_fill(&page, r, INK_WHITE);
    for (int i = 0; i < nitems; i++) {
        if (!ink_rect_overlaps(items[i].box, r)) continue;
        if (pen_down && (items[i].flags & DL_LIVE)) continue; /* the trail is drawing it */
        for (int k = 0; k < items[i].nprims; k++) dl_draw(&page, &items[i].prims[k], items[i].nums);
    }
    for (int i = 0; i < ntrails; i++)
        if (ink_rect_overlaps(trails[i].box, r)) trail_replay(&trails[i]);
    if (gate) {
        ink_rect in = {MARKER.x0 + 4, MARKER.y0 + 4, MARKER.x1 - 4, MARKER.y1 - 4};
        float o[] = {MARKER.x0 + .5f, MARKER.y0 + .5f, MARKER.x1 - .5f, MARKER.y0 + .5f, MARKER.x1 - .5f,
                     MARKER.y1 - .5f, MARKER.x0 + .5f, MARKER.y1 - .5f, MARKER.x0 + .5f, MARKER.y0 + .5f};
        ink_polyline(&page, o, 5, NULL, 2.0f, 0, 0, 0, 0);
        if (pen_down) ink_fill(&page, in, INK_BLACK);
    }
    page.clip = ink_rect_empty();
    return r;
}

/* ---- the pen's button and range, from evdev ---- */

/* struct input_event on the rM2's 32-bit kernel: two 32-bit longs of time. */
struct raw_event {
    uint32_t sec, usec;
    uint16_t type, code;
    int32_t value;
};
_Static_assert(sizeof(struct raw_event) == 16, "input_event is 16 bytes on a 32-bit kernel");

#define EV_KEY_ 1
#define BTN_TOOL_PEN_ 320
#define BTN_TOOL_RUBBER_ 321
#define BTN_STYLUS_ 331
#define BTN_STYLUS2_ 332

static int efd = -1;
static int pen_button = 0, pen_in_range = 0;

/* The digitizer's event node, by name (numbers move between firmwares). */
static void find_pen_dev(char *out, size_t cap) {
    snprintf(out, cap, "/dev/input/event1");
    FILE *f = fopen("/proc/bus/input/devices", "r");
    if (!f) return;
    char line[256];
    int is_pen = 0;
    while (fgets(line, sizeof line, f)) {
        if (!strncmp(line, "N: ", 3)) is_pen = strstr(line, "Wacom") || strstr(line, "Digitizer") || strstr(line, "Marker");
        const char *ev = is_pen && !strncmp(line, "H: ", 3) ? strstr(line, "event") : NULL;
        if (ev) {
            int n = 0;
            while (ev[5 + n] >= '0' && ev[5 + n] <= '9') n++;
            snprintf(out, cap, "/dev/input/%.*s", 5 + n, ev);
            break;
        }
    }
    fclose(f);
}

static void pen_dev_read(void) {
    struct raw_event ev[64];
    for (;;) {
        ssize_t n = read(efd, ev, sizeof ev);
        if (n <= 0) return;
        for (int i = 0; i < n / (ssize_t)sizeof ev[0]; i++) {
            if (ev[i].type != EV_KEY_) continue;
            if (ev[i].code == BTN_STYLUS_ || ev[i].code == BTN_STYLUS2_) pen_button = ev[i].value != 0;
            else if (ev[i].code == BTN_TOOL_PEN_ || ev[i].code == BTN_TOOL_RUBBER_) pen_in_range = ev[i].value != 0;
        }
    }
}

/* ---- the display-list socket: a server on 127.0.0.1:port, one client ---- */

#define LINE_MAX_BYTES (4 << 20)
#define MAX_PRIMS 4096
#define MAX_NUMS (1 << 20)
static int lfd = -1, cfd = -1, cdiscard = 0;
static char *cbuf;
static size_t clen = 0;
static dl_prim *op_prims;
static float *op_nums;

/* What a batch has done so far, applied to the screen at its flush. */
static ink_rect pending = {0, 0, 0, 0};
static int batch_ended_gesture = 0;

static void listen_on(int port) {
    lfd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK | SOCK_CLOEXEC, 0);
    if (lfd < 0) die("socket");
    int one = 1;
    setsockopt(lfd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
    struct sockaddr_in a;
    memset(&a, 0, sizeof a);
    a.sin_family = AF_INET;
    a.sin_port = htons((uint16_t)port);
    a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (bind(lfd, (struct sockaddr *)&a, sizeof a) || listen(lfd, 2)) die("listen");
}

static ink_rect set_connected(int on) {
    mac_connected = on;
    return ink_rect_empty();
}

static void c_close(void) {
    if (cfd >= 0) close(cfd);
    cfd = -1, clen = 0, cdiscard = 0;
}

static void apply_op(const dl_op *op) {
    int i = op->id[0] ? find_item(op->id) : -1;
    switch (op->kind) {
        case DL_CLEAR:
            pending = ink_rect_union(pending, clear_items());
            break;
        case DL_DEL:
            if (i >= 0) {
                if (items[i].flags & DL_LIVE) batch_ended_gesture = 1;
                pending = ink_rect_union(pending, remove_item(i));
            }
            break;
        case DL_PUT:
            pending = ink_rect_union(pending, put_item(op));
            break;
    }
}

static ink_rect settle = {0, 0, 0, 0}; /* shown since the last quality pass */
static double last_activity = 0;

static void flush_batch(void) {
    /* The page has had the pen lift: the trails it now draws itself can go. */
    if (batch_ended_gesture && !pen_down)
        for (int i = ntrails - 1; i >= 0; i--)
            if (trails[i].done) pending = ink_rect_union(pending, trail_drop(i));
    batch_ended_gesture = 0;
    ink_rect r = repaint(ink_rect_union(pending, expired));
    pending = expired = ink_rect_empty();
    if (ink_rect_is_empty(r)) return;
    q_update(r);
    settle = ink_rect_union(settle, r);
    last_activity = now_ms();
}

static void c_read(void) {
    for (;;) {
        if (clen == LINE_MAX_BYTES) { /* a line too long to hold: drop it */
            clen = 0;
            cdiscard = 1;
        }
        ssize_t n = recv(cfd, cbuf + clen, LINE_MAX_BYTES - clen, MSG_DONTWAIT);
        if (n == 0 || (n < 0 && errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR)) {
            c_close();
            fprintf(stderr, "dreamtalk-pad: display list disconnected\n");
            pending = ink_rect_union(pending, set_connected(0));
            flush_batch();
            return;
        }
        if (n < 0) return;
        size_t start = 0, end = clen + (size_t)n;
        for (size_t k = clen; k < end; k++) {
            if (cbuf[k] != '\n') continue;
            if (!cdiscard && k > start) {
                dl_op op;
                int rc = dl_parse(cbuf + start, k - start, &op, op_prims, MAX_PRIMS, op_nums, MAX_NUMS);
                if (rc == 0 && op.kind == DL_FLUSH) flush_batch();
                else if (rc == 0) apply_op(&op);
                else fprintf(stderr, "dreamtalk-pad: skipped a display-list line (%d)\n", rc);
            }
            cdiscard = 0;
            start = k + 1;
        }
        memmove(cbuf, cbuf + start, end - start);
        clen = end - start;
    }
}

static void c_accept(void) {
    int fd = accept4(lfd, NULL, NULL, SOCK_NONBLOCK | SOCK_CLOEXEC);
    if (fd < 0) return;
    if (cfd >= 0) c_close(); /* the newest link wins: an old one may be a dead Wi-Fi session */
    cfd = fd;
    static const char hello[] = "{\"pad\":\"dreamtalk-pad\",\"v\":1}\n";
    send(cfd, hello, sizeof hello - 1, MSG_NOSIGNAL);
    fprintf(stderr, "dreamtalk-pad: display list connected\n");
    pending = ink_rect_union(pending, set_connected(1));
    flush_batch();
}

/* ---- main ---- */

static float env_float(const char *name, float fallback) {
    const char *v = getenv(name);
    return v && *v ? strtof(v, NULL) : fallback;
}

#define TRAIL_TTL_MS 2000.0
#define QUIET_MS 1500.0
/* The CONTENT update must be painted before the switch back: the server
 * sleeps 1 s after the first switch, then paints, then we switch back. */
#define QUALITY_HOLD_MS 1600.0

int main(void) {
    const char *key = getenv("QTFB_KEY");
    if (!key) {
        fprintf(stderr, "dreamtalk-pad: QTFB_KEY is not set; start me from AppLoad\n");
        return 2;
    }
    int port = (int)env_float("DTPAD_PORT", 7777);
    int quality = (int)env_float("DTPAD_QUALITY", 1);
    gate = (int)env_float("DTPAD_GATE", 0);

    struct sigaction sa;
    memset(&sa, 0, sizeof sa);
    sa.sa_handler = on_signal;
    sigaction(SIGTERM, &sa, NULL);
    sigaction(SIGINT, &sa, NULL);
    signal(SIGPIPE, SIG_IGN);

    q_connect((int)strtol(key, NULL, 10));
    ink_rect all = {0, 0, W, H};
    repaint(all);
    q_refresh_mode(QTFB_REFRESH_UFAST);
    q_update_all();
    fprintf(stderr, "dreamtalk-pad: up, %dx%d RGB565, pen waveform UFAST\n", W, H);

    char dev[64];
    const char *want = getenv("DTPAD_PEN_DEV");
    if (want && *want) snprintf(dev, sizeof dev, "%s", want);
    else find_pen_dev(dev, sizeof dev);
    efd = open(dev, O_RDONLY | O_NONBLOCK | O_CLOEXEC);
    if (efd < 0) fprintf(stderr, "dreamtalk-pad: no pen button (%s: %s); the lasso is the page's alone\n", dev, strerror(errno));

    if (port > 0) {
        cbuf = malloc(LINE_MAX_BYTES);
        op_prims = malloc(sizeof(dl_prim) * MAX_PRIMS);
        op_nums = malloc(sizeof(float) * MAX_NUMS);
        if (!cbuf || !op_prims || !op_nums) die("malloc");
        listen_on(port);
    }

    double qpass_back = 0; /* when to switch back to UFAST after a quality pass */
    last_activity = now_ms();

    while (!quitting) {
        struct pollfd fds[4];
        int nfds = 0, iq = -1, ie = -1, il = -1, ic = -1;
        fds[iq = nfds++] = (struct pollfd){qfd, POLLIN, 0};
        if (efd >= 0) fds[ie = nfds++] = (struct pollfd){efd, POLLIN, 0};
        if (lfd >= 0) fds[il = nfds++] = (struct pollfd){lfd, POLLIN, 0};
        if (cfd >= 0) fds[ic = nfds++] = (struct pollfd){cfd, POLLIN, 0};

        /* Timers: trails that outlive the page's answer, and the quality pass. */
        double t = now_ms(), next = -1;
        for (int i = 0; i < ntrails; i++)
            if (trails[i].done) {
                double due = trails[i].ended + TRAIL_TTL_MS;
                if (next < 0 || due < next) next = due;
            }
        if (qpass_back > 0 && (next < 0 || qpass_back < next)) next = qpass_back;
        /* Same condition as the pass itself below — a due time the pass would
         * then refuse (pen hovering) made poll() return at once, forever. */
        if (quality && qpass_back == 0 && !ink_rect_is_empty(settle) && !pen_down && (efd < 0 || !pen_in_range)) {
            double due = last_activity + QUIET_MS;
            if (next < 0 || due < next) next = due;
        }
        int timeout = next < 0 ? -1 : next <= t ? 0 : (int)(next - t) + 1;
        if (poll(fds, (nfds_t)nfds, timeout) < 0) {
            if (errno == EINTR) continue;
            die("poll");
        }
        if (ie >= 0 && fds[ie].revents) {
            pen_dev_read();
            if (fds[ie].revents & (POLLHUP | POLLERR)) { /* the node went away: no button from now on */
                close(efd);
                efd = -1;
            }
        }

        /* Pen first: drain everything queued, draw it, flush one rect. */
        if (fds[iq].revents) {
            ink_rect ink = ink_rect_empty();
            for (;;) {
                struct qtfb_server_msg m;
                ssize_t n = recv(qfd, &m, sizeof m, MSG_DONTWAIT);
                if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) break;
                if (n < 0 && errno == EINTR) continue;
                if (n <= 0) { /* AppLoad closed the framebuffer */
                    quitting = 1;
                    break;
                }
                if (m.type != QTFB_MSG_USERINPUT) continue;
                int type = m.input.input_type, x = m.input.x, y = m.input.y;
                float w = ink_page_width((float)m.input.d / 100.0f);
                if (type == QTFB_INPUT_PEN_PRESS) {
                    /* The kernel had the button long before xochitl passed the
                     * press on; read it now, whatever order poll reported. */
                    if (efd >= 0) pen_dev_read();
                    pen_down = 1;
                    last_activity = now_ms();
                    if (gate) ink = ink_rect_union(ink, repaint(MARKER));
                    if (item_at(DL_NOINK, x, y) >= 0) cur = -1; /* a control: the page acts */
                    else if (pen_button && item_at(DL_GRAB, x, y) >= 0) cur = -1; /* moving the selection */
                    else {
                        cur = trail_start(pen_button);
                        ink = ink_rect_union(ink, trail_add(&trails[cur], (float)x, (float)y, w));
                    }
                } else if (type == QTFB_INPUT_PEN_UPDATE || type == QTFB_INPUT_PEN_RELEASE) {
                    last_activity = now_ms();
                    if (cur >= 0) ink = ink_rect_union(ink, trail_add(&trails[cur], (float)x, (float)y, w));
                    if (type == QTFB_INPUT_PEN_RELEASE) {
                        pen_down = 0;
                        if (cur >= 0 && trails[cur].lasso) {
                            /* A lasso is a gesture, never content: it goes as the pen lifts. */
                            ink_rect gone = trail_drop(cur);
                            ink = ink_rect_union(ink, repaint(gone));
                        } else if (cur >= 0) trails[cur].done = 1, trails[cur].ended = now_ms();
                        cur = -1;
                        if (gate) ink = ink_rect_union(ink, repaint(MARKER));
                    }
                }
            }
            if (!ink_rect_is_empty(ink)) {
                q_update(ink);
                settle = ink_rect_union(settle, ink);
            }
        }

        if (il >= 0 && fds[il].revents) c_accept();
        if (ic >= 0 && cfd >= 0 && fds[ic].revents) c_read();

        t = now_ms();
        /* Trails the page never adopted (a tap on a control, a lost link) fade out. */
        for (int i = ntrails - 1; i >= 0; i--)
            if (trails[i].done && t - trails[i].ended >= TRAIL_TTL_MS) expired = ink_rect_union(expired, trail_drop(i));
        /* ...now, unless a batch is half-way in (then they go with its flush). */
        if (!ink_rect_is_empty(expired) && ink_rect_is_empty(pending) && clen == 0) {
            ink_rect r = repaint(expired);
            expired = ink_rect_empty();
            q_update(r);
            settle = ink_rect_union(settle, r);
        }

        /* The quality pass: all quiet, pen away. */
        if (qpass_back > 0 && t >= qpass_back) {
            q_refresh_mode(QTFB_REFRESH_UFAST);
            qpass_back = 0;
        } else if (quality && qpass_back == 0 && !pen_down && !ink_rect_is_empty(settle) && t - last_activity >= QUIET_MS &&
                   (efd < 0 || !pen_in_range)) {
            q_refresh_mode(QTFB_REFRESH_CONTENT);
            q_update(settle);
            settle = ink_rect_empty();
            qpass_back = t + QUALITY_HOLD_MS;
        }
    }

    struct qtfb_client_msg bye;
    memset(&bye, 0, sizeof bye);
    bye.type = QTFB_MSG_TERMINATE;
    send(qfd, &bye, sizeof bye, MSG_NOSIGNAL);
    return 0;
}
