/*
 * dreamtalk-pad — DreamTalk's page on the reMarkable 2's own screen.
 *
 * An AppLoad "external" app with a qtfb framebuffer: it runs fullscreen
 * inside xochitl, which keeps the display, sleep and the OS. This first cut
 * is the latency gate from docs/reports/remarkable-display.md §6 step 5:
 *
 *   - connect to qtfb, ask for FBFMT_RM2FB (RGB565, 1404x1872 — exactly
 *     DreamTalk's PAGE_W x PAGE_H, so page units are pixels), clear to white;
 *   - draw the pen trail locally, pressure-scaled, 1-bit, and flush only
 *     the changed rectangle in the UFAST (xochitl "Pen") waveform;
 *   - a corner marker that is black exactly while the app sees the pen down,
 *     for counting frames in a 240 fps video;
 *   - a box in the top-left corner: tap it with the pen to clear the page;
 *   - and, for the symbols to come, a display list read from TCP
 *     127.0.0.1:7777 (newline-delimited JSON, see ink.h), drawn
 *     anti-aliased and flushed in the CONTENT waveform.
 *
 * The wire protocol is in qtfb.h, with the upstream files and commit it was
 * read from. The drawing itself is in ink.c and is tested on the Mac.
 *
 * Environment (all optional): DTPAD_WMIN / DTPAD_WMAX — pen width in pixels
 * at zero / full pressure (default 2 / 6); DTPAD_PORT — display-list port
 * (default 7777, 0 turns it off). QTFB_KEY is set by AppLoad.
 */
#define _GNU_SOURCE
#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
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

/* Chrome: the clear box (top-left) and the contact marker (top-right). */
#define CHROME_SIZE 48
#define CHROME_MARGIN 16
static const ink_rect CLEAR_BOX = {CHROME_MARGIN, CHROME_MARGIN, CHROME_MARGIN + CHROME_SIZE, CHROME_MARGIN + CHROME_SIZE};
static const ink_rect MARKER = {W - CHROME_MARGIN - CHROME_SIZE, CHROME_MARGIN, W - CHROME_MARGIN, CHROME_MARGIN + CHROME_SIZE};

static volatile sig_atomic_t quitting = 0;
static void on_signal(int sig) {
    (void)sig;
    quitting = 1;
}

static int qfd = -1;
static ink_canvas page;
static int refresh_mode = -1;

static void die(const char *what) {
    fprintf(stderr, "dreamtalk-pad: %s: %s\n", what, errno ? strerror(errno) : "failed");
    exit(1);
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

static void q_full_refresh(void) {
    struct qtfb_client_msg m;
    memset(&m, 0, sizeof m);
    m.type = QTFB_MSG_REQUEST_FULL_REFRESH;
    q_send(&m);
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
}

/* ---- drawing ---- */

static ink_rect outline(ink_rect r) {
    float x0 = r.x0 + 0.5f, y0 = r.y0 + 0.5f, x1 = r.x1 - 0.5f, y1 = r.y1 - 0.5f;
    ink_rect d = ink_segment(&page, x0, y0, 1, x1, y0, 1, 0);
    d = ink_rect_union(d, ink_segment(&page, x1, y0, 1, x1, y1, 1, 0));
    d = ink_rect_union(d, ink_segment(&page, x1, y1, 1, x0, y1, 1, 0));
    return ink_rect_union(d, ink_segment(&page, x0, y1, 1, x0, y0, 1, 0));
}

static ink_rect draw_chrome(void) {
    ink_rect d = outline(CLEAR_BOX);
    float i = 12; /* the X inside the clear box */
    d = ink_rect_union(d, ink_segment(&page, CLEAR_BOX.x0 + i, CLEAR_BOX.y0 + i, 1.5f, CLEAR_BOX.x1 - i, CLEAR_BOX.y1 - i, 1.5f, 0));
    d = ink_rect_union(d, ink_segment(&page, CLEAR_BOX.x1 - i, CLEAR_BOX.y0 + i, 1.5f, CLEAR_BOX.x0 + i, CLEAR_BOX.y1 - i, 1.5f, 0));
    return ink_rect_union(d, outline(MARKER));
}

static ink_rect set_marker(int down) {
    ink_rect inner = {MARKER.x0 + 4, MARKER.y0 + 4, MARKER.x1 - 4, MARKER.y1 - 4};
    return ink_fill(&page, inner, down ? INK_BLACK : INK_WHITE);
}

static int inside(ink_rect r, int x, int y) { return x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1; }

/* ---- display list ---- */

#define MAX_ITEMS 512
#define MAX_POINTS 16384
static struct {
    char id[DL_ID_MAX];
    ink_rect r;
} items[MAX_ITEMS];
static int nitems = 0;
static float pts[MAX_POINTS * 2];

static int find_item(const char *id) {
    for (int i = 0; i < nitems; i++)
        if (!strcmp(items[i].id, id)) return i;
    return -1;
}

static ink_rect clear_page(void) {
    ink_rect all = {0, 0, W, H};
    ink_fill(&page, all, INK_WHITE);
    draw_chrome();
    nitems = 0;
    return all;
}

/* Erase an item's rectangle (anything else under it goes too — this is a
 * prototype; the page will own layout) and forget it. */
static ink_rect erase_item(int i) {
    ink_rect r = ink_fill(&page, items[i].r, INK_WHITE);
    items[i] = items[--nitems];
    return ink_rect_union(r, draw_chrome());
}

static ink_rect apply(const dl_cmd *cmd) {
    ink_rect dirty = ink_rect_empty();
    int i = cmd->id[0] ? find_item(cmd->id) : -1;
    switch (cmd->kind) {
        case DL_CLEAR:
            return clear_page();
        case DL_REMOVE:
            return i >= 0 ? erase_item(i) : dirty;
        case DL_DRAW: {
            if (i >= 0) dirty = erase_item(i);
            float r = (cmd->width > 0 ? cmd->width : 3.0f) * 0.5f;
            ink_rect drawn = ink_rect_empty();
            const float *p = cmd->pts;
            if (cmd->npts == 1) drawn = ink_segment(&page, p[0], p[1], r, p[0], p[1], r, 1);
            for (int k = 1; k < cmd->npts; k++)
                drawn = ink_rect_union(drawn, ink_segment(&page, p[2 * k - 2], p[2 * k - 1], r, p[2 * k], p[2 * k + 1], r, 1));
            if (cmd->id[0] && nitems < MAX_ITEMS && !ink_rect_is_empty(drawn)) {
                memcpy(items[nitems].id, cmd->id, DL_ID_MAX);
                items[nitems++].r = drawn;
            }
            return ink_rect_union(dirty, drawn);
        }
    }
    return dirty;
}

/* ---- display-list socket (client of 127.0.0.1:port, reconnecting) ---- */

#define LINE_MAX_BYTES (1 << 20)
static int tfd = -1, tconnecting = 0, tdiscard = 0;
static char *tbuf;
static size_t tlen = 0;
static struct timespec tnext;

static double now_s(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec + ts.tv_nsec / 1e9;
}

static void t_close(void) {
    if (tfd >= 0) close(tfd);
    tfd = -1, tconnecting = 0, tlen = 0, tdiscard = 0;
    double next = now_s() + 2.0;
    tnext.tv_sec = (time_t)next;
    tnext.tv_nsec = (long)((next - (double)tnext.tv_sec) * 1e9);
}

static void t_try_connect(int port) {
    tfd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK | SOCK_CLOEXEC, 0);
    if (tfd < 0) {
        t_close();
        return;
    }
    struct sockaddr_in a;
    memset(&a, 0, sizeof a);
    a.sin_family = AF_INET;
    a.sin_port = htons((uint16_t)port);
    a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (connect(tfd, (struct sockaddr *)&a, sizeof a) == 0) tconnecting = 0;
    else if (errno == EINPROGRESS) tconnecting = 1;
    else t_close();
}

/* Read what's there; returns the dirty rect of everything drawn. */
static ink_rect t_read(void) {
    ink_rect dirty = ink_rect_empty();
    for (;;) {
        if (tlen == LINE_MAX_BYTES) { /* a line too long to hold: drop it */
            tlen = 0;
            tdiscard = 1;
        }
        ssize_t n = recv(tfd, tbuf + tlen, LINE_MAX_BYTES - tlen, MSG_DONTWAIT);
        if (n == 0 || (n < 0 && errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR)) {
            t_close();
            return dirty;
        }
        if (n < 0) return dirty;
        size_t start = 0, end = tlen + (size_t)n;
        for (size_t k = tlen; k < end; k++) {
            if (tbuf[k] != '\n') continue;
            if (!tdiscard) {
                dl_cmd cmd;
                int rc = dl_parse(tbuf + start, k - start, &cmd, pts, MAX_POINTS);
                if (rc == 0) dirty = ink_rect_union(dirty, apply(&cmd));
                else if (k > start) fprintf(stderr, "dreamtalk-pad: skipped a display-list line (%d)\n", rc);
            }
            tdiscard = 0;
            start = k + 1;
        }
        memmove(tbuf, tbuf + start, end - start);
        tlen = end - start;
    }
}

/* ---- main ---- */

static float env_float(const char *name, float fallback) {
    const char *v = getenv(name);
    return v && *v ? strtof(v, NULL) : fallback;
}

int main(void) {
    const char *key = getenv("QTFB_KEY");
    if (!key) {
        fprintf(stderr, "dreamtalk-pad: QTFB_KEY is not set; start me from AppLoad\n");
        return 2;
    }
    float wmin = env_float("DTPAD_WMIN", 2.0f), wmax = env_float("DTPAD_WMAX", 6.0f);
    int port = (int)env_float("DTPAD_PORT", 7777);

    struct sigaction sa;
    memset(&sa, 0, sizeof sa);
    sa.sa_handler = on_signal;
    sigaction(SIGTERM, &sa, NULL);
    sigaction(SIGINT, &sa, NULL);
    signal(SIGPIPE, SIG_IGN);

    q_connect((int)strtol(key, NULL, 10));
    clear_page();
    q_refresh_mode(QTFB_REFRESH_UFAST);
    q_update_all();
    fprintf(stderr, "dreamtalk-pad: up, %dx%d RGB565, pen waveform UFAST\n", W, H);

    if (port > 0) {
        tbuf = malloc(LINE_MAX_BYTES);
        if (!tbuf) die("malloc");
        t_close();
        tnext.tv_sec = 0; /* first attempt right away */
    }

    int down = 0, in_clear = 0;
    float lx = 0, ly = 0, lr = 0;

    while (!quitting) {
        struct pollfd fds[2] = {{qfd, POLLIN, 0}, {tfd, tconnecting ? POLLOUT : POLLIN, 0}};
        int nfds = 1, timeout = -1;
        if (port > 0) {
            if (tfd >= 0) nfds = 2;
            else {
                double wait = (tnext.tv_sec + tnext.tv_nsec / 1e9) - now_s();
                if (wait <= 0) {
                    t_try_connect(port);
                    continue;
                }
                timeout = (int)(wait * 1000) + 1;
            }
        }
        if (poll(fds, nfds, timeout) < 0) {
            if (errno == EINTR) continue;
            die("poll");
        }

        /* Pen first: drain everything queued, draw it, flush one rect. */
        if (fds[0].revents) {
            ink_rect ink = ink_rect_empty(), mark = ink_rect_empty();
            int cleared = 0;
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
                int t = m.input.input_type, x = m.input.x, y = m.input.y;
                /* Pressure may be 0 if Qt synthesised the mouse event without it. */
                float r = ink_pressure_radius(m.input.d > 0 ? m.input.d : 50, wmin, wmax);
                if (t == QTFB_INPUT_PEN_PRESS) {
                    mark = ink_rect_union(mark, set_marker(1));
                    in_clear = inside(CLEAR_BOX, x, y);
                    if (in_clear) continue;
                    down = 1, lx = (float)x, ly = (float)y, lr = r;
                    ink = ink_rect_union(ink, ink_segment(&page, lx, ly, r, lx, ly, r, 0));
                } else if (t == QTFB_INPUT_PEN_UPDATE || t == QTFB_INPUT_PEN_RELEASE) {
                    if (down) {
                        ink = ink_rect_union(ink, ink_segment(&page, lx, ly, lr, (float)x, (float)y, r, 0));
                        lx = (float)x, ly = (float)y, lr = r;
                    }
                    if (t == QTFB_INPUT_PEN_RELEASE) {
                        mark = ink_rect_union(mark, set_marker(0));
                        if (in_clear && inside(CLEAR_BOX, x, y)) cleared = 1;
                        down = 0, in_clear = 0;
                    }
                }
            }
            if (cleared) {
                clear_page();
                q_update_all();
                q_full_refresh();
            } else {
                q_update(ink);
                q_update(mark);
            }
        }

        if (nfds == 2 && fds[1].revents) {
            if (tconnecting) {
                int err = 0;
                socklen_t len = sizeof err;
                getsockopt(tfd, SOL_SOCKET, SO_ERROR, &err, &len);
                if (err) t_close();
                else {
                    tconnecting = 0;
                    fprintf(stderr, "dreamtalk-pad: display list connected on port %d\n", port);
                }
            } else {
                ink_rect d = t_read();
                if (!ink_rect_is_empty(d)) {
                    /* Settled symbols: one quality update, then back to the pen. */
                    q_refresh_mode(QTFB_REFRESH_CONTENT);
                    q_update(d);
                    q_refresh_mode(QTFB_REFRESH_UFAST);
                }
            }
        }
    }

    struct qtfb_client_msg bye;
    memset(&bye, 0, sizeof bye);
    bye.type = QTFB_MSG_TERMINATE;
    send(qfd, &bye, sizeof bye, MSG_NOSIGNAL);
    return 0;
}
