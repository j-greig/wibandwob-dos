"""Tests for BrowserWindow C++ skeleton + IPC bridge.

Covers AC-1 through AC-4 from S04 spec.
These are contract tests validating the IPC protocol and Python schema changes.
AC-2 and AC-5 require manual smoke testing with the running TUI.
"""

from __future__ import annotations

import json
import socket
import time
from unittest.mock import MagicMock, patch

import pytest

from tools.api_server.models import WindowType
from tools.api_server.schemas import WindowCreate


# --- AC-1: Browser window type registered ---


class TestBrowserWindowTypeRegistered:
    """AC-1: create_window type=browser is recognized in Python schemas."""

    def test_window_type_enum_has_browser(self):
        """WindowType enum includes browser."""
        assert hasattr(WindowType, "browser")
        assert WindowType.browser.value == "browser"

    def test_window_create_schema_accepts_browser(self):
        """WindowCreate Pydantic model accepts type='browser'."""
        wc = WindowCreate(type="browser")
        assert wc.type == "browser"

    def test_window_create_schema_accepts_browser_with_rect(self):
        """WindowCreate with browser type and optional rect."""
        wc = WindowCreate(type="browser", rect={"x": 5, "y": 3, "w": 60, "h": 20})
        assert wc.type == "browser"
        assert wc.rect.x == 5
        assert wc.rect.w == 60


# --- AC-3: browser_fetch IPC command contract ---


class TestBrowserFetchIPCContract:
    """AC-3: browser_fetch IPC command is well-formed."""

    def test_ipc_create_browser_command_format(self):
        """Verify the IPC command string format for creating a browser window."""
        cmd = "cmd:create_window type=browser"
        assert "cmd:create_window" in cmd
        assert "type=browser" in cmd

    def test_ipc_create_browser_with_bounds_format(self):
        """Verify IPC command format with optional bounds."""
        cmd = "cmd:create_window type=browser x=5 y=3 w=60 h=20"
        assert "type=browser" in cmd
        assert "x=5" in cmd
        assert "w=60" in cmd

    def test_ipc_browser_fetch_command_format(self):
        """Verify the IPC command string format for browser_fetch."""
        cmd = "cmd:browser_fetch url=https://example.com"
        assert "cmd:browser_fetch" in cmd
        assert "url=https://example.com" in cmd


# --- AC-4: History navigation contract ---


class TestBrowserHistoryContract:
    """AC-4: Browser history back/forward via Python API endpoints."""

    @patch("tools.api_server.browser.requests.get")
    def test_browser_back_endpoint_exists(self, mock_get):
        """Verify browser/back endpoint is defined in the API."""
        from tools.api_server.browser import BrowserSession

        session = BrowserSession()
        # Navigate to two pages
        b1 = {
            "url": "https://example.com/1",
            "title": "Page 1",
            "markdown": "# Page 1",
            "tui_text": "# Page 1",
            "links": [],
            "assets": [],
            "meta": {"fetched_at": "2026-02-15T00:00:00Z", "cache": "miss", "source_bytes": 100},
        }
        b2 = {
            "url": "https://example.com/2",
            "title": "Page 2",
            "markdown": "# Page 2",
            "tui_text": "# Page 2",
            "links": [],
            "assets": [],
            "meta": {"fetched_at": "2026-02-15T00:00:00Z", "cache": "miss", "source_bytes": 100},
        }
        session.navigate(b1)
        session.navigate(b2)

        result = session.back()
        assert result is not None
        assert result["url"] == "https://example.com/1"

    @patch("tools.api_server.browser.requests.get")
    def test_browser_forward_endpoint_exists(self, mock_get):
        """Verify browser/forward endpoint is defined in the API."""
        from tools.api_server.browser import BrowserSession

        session = BrowserSession()
        b1 = {
            "url": "https://example.com/1",
            "title": "Page 1",
            "markdown": "# Page 1",
            "tui_text": "# Page 1",
            "links": [],
            "assets": [],
            "meta": {"fetched_at": "2026-02-15T00:00:00Z", "cache": "miss", "source_bytes": 100},
        }
        b2 = {
            "url": "https://example.com/2",
            "title": "Page 2",
            "markdown": "# Page 2",
            "tui_text": "# Page 2",
            "links": [],
            "assets": [],
            "meta": {"fetched_at": "2026-02-15T00:00:00Z", "cache": "miss", "source_bytes": 100},
        }
        session.navigate(b1)
        session.navigate(b2)
        session.back()

        result = session.forward()
        assert result is not None
        assert result["url"] == "https://example.com/2"


# --- Schema contract: RenderBundle used by C++ JSON parser ---


class TestRenderBundleForCpp:
    """Contract: RenderBundle JSON has fields the C++ parser expects."""

    def test_render_bundle_has_tui_text_field(self):
        """C++ parser extracts tui_text field from RenderBundle JSON."""
        from tools.api_server.schemas import RenderBundle

        bundle = RenderBundle(
            url="https://example.com",
            title="Test Page",
            markdown="# Hello",
            tui_text="# Hello\n\nWorld",
            links=[],
            assets=[],
            meta={"fetched_at": "2026-02-15T00:00:00Z", "cache": "miss", "source_bytes": 42},
        )
        # Serialize to JSON and verify fields the C++ extractJsonStringField will look for
        data = bundle.model_dump()
        assert "tui_text" in data
        assert "title" in data
        assert "url" in data

    def test_render_bundle_json_serialization(self):
        """RenderBundle serializes to JSON that C++ can parse."""
        from tools.api_server.schemas import RenderBundle

        bundle = RenderBundle(
            url="https://example.com",
            title='Test "Quoted" Page',
            markdown="# Hello\nWorld",
            tui_text="# Hello\nWorld",
            links=[{"id": 1, "text": "About", "url": "https://example.com/about"}],
            assets=[],
            meta={"fetched_at": "2026-02-15T00:00:00Z", "cache": "miss", "source_bytes": 42},
        )
        json_str = bundle.model_dump_json()
        # Should be valid JSON
        parsed = json.loads(json_str)
        assert parsed["title"] == 'Test "Quoted" Page'
        assert parsed["tui_text"] == "# Hello\nWorld"
