# Downloads to iCloud

Moves new completed files from `~/Downloads` to iCloud Drive in the background on macOS.

The watcher is intentionally conservative:

- The first scan records files already in `~/Downloads` and leaves them there.
- Later scans move only newly seen completed files.
- Browser temporary files such as `.crdownload`, `.download`, `.part`, `.partial`, and `.tmp` are ignored.
- If a file with the same name already exists in iCloud Drive, the moved file gets a numbered name such as `report 2.pdf`.

## Install

From a cloned copy of this repository:

```sh
sh install.sh
```

The installer copies the watcher to `~/.local/bin/downloads-to-icloud.py`, generates a user-specific LaunchAgent at `~/Library/LaunchAgents/com.user.downloads-to-icloud.plist`, and starts it.

By default files move to:

```text
~/Library/Mobile Documents/com~apple~CloudDocs/Downloads
```

## macOS Privacy Permission

macOS may block background processes from reading `~/Downloads`. If the log says permission was denied, grant access:

1. Open System Settings.
2. Go to Privacy & Security.
3. Open Full Disk Access.
4. Add `/usr/bin/python3`.

You can jump to that path in the file picker with `Cmd+Shift+G`.

## Commands

Check status:

```sh
launchctl print gui/$(id -u)/com.user.downloads-to-icloud
```

Stop and remove the LaunchAgent:

```sh
sh uninstall.sh
```

View logs:

```sh
tail -f ~/.local/state/downloads-to-icloud/out.log
tail -f ~/.local/state/downloads-to-icloud/error.log
```

Run one scan manually:

```sh
python3 downloads_to_icloud.py --once
```

## Test

```sh
python3 tests/test_downloads_to_icloud.py -v
```
