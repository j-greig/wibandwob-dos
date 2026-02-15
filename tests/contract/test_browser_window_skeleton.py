from __future__ import annotations

from pathlib import Path


def test_browser_window_skeleton_files_exist() -> None:
    assert Path("app/browser_window.h").exists()
    assert Path("app/browser_window.cpp").exists()
