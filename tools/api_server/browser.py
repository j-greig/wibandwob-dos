"""Browser fetch pipeline and session history for WibWob-DOS.

Fetches web pages, extracts readable content via readability-lxml,
converts to markdown via markdownify, and returns a RenderBundle.
Tracks session history for back/forward navigation.
"""

from __future__ import annotations

import re
import warnings
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from markdownify import markdownify as md
from readability import Document


def _extract_pre_blocks(html: str) -> tuple[str, dict[str, str]]:
    """Replace <pre> blocks with unique placeholder tokens.

    Returns (modified_html, {token: pre_text}) so callers can restore
    the verbatim whitespace-preserved content after readability/markdownify
    have run.  readability-lxml collapses whitespace inside <pre> tags;
    this protects them by removing them before readability sees them.
    """
    soup = BeautifulSoup(html, "html.parser")
    stash: dict[str, str] = {}
    for idx, pre in enumerate(soup.find_all("pre")):
        token = f"\x00PRE{idx}\x00"
        # Get the raw text content, preserving internal newlines and spaces
        text = pre.get_text()
        stash[token] = text
        pre.replace_with(token)
    return str(soup), stash


def _restore_pre_blocks(markdown: str, stash: dict[str, str]) -> str:
    """Substitute placeholder tokens back with verbatim pre-block text."""
    for token, text in stash.items():
        # Ensure the block is surrounded by blank lines so it reads cleanly
        block = "\n" + text.rstrip("\n") + "\n"
        markdown = markdown.replace(token, block)
    return markdown


def fetch_and_convert(url: str) -> Dict[str, Any]:
    """Fetch a URL and return a RenderBundle dict.

    Pipeline: requests.get → pre-block extraction → readability extract
              → markdownify → pre-block restoration → bundle.
    """
    headers = {"User-Agent": "WibWob-DOS/0.1"}
    try:
        resp = requests.get(url, timeout=15, headers=headers)
        resp.raise_for_status()
    except requests.exceptions.SSLError:
        # Some local Python environments have incomplete CA trust chains.
        # Retry once without certificate verification so browser navigation
        # remains usable from the TUI.
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            resp = requests.get(url, timeout=15, headers=headers, verify=False)
            resp.raise_for_status()
    source_bytes = len(resp.content)

    # Force UTF-8 decoding — requests sometimes guesses Latin-1 for
    # responses without an explicit charset, causing double-encoding.
    resp.encoding = resp.apparent_encoding or "utf-8"

    # Protect <pre> blocks before readability collapses their whitespace.
    protected_html, pre_stash = _extract_pre_blocks(resp.text)

    doc = Document(protected_html)
    title = doc.title()
    article_html = doc.summary()

    # readability returns an empty body when it cannot find article-like
    # prose (e.g. pages that are primarily ASCII art or navigation).
    # Fall back to running markdownify on the full protected source.
    soup_check = BeautifulSoup(article_html, "html.parser")
    body_text = soup_check.get_text(strip=True)
    if not body_text:
        article_html = protected_html

    markdown = md(article_html, heading_style="ATX", strip=["img", "script", "style"])

    # Restore verbatim pre-block content
    markdown = _restore_pre_blocks(markdown, pre_stash)

    links = _extract_links(article_html, url)

    return {
        "url": url,
        "title": title,
        "markdown": markdown.strip(),
        "tui_text": markdown.strip(),
        "links": links,
        "assets": [],
        "meta": {
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "cache": "miss",
            "source_bytes": source_bytes,
        },
    }


def _extract_links(html: str, base_url: str) -> List[Dict[str, Any]]:
    """Extract hyperlinks from HTML, returning id/text/url dicts."""
    pattern = re.compile(r'<a\s[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', re.IGNORECASE | re.DOTALL)
    links = []
    seen_urls = set()
    for idx, match in enumerate(pattern.finditer(html), start=1):
        href = match.group(1).strip()
        text = re.sub(r"<[^>]+>", "", match.group(2)).strip()
        if not href or href.startswith("#") or href.startswith("javascript:"):
            continue
        resolved = urljoin(base_url, href)
        if resolved in seen_urls:
            continue
        seen_urls.add(resolved)
        links.append({"id": idx, "text": text or resolved, "url": resolved})
    # Re-number after dedup
    for i, link in enumerate(links, start=1):
        link["id"] = i
    return links


class BrowserSession:
    """Tracks session history for back/forward navigation."""

    def __init__(self) -> None:
        self._history: List[Dict[str, Any]] = []
        self._index: int = -1

    @property
    def current(self) -> Optional[Dict[str, Any]]:
        if 0 <= self._index < len(self._history):
            return self._history[self._index]
        return None

    @property
    def can_go_back(self) -> bool:
        return self._index > 0

    @property
    def can_go_forward(self) -> bool:
        return self._index < len(self._history) - 1

    def navigate(self, bundle: Dict[str, Any]) -> None:
        """Push a new bundle, discarding any forward history."""
        self._index += 1
        self._history = self._history[: self._index]
        self._history.append(bundle)

    def back(self) -> Optional[Dict[str, Any]]:
        if self.can_go_back:
            self._index -= 1
            return self._history[self._index]
        return None

    def forward(self) -> Optional[Dict[str, Any]]:
        if self.can_go_forward:
            self._index += 1
            return self._history[self._index]
        return None
