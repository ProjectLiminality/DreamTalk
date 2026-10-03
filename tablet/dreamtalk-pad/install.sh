#!/bin/sh
# Copy dreamtalk-pad onto the reMarkable as an AppLoad app — or take it off.
#   ./install.sh            build, then copy the binary + manifest to the tablet
#   ./install.sh --remove   delete the app folder from the tablet (the rollback)
# The host comes from RM_HOST, else ~/.config/dreamtalk/remarkable.json (the
# bridge's cache), else the USB address. It logs in as root with the bridge's
# own key. It touches nothing on the tablet outside $DEST.
set -eu
cd "$(dirname "$0")"

CONFIG="$HOME/.config/dreamtalk"
KEY="$CONFIG/remarkable_ed25519"
DEST=/home/root/xovi/exthome/appload/dreamtalk-pad

HOST="${RM_HOST:-}"
if [ -z "$HOST" ] && [ -f "$CONFIG/remarkable.json" ]; then
  HOST=$(sed -n 's/.*"host"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$CONFIG/remarkable.json" | head -n 1)
fi
HOST="${HOST:-10.11.99.1}"

[ -f "$KEY" ] || { echo "no key at $KEY — pair the bridge first" >&2; exit 1; }
SSH="ssh -i $KEY -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=6 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR root@$HOST"

if [ "${1:-}" = "--remove" ]; then
  $SSH "rm -rf '$DEST'"
  echo "removed $DEST from $HOST (reload AppLoad's list to see it gone)"
  exit 0
fi

./build.sh arm >/dev/null
$SSH "test -d /home/root/xovi/exthome/appload" || {
  echo "$HOST has no /home/root/xovi/exthome/appload — install xovi + appload first (README)" >&2
  exit 1
}
# No scp/sftp assumptions: stream each file over the one ssh channel.
$SSH "mkdir -p '$DEST'"
$SSH "cat > '$DEST/dreamtalk-pad.tmp' && chmod 755 '$DEST/dreamtalk-pad.tmp' && mv '$DEST/dreamtalk-pad.tmp' '$DEST/dreamtalk-pad'" < build/arm/dreamtalk-pad
$SSH "cat > '$DEST/external.manifest.json'" < external.manifest.json
echo "installed to $HOST:$DEST — open AppLoad, reload, tap DreamTalk"
