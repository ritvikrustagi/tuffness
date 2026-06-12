#!/bin/sh
set -eu

LABEL="com.user.downloads-to-icloud"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SOURCE_SCRIPT="$SCRIPT_DIR/downloads_to_icloud.py"
INSTALL_DIR="$HOME/.local/bin"
STATE_DIR="$HOME/.local/state/downloads-to-icloud"
AGENT_DIR="$HOME/Library/LaunchAgents"
INSTALLED_SCRIPT="$INSTALL_DIR/downloads-to-icloud.py"
PLIST_PATH="$AGENT_DIR/$LABEL.plist"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "This installer is for macOS LaunchAgents only." >&2
  exit 1
fi

if [ ! -f "$SOURCE_SCRIPT" ]; then
  echo "Could not find $SOURCE_SCRIPT. Run this from a cloned repository." >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR" "$STATE_DIR" "$AGENT_DIR"
cp "$SOURCE_SCRIPT" "$INSTALLED_SCRIPT"
chmod 755 "$INSTALLED_SCRIPT"

/usr/bin/python3 "$SOURCE_SCRIPT" \
  --print-launch-agent \
  --script-path "$INSTALLED_SCRIPT" \
  --stdout-log "$STATE_DIR/out.log" \
  --stderr-log "$STATE_DIR/error.log" > "$PLIST_PATH"

launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"
launchctl enable "gui/$(id -u)/$LABEL"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

echo "Installed $LABEL"
echo "Script: $INSTALLED_SCRIPT"
echo "LaunchAgent: $PLIST_PATH"
echo "Logs: $STATE_DIR"
echo ""
echo "If files do not move, grant Full Disk Access to /usr/bin/python3 in System Settings."
