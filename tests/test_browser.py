"""Tests for browser fetch pipeline, history, and MCP tool registration.

Covers AC-1 through AC-5 from issue #27.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
import requests

from tools.api_server.browser import BrowserSession, fetch_and_convert, _extract_links


# --- Fixtures ---

SAMPLE_HTML = """
<html>
<head><title>Test Article</title></head>
<body>
<div id="content">
<h1>Welcome to the Test</h1>
<p>This is the main article body with some content that needs to be long enough
for readability to consider it worth extracting. The readability algorithm looks
for substantial blocks of text content and filters out navigation, sidebars, and
other boilerplate elements from web pages.</p>
<p>Here is a <a href="/about">link to about</a> and
   an <a href="https://example.com/docs">external docs link</a>. These links
   should be extracted and included in the RenderBundle links array with their
   text and resolved URLs.</p>
<p>Another paragraph with a <a href="/contact">contact link</a>. This paragraph
adds more content weight so the readability algorithm will detect this as the
main article content of the page rather than boilerplate.</p>
<p>Final paragraph providing additional content mass for the extraction pipeline.
The WibWob-DOS browser renders this as readable markdown in a TUI window.</p>
</div>
<nav><a href="/nav-only">Nav link</a></nav>
</body>
</html>
"""

SAMPLE_HTML_2 = """
<html>
<head><title>Second Page</title></head>
<body>
<article>
<h1>Second Page</h1>
<p>Content of page two.</p>
</article>
</body>
</html>
"""

SAMPLE_HTML_3 = """
<html>
<head><title>Third Page</title></head>
<body>
<article>
<h1>Third Page</h1>
<p>Content of page three.</p>
</article>
</body>
</html>
"""


def _mock_response(html: str, url: str = "https://example.com") -> MagicMock:
    resp = MagicMock()
    resp.text = html
    resp.content = html.encode("utf-8")
    resp.raise_for_status = MagicMock()
    resp.url = url
    return resp


# --- AC-1: POST /browser/fetch returns RenderBundle JSON ---


class TestRenderBundleSchema:
    """AC-1: fetch returns RenderBundle with url, title, markdown, links, meta."""

    @patch("tools.api_server.browser.requests.get")
    def test_fetch_returns_render_bundle(self, mock_get):
        mock_get.return_value = _mock_response(SAMPLE_HTML)
        bundle = fetch_and_convert("https://example.com")

        # Required top-level keys
        assert "url" in bundle
        assert "title" in bundle
        assert "markdown" in bundle
        assert "tui_text" in bundle
        assert "links" in bundle
        assert "assets" in bundle
        assert "meta" in bundle

        # Types
        assert isinstance(bundle["url"], str)
        assert isinstance(bundle["title"], str)
        assert isinstance(bundle["markdown"], str)
        assert isinstance(bundle["links"], list)
        assert isinstance(bundle["meta"], dict)

        # Meta fields
        assert "fetched_at" in bundle["meta"]
        assert "cache" in bundle["meta"]
        assert "source_bytes" in bundle["meta"]
        assert bundle["meta"]["source_bytes"] > 0

    @patch("tools.api_server.browser.requests.get")
    def test_fetch_preserves_url(self, mock_get):
        mock_get.return_value = _mock_response(SAMPLE_HTML)
        bundle = fetch_and_convert("https://example.com/page")
        assert bundle["url"] == "https://example.com/page"


# --- AC-2: Pipeline extracts article and converts to markdown ---


class TestFetchPipeline:
    """AC-2: readability extracts article, markdownify converts to MD."""

    @patch("tools.api_server.browser.requests.get")
    def test_fetch_pipeline_extracts_article(self, mock_get):
        mock_get.return_value = _mock_response(SAMPLE_HTML)
        bundle = fetch_and_convert("https://example.com")

        md_text = bundle["markdown"]
        assert len(md_text) > 0
        # Readability should extract article content
        assert "main article body" in md_text.lower() or "welcome" in md_text.lower()

    @patch("tools.api_server.browser.requests.get")
    def test_title_extracted(self, mock_get):
        mock_get.return_value = _mock_response(SAMPLE_HTML)
        bundle = fetch_and_convert("https://example.com")
        assert len(bundle["title"]) > 0

    @patch("tools.api_server.browser.requests.get")
    def test_tui_text_matches_markdown_for_v0(self, mock_get):
        mock_get.return_value = _mock_response(SAMPLE_HTML)
        bundle = fetch_and_convert("https://example.com")
        assert bundle["tui_text"] == bundle["markdown"]

    @patch("tools.api_server.browser.requests.get")
    def test_ssl_error_retries_without_verify(self, mock_get):
        ssl_err = requests.exceptions.SSLError("cert verify failed")
        ok_resp = _mock_response(SAMPLE_HTML)
        mock_get.side_effect = [ssl_err, ok_resp]

        bundle = fetch_and_convert("https://example.com")
        assert bundle["url"] == "https://example.com"
        assert mock_get.call_count == 2
        _, second_kwargs = mock_get.call_args_list[1]
        assert second_kwargs.get("verify") is False


# --- AC-3: Links extracted with id, text, url ---


class TestLinkExtraction:
    """AC-3: RenderBundle links array has id/text/url fields."""

    @patch("tools.api_server.browser.requests.get")
    def test_render_bundle_links_extracted(self, mock_get):
        mock_get.return_value = _mock_response(SAMPLE_HTML)
        bundle = fetch_and_convert("https://example.com")
        links = bundle["links"]

        assert len(links) > 0
        for link in links:
            assert "id" in link
            assert "text" in link
            assert "url" in link
            assert isinstance(link["id"], int)
            assert isinstance(link["text"], str)
            assert isinstance(link["url"], str)

    @patch("tools.api_server.browser.requests.get")
    def test_links_have_sequential_ids(self, mock_get):
        mock_get.return_value = _mock_response(SAMPLE_HTML)
        bundle = fetch_and_convert("https://example.com")
        links = bundle["links"]
        if links:
            ids = [l["id"] for l in links]
            assert ids == list(range(1, len(ids) + 1))

    @patch("tools.api_server.browser.requests.get")
    def test_relative_links_resolved(self, mock_get):
        mock_get.return_value = _mock_response(SAMPLE_HTML)
        bundle = fetch_and_convert("https://example.com")
        urls = [l["url"] for l in bundle["links"]]
        for url in urls:
            assert url.startswith("http")

    def test_extract_links_deduplicates(self):
        html = '<a href="/a">A</a> <a href="/a">A again</a> <a href="/b">B</a>'
        links = _extract_links(html, "https://example.com")
        urls = [l["url"] for l in links]
        assert len(urls) == len(set(urls))

    def test_extract_links_skips_fragments_and_javascript(self):
        html = '<a href="#top">Top</a> <a href="javascript:void(0)">JS</a> <a href="/real">Real</a>'
        links = _extract_links(html, "https://example.com")
        assert len(links) == 1
        assert links[0]["url"] == "https://example.com/real"


# --- AC-4: Session history back/forward ---


class TestBrowserSessionHistory:
    """AC-4: Session history with back/forward navigation."""

    def _make_bundle(self, url: str) -> dict:
        return {"url": url, "title": f"Page {url}", "markdown": "", "tui_text": "", "links": [], "assets": [], "meta": {}}

    def test_history_back_forward(self):
        session = BrowserSession()
        b1 = self._make_bundle("https://example.com/1")
        b2 = self._make_bundle("https://example.com/2")
        b3 = self._make_bundle("https://example.com/3")

        session.navigate(b1)
        session.navigate(b2)
        session.navigate(b3)

        assert session.current["url"] == "https://example.com/3"

        # Go back
        result = session.back()
        assert result is not None
        assert result["url"] == "https://example.com/2"

        result = session.back()
        assert result is not None
        assert result["url"] == "https://example.com/1"

        # Can't go back further
        assert session.back() is None

        # Go forward
        result = session.forward()
        assert result is not None
        assert result["url"] == "https://example.com/2"

        result = session.forward()
        assert result is not None
        assert result["url"] == "https://example.com/3"

        # Can't go forward further
        assert session.forward() is None

    def test_navigate_clears_forward_history(self):
        session = BrowserSession()
        b1 = self._make_bundle("https://example.com/1")
        b2 = self._make_bundle("https://example.com/2")
        b3 = self._make_bundle("https://example.com/3")
        b4 = self._make_bundle("https://example.com/4")

        session.navigate(b1)
        session.navigate(b2)
        session.navigate(b3)
        session.back()  # now at b2
        session.navigate(b4)  # should clear b3 from forward

        assert session.current["url"] == "https://example.com/4"
        assert session.forward() is None

    def test_empty_session(self):
        session = BrowserSession()
        assert session.current is None
        assert session.back() is None
        assert session.forward() is None
        assert not session.can_go_back
        assert not session.can_go_forward

    def test_can_go_back_forward_flags(self):
        session = BrowserSession()
        b1 = self._make_bundle("https://example.com/1")
        b2 = self._make_bundle("https://example.com/2")

        session.navigate(b1)
        assert not session.can_go_back
        assert not session.can_go_forward

        session.navigate(b2)
        assert session.can_go_back
        assert not session.can_go_forward

        session.back()
        assert not session.can_go_back
        assert session.can_go_forward


# --- AC-5: MCP tool browser_fetch registered ---


class TestMCPBrowserTool:
    """AC-5: MCP tool browser_fetch is registered and callable."""

    def test_mcp_browser_fetch_registered(self):
        """Verify browser tools can be registered without error."""
        from tools.api_server.mcp_tools import register_browser_tools

        mock_mcp = MagicMock()
        registered_tools = {}

        def mock_tool(name):
            def decorator(fn):
                registered_tools[name] = fn
                return fn
            return decorator

        mock_mcp.tool = mock_tool
        register_browser_tools(mock_mcp)

        assert "browser_fetch" in registered_tools
        assert "browser_back" in registered_tools
        assert "browser_forward" in registered_tools

    def test_mcp_browser_fetch_is_async(self):
        """Verify the registered tool is an async function."""
        import inspect
        from tools.api_server.mcp_tools import register_browser_tools

        mock_mcp = MagicMock()
        registered_tools = {}

        def mock_tool(name):
            def decorator(fn):
                registered_tools[name] = fn
                return fn
            return decorator

        mock_mcp.tool = mock_tool
        register_browser_tools(mock_mcp)

        assert inspect.iscoroutinefunction(registered_tools["browser_fetch"])


# --- Contract test: RenderBundle validates against Pydantic schema ---


class TestRenderBundleContract:
    """Contract test: RenderBundle Pydantic model validates bundle dicts."""

    def test_valid_bundle_validates(self):
        from tools.api_server.schemas import RenderBundle

        data = {
            "url": "https://example.com",
            "title": "Test",
            "markdown": "# Hello",
            "tui_text": "# Hello",
            "links": [{"id": 1, "text": "About", "url": "https://example.com/about"}],
            "assets": [],
            "meta": {"fetched_at": "2026-02-15T00:00:00Z", "cache": "miss", "source_bytes": 100},
        }
        bundle = RenderBundle(**data)
        assert bundle.url == "https://example.com"
        assert bundle.title == "Test"
        assert len(bundle.links) == 1
        assert bundle.links[0].id == 1

    def test_invalid_bundle_rejects_missing_url(self):
        from tools.api_server.schemas import RenderBundle

        with pytest.raises(Exception):
            RenderBundle(
                title="Test", markdown="x", tui_text="x",
                links=[], assets=[],
                meta={"fetched_at": "x", "cache": "miss", "source_bytes": 0}
            )

    def test_invalid_link_rejects_missing_fields(self):
        from tools.api_server.schemas import BrowserLink

        with pytest.raises(Exception):
            BrowserLink(id=1, text="no url")
