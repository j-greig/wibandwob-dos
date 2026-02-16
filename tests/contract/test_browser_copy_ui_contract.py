from __future__ import annotations

from pathlib import Path


def test_browser_view_has_copy_shortcuts_and_handler() -> None:
    source = Path("app/browser_view.cpp").read_text(encoding="utf-8")

    assert "case kbCtrlIns:" in source
    assert "case 'y':" in source
    assert "event.message.command == cmCopy" in source
    assert "copyPageToClipboard()" in source


def test_browser_copy_payload_prefers_markdown_and_image_urls() -> None:
    source = Path("app/browser_view.cpp").read_text(encoding="utf-8")
    header = Path("app/browser_view.h").read_text(encoding="utf-8")

    assert "latestMarkdown" in header
    assert "latestImageUrls" in header
    assert "refreshCopyPayload(fetchBuffer)" in source
    assert "extractJsonStringValues" in source
    assert "flattenMarkdownLinks" in source
    assert "\"source_url\"" in source


def test_edit_menu_wires_copy_page_command() -> None:
    source = Path("app/test_pattern_app.cpp").read_text(encoding="utf-8")
    assert "~C~opy Page" in source
    assert "cmCopy" in source
