#!/bin/sh
set -eu

LABEL="com.user.downloads-to-icloud"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "This uninstaller is for macOS LaunchAgents only." >&2
  exit 1
fi

launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || true
rm -f "$PLIST_PATH"

echo "Stopped and removed $LABEL"
echo "The installed script and state are left in ~/.local so you can inspect or remove them manually."
