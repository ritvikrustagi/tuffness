import importlib.util
import json
import plistlib
import tempfile
import unittest
from pathlib import Path
from unittest import mock


SCRIPT_PATH = (
    Path(__file__).resolve().parents[2]
    / "tools"
    / "downloads_to_icloud"
    / "downloads_to_icloud.py"
)

spec = importlib.util.spec_from_file_location("downloads_to_icloud", SCRIPT_PATH)
downloads_to_icloud = importlib.util.module_from_spec(spec)
spec.loader.exec_module(downloads_to_icloud)


class DownloadsToICloudTests(unittest.TestCase):
    def test_first_scan_records_existing_items_without_moving_them(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            downloads = root / "Downloads"
            icloud = root / "iCloud"
            downloads.mkdir()
            icloud.mkdir()
            existing = downloads / "already-here.pdf"
            existing.write_text("keep for now", encoding="utf-8")
            state_file = root / "state.json"

            moved = downloads_to_icloud.scan_once(
                downloads_dir=downloads,
                destination_dir=icloud,
                state_file=state_file,
                settle_seconds=0,
            )

            self.assertEqual(moved, [])
            self.assertTrue(existing.exists())
            self.assertEqual(json.loads(state_file.read_text(encoding="utf-8")), [existing.name])

    def test_second_scan_moves_new_completed_item_to_icloud(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            downloads = root / "Downloads"
            icloud = root / "iCloud"
            downloads.mkdir()
            icloud.mkdir()
            state_file = root / "state.json"

            downloads_to_icloud.scan_once(downloads, icloud, state_file, settle_seconds=0)
            new_file = downloads / "new-file.pdf"
            new_file.write_text("sync me", encoding="utf-8")

            moved = downloads_to_icloud.scan_once(
                downloads_dir=downloads,
                destination_dir=icloud,
                state_file=state_file,
                settle_seconds=0,
            )

            self.assertEqual(moved, [(new_file, icloud / "new-file.pdf")])
            self.assertFalse(new_file.exists())
            self.assertEqual((icloud / "new-file.pdf").read_text(encoding="utf-8"), "sync me")

    def test_temporary_download_files_are_not_moved(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            downloads = root / "Downloads"
            icloud = root / "iCloud"
            downloads.mkdir()
            icloud.mkdir()
            state_file = root / "state.json"

            downloads_to_icloud.scan_once(downloads, icloud, state_file, settle_seconds=0)
            partial = downloads / "video.mp4.crdownload"
            partial.write_text("still downloading", encoding="utf-8")

            moved = downloads_to_icloud.scan_once(downloads, icloud, state_file, settle_seconds=0)

            self.assertEqual(moved, [])
            self.assertTrue(partial.exists())
            self.assertFalse((icloud / partial.name).exists())

    def test_scan_keeps_running_when_macos_blocks_downloads_access(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            downloads = root / "Downloads"
            icloud = root / "iCloud"
            downloads.mkdir()
            icloud.mkdir()
            state_file = root / "state.json"

            with mock.patch.object(Path, "iterdir", side_effect=PermissionError("blocked")):
                moved = downloads_to_icloud.scan_once(
                    downloads_dir=downloads,
                    destination_dir=icloud,
                    state_file=state_file,
                    settle_seconds=0,
                )

            self.assertEqual(moved, [])
            self.assertFalse(state_file.exists())

    def test_name_collisions_get_numbered_destination_names(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            downloads = root / "Downloads"
            icloud = root / "iCloud"
            downloads.mkdir()
            icloud.mkdir()
            state_file = root / "state.json"
            (icloud / "report.pdf").write_text("old", encoding="utf-8")

            downloads_to_icloud.scan_once(downloads, icloud, state_file, settle_seconds=0)
            report = downloads / "report.pdf"
            report.write_text("new", encoding="utf-8")

            moved = downloads_to_icloud.scan_once(downloads, icloud, state_file, settle_seconds=0)

            self.assertEqual(moved, [(report, icloud / "report 2.pdf")])
            self.assertEqual((icloud / "report.pdf").read_text(encoding="utf-8"), "old")
            self.assertEqual((icloud / "report 2.pdf").read_text(encoding="utf-8"), "new")

    def test_launch_agent_plist_is_generated_from_supplied_paths(self):
        script_path = Path("/Users/example/.local/bin/downloads-to-icloud.py")
        out_log = Path("/Users/example/.local/state/downloads-to-icloud/out.log")
        error_log = Path("/Users/example/.local/state/downloads-to-icloud/error.log")

        plist_text = downloads_to_icloud.render_launch_agent_plist(
            script_path=script_path,
            stdout_log=out_log,
            stderr_log=error_log,
        )
        plist = plistlib.loads(plist_text.encode("utf-8"))

        self.assertEqual(plist["Label"], "com.user.downloads-to-icloud")
        self.assertEqual(plist["ProgramArguments"], ["/usr/bin/python3", str(script_path)])
        self.assertEqual(plist["StandardOutPath"], str(out_log))
        self.assertEqual(plist["StandardErrorPath"], str(error_log))
        self.assertTrue(plist["RunAtLoad"])
        self.assertTrue(plist["KeepAlive"])


if __name__ == "__main__":
    unittest.main()
