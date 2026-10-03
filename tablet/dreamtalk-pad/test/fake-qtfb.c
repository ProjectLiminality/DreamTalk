/*
 * fake-qtfb — a stand-in for AppLoad's qtfb server, to run the real
 * dreamtalk-pad binary end to end off the tablet (./build.sh e2e runs both
 * in an emulated armv7 Linux container). It plays the server's side exactly
 * as src/qtfb/fbmanagement.cpp does: SOCK_SEQPACKET on /tmp/qtfb.sock,
 * shm "/qtfb_<key>", 24-byte messages, a DEVICE_STATE_INIT after init. It
 * also plays the Mac's end of the display-list socket on 127.0.0.1:7777.
 *
 * Usage: fake-qtfb <path-to-dreamtalk-pad> <out.ppm>
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
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#include "../ink.h"
#include "../qtfb.h"

#define W QTFB_RM2_WIDTH
#define H QTFB_RM2_HEIGHT
#define KEY 4242
#define SHM_KEY 777

static int failures = 0, checks = 0;
#define CHECK(cond, ...)                                                \
    do {                                                                \
        checks++;                                                       \
        if (!(cond)) {                                                  \
            failures++;                                                 \
            fprintf(stderr, "FAIL %s:%d: ", __FILE__, __LINE__);        \
            fprintf(stderr, __VA_ARGS__);                               \
            fprintf(stderr, "\n");                                      \
        }                                                               \
    } while (0)

static int cfd;
static uint16_t *shm;

static double now(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec + t.tv_nsec / 1e9;
}

/* Next client message within ms, or type 0xFF on timeout. */
static struct qtfb_client_msg next(int ms) {
    struct qtfb_client_msg m;
    memset(&m, 0xFF, sizeof m);
    struct pollfd p = {cfd, POLLIN, 0};
    if (poll(&p, 1, ms) <= 0) return m;
    ssize_t n = recv(cfd, &m, sizeof m, 0);
    if (n != (ssize_t)sizeof m) m.type = 0xFE;
    return m;
}

static void pen(int type, int x, int y, int d) {
    struct qtfb_server_msg m;
    memset(&m, 0, sizeof m);
    m.type = QTFB_MSG_USERINPUT;
    m.input.input_type = type;
    m.input.x = x, m.input.y = y, m.input.d = d;
    send(cfd, &m, sizeof m, 0);
}

static int ink_at(int x, int y) { return shm[y * W + x] != INK_WHITE; }

static int count_ink(int x0, int y0, int x1, int y1) {
    int n = 0;
    for (int y = y0; y < y1; y++)
        for (int x = x0; x < x1; x++) n += ink_at(x, y);
    return n;
}

/* Collect updates until quiet; returns the union of partial rects. */
static ink_rect drain_updates(int ms, int *partials, int *alls, int *modes, int *mode_seq, int *fulls) {
    ink_rect u = ink_rect_empty();
    *partials = *alls = *modes = *fulls = 0;
    for (;;) {
        struct qtfb_client_msg m = next(ms);
        if (m.type == 0xFF) break;
        if (m.type == QTFB_MSG_UPDATE && m.update.type == QTFB_UPDATE_PARTIAL) {
            ink_rect r = {m.update.x, m.update.y, m.update.x + m.update.w, m.update.y + m.update.h};
            u = ink_rect_union(u, r);
            (*partials)++;
        } else if (m.type == QTFB_MSG_UPDATE && m.update.type == QTFB_UPDATE_ALL) {
            (*alls)++;
        } else if (m.type == QTFB_MSG_SET_REFRESH_MODE) {
            if (mode_seq && *modes < 8) mode_seq[*modes] = m.refresh_mode;
            (*modes)++;
        } else if (m.type == QTFB_MSG_REQUEST_FULL_REFRESH) {
            (*fulls)++;
        } else if (m.type == QTFB_MSG_TERMINATE) {
            break;
        } else {
            CHECK(0, "unexpected message type %d", m.type);
        }
    }
    return u;
}

static void dump(const char *path) {
    FILE *f = fopen(path, "wb");
    if (!f) return;
    fprintf(f, "P5\n%d %d\n255\n", W, H);
    for (int i = 0; i < W * H; i++) fputc(ink_grey_from_rgb565(shm[i]), f);
    fclose(f);
}

int main(int argc, char **argv) {
    if (argc < 3) return 2;
    signal(SIGPIPE, SIG_IGN);

    /* Display-list listener first, so the pad finds it on its first try. */
    int lfd = socket(AF_INET, SOCK_STREAM, 0);
    int one = 1;
    setsockopt(lfd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
    struct sockaddr_in a = {.sin_family = AF_INET, .sin_port = htons(7777), .sin_addr.s_addr = htonl(INADDR_LOOPBACK)};
    if (bind(lfd, (struct sockaddr *)&a, sizeof a) || listen(lfd, 1)) return perror("tcp"), 1;

    int sfd = socket(AF_UNIX, SOCK_SEQPACKET, 0);
    struct sockaddr_un addr = {.sun_family = AF_UNIX};
    strcpy(addr.sun_path, QTFB_SOCKET_PATH);
    unlink(QTFB_SOCKET_PATH);
    if (bind(sfd, (struct sockaddr *)&addr, sizeof addr) || listen(sfd, 4)) return perror("unix"), 1;

    pid_t pid = fork();
    if (pid == 0) {
        setenv("QTFB_KEY", "4242", 1);
        execl(argv[1], argv[1], (char *)NULL);
        _exit(127);
    }
    cfd = accept(sfd, NULL, NULL);

    /* Handshake */
    struct qtfb_client_msg init = next(5000);
    CHECK(init.type == QTFB_MSG_INITIALIZE && init.init.key == KEY && init.init.format == QTFB_FBFMT_RM2FB,
          "init: type %d key %d fmt %d", init.type, init.init.key, init.init.format);
    size_t size = (size_t)W * H * 2;
    char name[32];
    snprintf(name, sizeof name, QTFB_SHM_NAME_FMT, SHM_KEY);
    shm_unlink(name);
    int fd = shm_open(name, O_RDWR | O_CREAT, 0666);
    if (fd < 0 || ftruncate(fd, (off_t)size)) return perror("shm"), 1;
    shm = mmap(NULL, size, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    memset(shm, 0x00, size); /* black: the pad must clear it itself */
    struct qtfb_server_msg reply;
    memset(&reply, 0, sizeof reply);
    reply.type = QTFB_MSG_INITIALIZE;
    reply.init.shm_key = SHM_KEY, reply.init.shm_size = size;
    send(cfd, &reply, sizeof reply, 0);
    struct qtfb_server_msg state;
    memset(&state, 0, sizeof state);
    state.type = QTFB_MSG_DEVICE_STATE_INIT; /* rotation 0, as the server sends after init */
    send(cfd, &state, sizeof state, 0);

    int partials, alls, modes, fulls, seq[8];
    drain_updates(1500, &partials, &alls, &modes, seq, &fulls);
    CHECK(modes == 1 && seq[0] == QTFB_REFRESH_UFAST, "startup sets UFAST (modes %d, first %d)", modes, seq[0]);
    CHECK(alls == 1, "startup sends one full update (%d)", alls);
    CHECK(count_ink(100, 100, W - 100, H - 100) == 0, "page cleared to white");
    CHECK(count_ink(16, 16, 64, 64) > 0 && count_ink(W - 64, 16, W - 16, 64) > 0, "chrome drawn");

    /* A stroke: press, 30 updates, release. Each sample should come back as
     * one small partial update; time the round trip. */
    double worst = 0, total = 0;
    int samples = 0;
    pen(QTFB_INPUT_PEN_PRESS, 300, 400, 20);
    drain_updates(300, &partials, &alls, &modes, NULL, &fulls);
    CHECK(partials == 2, "press -> ink + marker updates (%d)", partials);
    CHECK(count_ink(W - 60, 20, W - 20, 60) > 1000, "marker black while pen down");
    for (int i = 1; i <= 30; i++) {
        int x = 300 + i * 10, y = 400 + i * 3, d = 20 + i * 2;
        double t0 = now();
        pen(QTFB_INPUT_PEN_UPDATE, x, y, d);
        struct qtfb_client_msg m = next(2000);
        double dt = now() - t0;
        total += dt, samples++;
        if (dt > worst) worst = dt;
        CHECK(m.type == QTFB_MSG_UPDATE && m.update.type == QTFB_UPDATE_PARTIAL, "sample %d -> partial update (type %d)", i, m.type);
        ink_rect r = {m.update.x, m.update.y, m.update.x + m.update.w, m.update.y + m.update.h};
        CHECK(r.x0 <= x && x < r.x1 && r.y0 <= y && y < r.y1, "sample %d rect %d,%d %dx%d holds the nib", i, r.x0, r.y0, m.update.w, m.update.h);
        CHECK(m.update.w <= 24 && m.update.h <= 24, "sample %d rect is small (%dx%d)", i, m.update.w, m.update.h);
        CHECK(ink_at(x, y), "ink under the nib at sample %d", i);
    }
    pen(QTFB_INPUT_PEN_RELEASE, 600, 490, 80);
    drain_updates(300, &partials, &alls, &modes, NULL, &fulls);
    CHECK(count_ink(W - 60, 20, W - 20, 60) == 0, "marker white after release");
    /* Pressure: the stroke is thicker at its end (d 80) than its start (d 22). */
    int thin = 0, thick = 0;
    for (int y = 380; y < 520; y++) thin += ink_at(320, y), thick += ink_at(580, y);
    CHECK(thin < thick, "pressure widens the line: %d px at start, %d near end", thin, thick);
    printf("pen sample -> update round trip (emulated, not device latency): mean %.2f ms, worst %.2f ms\n",
           1000 * total / samples, 1000 * worst);

    /* Display list over TCP, as the Mac's reverse tunnel would deliver it. */
    int dfd = -1;
    struct pollfd lp = {lfd, POLLIN, 0};
    if (poll(&lp, 1, 5000) > 0) dfd = accept(lfd, NULL, NULL);
    CHECK(dfd >= 0, "pad connected to the display-list port");
    const char *lines =
        "{\"kind\":\"draw\",\"id\":\"sym\",\"points\":[[700,900],[900,900],[800,1073],[700,900]],\"width\":4}\n"
        "this is not json\n"
        "{\"kind\":\"draw\",\"id\":\"dot\",\"points\":[1000,1200],\"width\":30}\n";
    if (dfd >= 0) send(dfd, lines, strlen(lines), 0);
    ink_rect u = drain_updates(2500, &partials, &alls, &modes, seq, &fulls);
    CHECK(modes == 2 && seq[0] == QTFB_REFRESH_CONTENT && seq[1] == QTFB_REFRESH_UFAST, "symbols: CONTENT then back to UFAST (%d modes)", modes);
    CHECK(partials == 1 && u.x0 <= 698 && u.y0 <= 898 && u.x1 >= 1015 && u.y1 >= 1215, "one partial update covering both items: %d,%d,%d,%d", u.x0, u.y0, u.x1, u.y1);
    CHECK(ink_at(800, 900) && ink_at(1000, 1200), "triangle and dot drawn");
    dump(argv[2]);

    /* Replace an item by id: the old one is erased. */
    const char *again = "{\"kind\":\"draw\",\"id\":\"dot\",\"points\":[[1100,1300]],\"width\":10}\n";
    send(dfd, again, strlen(again), 0);
    drain_updates(2500, &partials, &alls, &modes, seq, &fulls);
    CHECK(!ink_at(1000, 1200) && ink_at(1100, 1300), "redraw by id moves the dot");

    /* Tap the clear box: page wiped, full update + full refresh. */
    pen(QTFB_INPUT_PEN_PRESS, 40, 40, 50);
    pen(QTFB_INPUT_PEN_RELEASE, 40, 40, 50);
    drain_updates(600, &partials, &alls, &modes, seq, &fulls);
    CHECK(alls == 1 && fulls == 1, "clear: %d full updates, %d full refreshes", alls, fulls);
    CHECK(count_ink(100, 100, W - 100, H - 100) == 0, "page is white again");
    CHECK(count_ink(16, 16, 64, 64) > 0, "chrome survives the clear");

    /* AppLoad closes the framebuffer: the pad exits cleanly. */
    close(cfd);
    int status = -1;
    for (int i = 0; i < 50 && waitpid(pid, &status, WNOHANG) == 0; i++) usleep(100000);
    CHECK(WIFEXITED(status) && WEXITSTATUS(status) == 0, "pad exited cleanly (status %d)", status);

    printf("e2e: %d/%d checks passed\n", checks - failures, checks);
    return failures ? 1 : 0;
}
