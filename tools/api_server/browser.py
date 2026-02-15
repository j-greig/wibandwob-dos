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
from markdownify import markdownify as md
from readability import Document


def fetch_and_convert(url: str) -> Dict[str, Any]:
    """Fetch a URL and return a RenderBundle dict.

    Pipeline: requests.get → readability extract → markdownify → bundle.
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

    doc = Document(resp.text)
    title = doc.title()
    article_html = doc.summary()

    markdown = md(article_html, heading_style="ATX", strip=["img", "script", "style"])
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
