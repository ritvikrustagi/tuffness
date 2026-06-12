#!/usr/bin/env python3
import argparse
import json
import shutil
import sys
import time
from pathlib import Path


DEFAULT_DOWNLOADS_DIR = Path.home() / "Downloads"
DEFAULT_ICLOUD_DIR = Path.home() / "Library" / "Mobile Documents" / "com~apple~CloudDocs" / "Downloads"
DEFAULT_STATE_FILE = Path.home() / ".local" / "state" / "downloads-to-icloud" / "seen.json"
TEMP_SUFFIXES = (
    ".crdownload",
    ".download",
    ".part",
    ".partial",
    ".tmp",
)
_last_permission_log_time = 0


def load_seen(state_file):
    if not state_file.exists():
        return None

    try:
        data = json.loads(state_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return set()

    if not isinstance(data, list):
        return set()
    return {str(item) for item in data}


def save_seen(state_file, seen):
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(json.dumps(sorted(seen), indent=2), encoding="utf-8")


def is_temporary_download(path):
    name = path.name
    if name.startswith("."):
        return True
    return any(name.endswith(suffix) for suffix in TEMP_SUFFIXES)


def is_settled(path, settle_seconds):
    try:
        first = path.stat()
        time.sleep(settle_seconds)
        second = path.stat()
    except FileNotFoundError:
        return False

    return first.st_size == second.st_size and int(first.st_mtime_ns) == int(second.st_mtime_ns)


def destination_for(source, destination_dir):
    candidate = destination_dir / source.name
    if not candidate.exists():
        return candidate

    stem = source.stem
    suffix = source.suffix
    counter = 2
    while True:
        candidate = destination_dir / f"{stem} {counter}{suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def list_items(downloads_dir):
    try:
        return sorted(
            [item for item in downloads_dir.iterdir() if not is_temporary_download(item)],
            key=lambda item: item.name,
        )
    except FileNotFoundError:
        downloads_dir.mkdir(parents=True, exist_ok=True)
        return []
    except PermissionError:
        global _last_permission_log_time
        now = time.time()
        if now - _last_permission_log_time > 300:
            print(
                f"Permission denied reading {downloads_dir}. Grant Full Disk Access or Downloads access to /usr/bin/python3.",
                file=sys.stderr,
                flush=True,
            )
            _last_permission_log_time = now
        return None


def scan_once(downloads_dir, destination_dir, state_file, settle_seconds=2):
    downloads_dir = Path(downloads_dir)
    destination_dir = Path(destination_dir)
    state_file = Path(state_file)
    destination_dir.mkdir(parents=True, exist_ok=True)

    seen = load_seen(state_file)
    items = list_items(downloads_dir)
    if items is None:
        return []

    item_names = {item.name for item in items}

    if seen is None:
        save_seen(state_file, item_names)
        return []

    moved = []
    for item in items:
        if item.name in seen:
            continue
        if not is_settled(item, settle_seconds):
            continue

        destination = destination_for(item, destination_dir)
        shutil.move(str(item), str(destination))
        moved.append((item, destination))
        seen.add(item.name)

    seen &= item_names | {source.name for source, _destination in moved}
    save_seen(state_file, seen)
    return moved


def run_forever(downloads_dir, destination_dir, state_file, interval_seconds, settle_seconds):
    while True:
        moved = scan_once(downloads_dir, destination_dir, state_file, settle_seconds)
        for source, destination in moved:
            print(f"Moved {source} -> {destination}", flush=True)
        time.sleep(interval_seconds)


def parse_args():
    parser = argparse.ArgumentParser(description="Move new completed Downloads items to iCloud Drive.")
    parser.add_argument("--downloads-dir", type=Path, default=DEFAULT_DOWNLOADS_DIR)
    parser.add_argument("--destination-dir", type=Path, default=DEFAULT_ICLOUD_DIR)
    parser.add_argument("--state-file", type=Path, default=DEFAULT_STATE_FILE)
    parser.add_argument("--interval-seconds", type=float, default=5)
    parser.add_argument("--settle-seconds", type=float, default=2)
    parser.add_argument("--once", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    if args.once:
        scan_once(args.downloads_dir, args.destination_dir, args.state_file, args.settle_seconds)
        return

    run_forever(
        downloads_dir=args.downloads_dir,
        destination_dir=args.destination_dir,
        state_file=args.state_file,
        interval_seconds=args.interval_seconds,
        settle_seconds=args.settle_seconds,
    )


if __name__ == "__main__":
    main()
