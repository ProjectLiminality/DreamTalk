#!/bin/sh
# Build dreamtalk-pad.
#   ./build.sh          the tablet binary: build/arm/dreamtalk-pad
#                       (static armv7 ELF, musl, Cortex-A7 — the rM2's CPU)
#   ./build.sh test     host tests on the Mac: ink.c + the display-list parser;
#                       also writes build/ink_test.ppm, a page to look at
#   ./build.sh e2e      the real ARM binary against test/fake-qtfb.c, in an
#                       emulated armv7 Linux container (needs Docker running);
#                       writes build/e2e.pgm
#   ./build.sh all      test + arm
# Needs zig (brew install zig). No reMarkable SDK.
set -eu
cd "$(dirname "$0")"
CFLAGS="-std=gnu11 -O2 -Wall -Wextra -Werror"

arm() {
  mkdir -p build/arm
  zig cc -target arm-linux-musleabihf -mcpu=cortex_a7 -static -s $CFLAGS \
    -o build/arm/dreamtalk-pad dreamtalk-pad.c ink.c -lm
  file build/arm/dreamtalk-pad
}

host() {
  mkdir -p build/host
  zig cc $CFLAGS -o build/host/ink_test test/ink_test.c ink.c -lm
  build/host/ink_test build/ink_test.ppm
}

e2e() {
  arm
  zig cc -target arm-linux-musleabihf -mcpu=cortex_a7 -static $CFLAGS \
    -o build/arm/fake-qtfb test/fake-qtfb.c ink.c -lm
  docker run --rm --platform linux/arm/v7 -v "$PWD/build:/w" alpine:3 \
    /w/arm/fake-qtfb /w/arm/dreamtalk-pad /w/e2e.pgm
}

case "${1:-arm}" in
  arm) arm ;;
  test) host ;;
  e2e) e2e ;;
  all) host && arm ;;
  *) echo "usage: $0 [arm|test|e2e|all]" >&2; exit 2 ;;
esac
