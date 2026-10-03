/*
 * qtfb.h — the qtfb wire protocol, as plain C.
 *
 * qtfb is the shared-framebuffer server inside AppLoad (asivery/rm-appload,
 * GPL-3.0). This file is NOT a copy of its headers: it restates the wire
 * format (message ids, constants, struct layouts) so a C program can speak
 * it. Every value below was read from upstream at commit
 *   95d2de5948f5fcae8ff07d046408483f5a35e888 (2026-09-20, AppLoad v0.6.0+):
 *     src/qtfb/common.h                     constants + struct layouts
 *     backends/qtfb-clients/cpp/qtfb-client.cpp   the client handshake
 *     src/qtfb/fbmanagement.cpp             server: shm creation, 1 s stall
 *                                            after SET_REFRESH_MODE
 *     src/qtfb/FBController.cpp             input: pen = Qt mouse events,
 *                                            d = pressure * 100
 *     xovi/template/appload.qmd             refresh mode -> xochitl
 *                                            ScreenModeItem
 *
 * Layout matters: the server recv()s sizeof(ClientMessage) and send()s
 * sizeof(ServerMessage) over a SOCK_SEQPACKET socket, compiled natively for
 * the tablet. On armv7 (rM1/rM2) int and size_t are both 4 bytes, so both
 * messages are 24 bytes; the static asserts below pin that.
 */
#ifndef DREAMTALK_QTFB_H
#define DREAMTALK_QTFB_H

#include <stddef.h>
#include <stdint.h>

#define QTFB_SOCKET_PATH "/tmp/qtfb.sock"
#define QTFB_SHM_NAME_FMT "/qtfb_%d" /* shm_open name for the key the server returns */

#define QTFB_RM2_WIDTH 1404
#define QTFB_RM2_HEIGHT 1872

/* message types */
#define QTFB_MSG_INITIALIZE 0
#define QTFB_MSG_UPDATE 1
#define QTFB_MSG_CUSTOM_INITIALIZE 2
#define QTFB_MSG_TERMINATE 3
#define QTFB_MSG_USERINPUT 4
#define QTFB_MSG_SET_REFRESH_MODE 5
#define QTFB_MSG_REQUEST_FULL_REFRESH 6
#define QTFB_MSG_DEVICE_STATE_CHANGED 7
#define QTFB_MSG_DEVICE_STATE_INIT 8

/* framebuffer formats: FBFMT_RM2FB is RGB565 (QImage::Format_RGB16), 1404x1872 */
#define QTFB_FBFMT_RM2FB 0

#define QTFB_UPDATE_ALL 0
#define QTFB_UPDATE_PARTIAL 1

/*
 * Refresh modes. appload.qmd indexes xochitl's ScreenModeItem enum with
 * these, and its names are hashed there; decoding the hashes gives
 *   UFAST -> "Pen", FAST -> "Mono", ANIMATE -> "Animation",
 *   CONTENT -> "Content", UI -> "UI".
 * So UFAST is xochitl's own pen waveform. The server rejects values > 4.
 * The default, before a client sets anything, is UI.
 */
#define QTFB_REFRESH_UFAST 0
#define QTFB_REFRESH_FAST 1
#define QTFB_REFRESH_ANIMATE 2
#define QTFB_REFRESH_CONTENT 3
#define QTFB_REFRESH_UI 4

/* user input types (ServerMessage.input.input_type) */
#define QTFB_INPUT_TOUCH_PRESS 0x10
#define QTFB_INPUT_TOUCH_RELEASE 0x11
#define QTFB_INPUT_TOUCH_UPDATE 0x12
#define QTFB_INPUT_PEN_PRESS 0x20
#define QTFB_INPUT_PEN_RELEASE 0x21
#define QTFB_INPUT_PEN_UPDATE 0x22
#define QTFB_INPUT_BTN_PRESS 0x30
#define QTFB_INPUT_BTN_RELEASE 0x31

struct qtfb_client_msg {
    uint8_t type;
    union {
        struct {
            int key;
            uint8_t format;
        } init;
        struct {
            int type; /* QTFB_UPDATE_ALL | QTFB_UPDATE_PARTIAL */
            int x, y, w, h;
        } update;
        struct {
            int key;
            uint8_t format;
            uint16_t width, height;
        } custom_init;
        int refresh_mode;
    };
};

struct qtfb_server_msg {
    uint8_t type;
    union {
        struct {
            int shm_key;
            size_t shm_size;
        } init;
        struct {
            int input_type;
            int dev_id; /* 0 for the pen; the touch point id for touch */
            int x, y;   /* framebuffer pixels */
            int d;      /* pen: pressure * 100 (0..100); keys: 0 */
        } input;
        struct {
            int reason;
            int rotation;
        } state;
    };
};

#if defined(__arm__)
_Static_assert(sizeof(struct qtfb_client_msg) == 24, "qtfb ClientMessage must be 24 bytes on armv7");
_Static_assert(sizeof(struct qtfb_server_msg) == 24, "qtfb ServerMessage must be 24 bytes on armv7");
_Static_assert(offsetof(struct qtfb_client_msg, init.format) == 8, "init.framebufferType at 8");
_Static_assert(offsetof(struct qtfb_client_msg, update.h) == 20, "update.h at 20");
_Static_assert(offsetof(struct qtfb_client_msg, custom_init.width) == 10, "customInit.width at 10");
_Static_assert(offsetof(struct qtfb_client_msg, refresh_mode) == 4, "refreshMode at 4");
_Static_assert(offsetof(struct qtfb_server_msg, init.shm_size) == 8, "init.shmSize at 8");
_Static_assert(offsetof(struct qtfb_server_msg, input.x) == 12, "userInput.x at 12");
_Static_assert(offsetof(struct qtfb_server_msg, input.d) == 20, "userInput.d at 20");
#endif

#endif
