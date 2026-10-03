/*
 * fake-qtfb — a stand-in for AppLoad's qtfb server AND the Mac's bridge, to
 * run the real dreamtalk-pad binary end to end off the tablet (./build.sh
 * e2e runs both in an emulated armv7 Linux container).
 *
 *   qtfb      as src/qtfb/fbmanagement.cpp does it: SOCK_SEQPACKET on
 *             /tmp/qtfb.sock, shm "/qtfb_<key>", 24-byte messages, a
 *             DEVICE_STATE_INIT after init; pen input as USERINPUT.
 *   the pen   a FIFO standing in for the digitizer's evdev node
 *             (DTPAD_PEN_DEV), carrying the side button and range.
 *   the Mac   connects to the pad's display-list port 127.0.0.1:7777, as
 *             `ssh -W` does, and sends batches of ops.
 *
 * Usage: fake-qtfb <path-to-dreamtalk-pad> <out.pgm> [display.ndjson]
 * With a display list file (core/scripts/mirror-e2e.ts writes one from the
 * real whiteboard page), the last act sends it and dumps the page it drew.
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
#include <sys/stat.h>
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
#define PEN_FIFO "/tmp/dtpad-pen"

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

static int cfd, mac = -1, penfd = -1;
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

/* One evdev key change + SYN, as the 32-bit kernel writes them (16 bytes each). */
static void evdev_key(int code, int value) {
    struct {
        uint32_t sec, usec;
        uint16_t type, code;
        int32_t value;
    } ev[2] = {{0, 0, 1, (uint16_t)code, value}, {0, 0, 0, 0, 0}};
    if (write(penfd, ev, sizeof ev) != (ssize_t)sizeof ev) perror("evdev write");
    usleep(50000); /* let the pad read it before the qtfb event that follows */
}

static void mac_send(const char *s) {
    size_t n = strlen(s);
    while (n) {
        ssize_t k = send(mac, s, n, MSG_NOSIGNAL);
        if (k <= 0) return;
        s += k, n -= (size_t)k;
    }
}

static int ink_at(int x, int y) { return shm[y * W + x] != INK_WHITE; }

static int count_ink(int x0, int y0, int x1, int y1) {
    int n = 0;
    for (int y = y0; y < y1; y++)
        for (int x = x0; x < x1; x++) n += ink_at(x, y);
    return n;
}

typedef struct {
    ink_rect u;
    int partials, alls, modes, fulls, seq[8];
} updates;

/* Collect updates until quiet for ms. */
static updates drain(int ms) {
    updates r;
    memset(&r, 0, sizeof r);
    for (;;) {
        struct qtfb_client_msg m = next(ms);
        if (m.type == 0xFF) break;
        if (m.type == QTFB_MSG_UPDATE && m.update.type == QTFB_UPDATE_PARTIAL) {
            ink_rect q = {m.update.x, m.update.y, m.update.x + m.update.w, m.update.y + m.update.h};
            r.u = ink_rect_union(r.u, q);
            r.partials++;
        } else if (m.type == QTFB_MSG_UPDATE && m.update.type == QTFB_UPDATE_ALL) {
            r.alls++;
        } else if (m.type == QTFB_MSG_SET_REFRESH_MODE) {
            if (r.modes < 8) r.seq[r.modes] = m.refresh_mode;
            r.modes++;
        } else if (m.type == QTFB_MSG_REQUEST_FULL_REFRESH) {
            r.fulls++;
        } else if (m.type == QTFB_MSG_TERMINATE) {
            break;
        } else {
            CHECK(0, "unexpected message type %d", m.type);
        }
    }
    return r;
}

static void dump(const char *path) {
    FILE *f = fopen(path, "wb");
    if (!f) return;
    fprintf(f, "P5\n%d %d\n255\n", W, H);
    for (int i = 0; i < W * H; i++) fputc(ink_grey_from_rgb565(shm[i]), f);
    fclose(f);
}

/* A horizontal stroke as page ink: one line prim with per-point widths. */
static void put_line(char *buf, size_t cap, const char *id, int z, const char *flags, int x0, int y, int x1, int w) {
    snprintf(buf, cap, "{\"op\":\"put\",\"id\":\"%s\",\"z\":%d%s,\"prims\":[{\"k\":\"line\",\"pts\":[%d,%d,%d,%d],\"w\":[%d,%d]}]}\n",
             id, z, flags, x0, y, x1, y, w, w);
}

int main(int argc, char **argv) {
    if (argc < 3) return 2;
    signal(SIGPIPE, SIG_IGN);

    unlink(PEN_FIFO);
    if (mkfifo(PEN_FIFO, 0600)) return perror("mkfifo"), 1;
    penfd = open(PEN_FIFO, O_RDWR); /* RDWR: never blocks, never EOF for the reader */
    if (penfd < 0) return perror("fifo"), 1;

    int sfd = socket(AF_UNIX, SOCK_SEQPACKET, 0);
    struct sockaddr_un addr = {.sun_family = AF_UNIX};
    strcpy(addr.sun_path, QTFB_SOCKET_PATH);
    unlink(QTFB_SOCKET_PATH);
    if (bind(sfd, (struct sockaddr *)&addr, sizeof addr) || listen(sfd, 4)) return perror("unix"), 1;

    pid_t pid = fork();
    if (pid == 0) {
        setenv("QTFB_KEY", "4242", 1);
        setenv("DTPAD_PEN_DEV", PEN_FIFO, 1);
        execl(argv[1], argv[1], (char *)NULL);
        _exit(127);
    }
    cfd = accept(sfd, NULL, NULL);

    /* ---- handshake ---- */
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

    updates u = drain(1500);
    CHECK(u.modes == 1 && u.seq[0] == QTFB_REFRESH_UFAST, "startup sets UFAST (modes %d, first %d)", u.modes, u.seq[0]);
    CHECK(u.alls == 1, "startup sends one full update (%d)", u.alls);
    CHECK(count_ink(0, 60, W, H) == 0, "page cleared to white");
    CHECK(count_ink(W - 40, 16, W - 16, 40) > 0, "a hollow dot: no Mac yet");

    /* ---- the Mac connects, as ssh -W does, and is greeted ---- */
    for (int i = 0; i < 100 && mac < 0; i++) {
        int s = socket(AF_INET, SOCK_STREAM, 0);
        struct sockaddr_in a = {.sin_family = AF_INET, .sin_port = htons(7777), .sin_addr.s_addr = htonl(INADDR_LOOPBACK)};
        if (connect(s, (struct sockaddr *)&a, sizeof a) == 0) mac = s;
        else close(s), usleep(50000);
    }
    CHECK(mac >= 0, "the pad listens on 127.0.0.1:7777");
    char hello[128] = "";
    struct pollfd hp = {mac, POLLIN, 0};
    if (poll(&hp, 1, 3000) > 0) recv(mac, hello, sizeof hello - 1, 0);
    CHECK(strstr(hello, "\"pad\":\"dreamtalk-pad\"") != NULL, "hello line: %s", hello);
    u = drain(500);
    CHECK(count_ink(W - 40, 16, W - 16, 40) == 0 && u.partials >= 1, "the dot goes once the Mac is there");

    /* ---- a stroke: every sample comes back at once as one small update ---- */
    evdev_key(320, 1); /* BTN_TOOL_PEN: in range */
    double worst = 0, total = 0;
    int samples = 0;
    pen(QTFB_INPUT_PEN_PRESS, 300, 400, 20);
    u = drain(300);
    CHECK(u.partials == 1, "press -> one ink update (%d)", u.partials);
    /* The page's echo of the gesture in progress arrives (elsewhere, to tell it
     * apart): skipped while the pen is down — the trail is drawing it. */
    char line[512];
    put_line(line, sizeof line, "live", 50, ",\"live\":true", 300, 470, 600, 4);
    mac_send(line);
    mac_send("{\"op\":\"flush\"}\n");
    drain(400);
    CHECK(count_ink(300, 460, 600, 480) == 0, "live item not drawn under a pen that's down");
    for (int i = 1; i <= 30; i++) {
        int x = 300 + i * 10, y = 400, d = 20 + i * 2;
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
    pen(QTFB_INPUT_PEN_RELEASE, 600, 400, 80);
    drain(300);
    CHECK(ink_at(450, 400), "the trail stays after the lift");
    printf("pen sample -> update round trip (emulated, not device latency): mean %.2f ms, worst %.2f ms\n",
           1000 * total / samples, 1000 * worst);

    /* The page ends the gesture: the live echo goes, the stroke arrives as an
     * item on the same pixels. The trail hands over without a gap. */
    put_line(line, sizeof line, "ink:s1", 20, "", 300, 400, 600, 5);
    mac_send("{\"op\":\"del\",\"id\":\"live\"}\n");
    mac_send(line);
    mac_send("{\"op\":\"flush\"}\n");
    u = drain(500);
    CHECK(u.partials == 1 && u.u.x0 <= 300 && u.u.x1 >= 600, "one update for the handover %d,%d,%d,%d", u.u.x0, u.u.y0, u.u.x1, u.u.y1);
    CHECK(ink_at(450, 400) && ink_at(300, 400) && ink_at(599, 400), "the page's stroke is there");
    CHECK(count_ink(300, 460, 600, 480) == 0, "and the echo is gone");
    int thick = 0;
    for (int y = 390; y < 411; y++) thick += ink_at(450, y);
    CHECK(thick <= 7, "not darkened twice: the item replaced the trail (%d px tall)", thick);

    /* ---- the button: a dashed lasso, local, gone when nothing adopts it ---- */
    evdev_key(331, 1); /* BTN_STYLUS */
    pen(QTFB_INPUT_PEN_PRESS, 300, 800, 50);
    for (int i = 1; i <= 40; i++) pen(QTFB_INPUT_PEN_UPDATE, 300 + i * 10, 800, 50);
    pen(QTFB_INPUT_PEN_RELEASE, 700, 800, 50);
    drain(300); /* the hand lets go of the button after the stroke, not 2 ms into it */
    evdev_key(331, 0);
    int on = 0;
    for (int x = 300; x < 700; x++) on += ink_at(x, 800);
    CHECK(on > 120 && on < 300, "lasso is dashed: %d of 400 px on", on);
    usleep(2300000); /* longer than the trail's 2 s */
    drain(300);
    CHECK(count_ink(290, 790, 710, 811) == 0, "an unadopted lasso fades after 2 s");

    /* ---- controls take the tip: no trail on a noInk item ---- */
    mac_send("{\"op\":\"put\",\"id\":\"chrome:chip\",\"z\":40,\"noInk\":true,\"prims\":[{\"k\":\"fill\",\"pts\":[1000,1000,1040,1000,1040,1040,1000,1040],\"grey\":255},"
             "{\"k\":\"line\",\"pts\":[1000,1000,1040,1000,1040,1040,1000,1040,1000,1000],\"w\":2}]}\n{\"op\":\"flush\"}\n");
    drain(300);
    int before = count_ink(1003, 1003, 1037, 1037);
    pen(QTFB_INPUT_PEN_PRESS, 1020, 1020, 50);
    pen(QTFB_INPUT_PEN_UPDATE, 1022, 1021, 50);
    pen(QTFB_INPUT_PEN_RELEASE, 1022, 1021, 50);
    drain(300);
    CHECK(before == 0 && count_ink(1003, 1003, 1037, 1037) == 0, "a tap on a control leaves no ink");

    /* ---- removal repaints only what it uncovers, neighbours intact ---- */
    put_line(line, sizeof line, "A", 10, "", 100, 1300, 500, 30);
    mac_send(line);
    put_line(line, sizeof line, "B", 20, "", 300, 1310, 700, 4);
    mac_send(line);
    mac_send("{\"op\":\"flush\"}\n");
    drain(300);
    CHECK(ink_at(200, 1300) && ink_at(650, 1310), "A and B drawn");
    mac_send("{\"op\":\"del\",\"id\":\"A\"}\n{\"op\":\"flush\"}\n");
    u = drain(300);
    CHECK(!ink_at(200, 1300) && ink_at(400, 1310) && ink_at(650, 1310), "A gone, B intact where it crossed A");
    CHECK(u.partials == 1 && u.u.x0 >= 80 && u.u.x1 <= 520, "the update is A's rect only: %d,%d,%d,%d", u.u.x0, u.u.y0, u.u.x1, u.u.y1);
    /* A white fill above ink knocks it out (z order), and moving it uncovers. */
    mac_send("{\"op\":\"put\",\"id\":\"K\",\"z\":30,\"prims\":[{\"k\":\"fill\",\"pts\":[380,1290,420,1290,420,1330,380,1330],\"grey\":255}]}\n{\"op\":\"flush\"}\n");
    drain(300);
    CHECK(!ink_at(400, 1310) && ink_at(450, 1310), "knockout over B");
    mac_send("{\"op\":\"del\",\"id\":\"K\"}\n{\"op\":\"flush\"}\n");
    drain(300);
    CHECK(ink_at(400, 1310), "B back");

    /* ---- the quality pass: all quiet and the pen away ---- */
    evdev_key(320, 0); /* out of range */
    u = drain(2400);
    CHECK(u.modes >= 1 && u.seq[0] == QTFB_REFRESH_CONTENT && u.partials >= 1, "quiet -> CONTENT + update (%d modes, %d updates)", u.modes, u.partials);
    CHECK(u.modes == 2 && u.seq[1] == QTFB_REFRESH_UFAST, "then back to UFAST for the pen (%d modes)", u.modes);

    /* ---- a whole page from the real whiteboard, or a small one ---- */
    if (argc > 3) {
        FILE *f = fopen(argv[3], "rb");
        CHECK(f != NULL, "display list %s", argv[3]);
        if (f) {
            static char chunk[1 << 16];
            size_t n;
            while ((n = fread(chunk, 1, sizeof chunk - 1, f)) > 0) {
                chunk[n] = 0;
                mac_send(chunk);
            }
            fclose(f);
        }
    } else {
        mac_send("{\"op\":\"clear\"}\n"
                 "{\"op\":\"put\",\"id\":\"sym\",\"z\":10,\"prims\":[{\"k\":\"line\",\"pts\":[700,900,900,900,800,1073,700,900],\"w\":4}]}\n"
                 "this is not json\n"
                 "{\"op\":\"put\",\"id\":\"dot\",\"z\":20,\"prims\":[{\"k\":\"line\",\"pts\":[1000,1200],\"w\":30}]}\n"
                 "{\"op\":\"flush\"}\n");
    }
    u = drain(argc > 3 ? 4000 : 1500);
    CHECK(u.partials >= 1, "the page drew (%d updates)", u.partials);
    if (argc <= 3) CHECK(ink_at(800, 900) && ink_at(1000, 1200) && !ink_at(400, 1310), "clear, then the triangle and the dot");
    dump(argv[2]);

    /* ---- the Mac goes: the dot says so; the page stays ---- */
    int kept = count_ink(0, 60, W, H);
    close(mac);
    drain(500);
    CHECK(count_ink(W - 40, 16, W - 16, 40) > 0 && count_ink(0, 60, W, H) == kept, "dot back, page kept");

    /* ---- AppLoad closes the framebuffer: the pad exits cleanly ---- */
    close(cfd);
    int status = -1;
    for (int i = 0; i < 50 && waitpid(pid, &status, WNOHANG) == 0; i++) usleep(100000);
    CHECK(WIFEXITED(status) && WEXITSTATUS(status) == 0, "pad exited cleanly (status %d)", status);

    printf("e2e: %d/%d checks passed\n", checks - failures, checks);
    return failures ? 1 : 0;
}
