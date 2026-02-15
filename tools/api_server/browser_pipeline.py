from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

try:
    import requests
except Exception:  # pragma: no cover
    requests = None


def _cache_key(url: str, reader: str, width: int, image_mode: str) -> str:
    raw = f"{url}|{reader}|{width}|{image_mode}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _extract_title(html: str, url: str) -> str:
    m = re.search(r"<title>(.*?)</title>", html, flags=re.IGNORECASE | re.DOTALL)
    if m:
        return re.sub(r"\s+", " ", m.group(1)).strip()
    return url


def _extract_links(html: str, base_url: str) -> List[Dict[str, Any]]:
    links = []
    for idx, m in enumerate(re.finditer(r'<a[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', html, flags=re.IGNORECASE | re.DOTALL), 1):
        href = m.group(1).strip()
        text = re.sub(r"<[^>]+>", "", m.group(2))
        text = re.sub(r"\s+", " ", text).strip() or href
        links.append({"id": idx, "text": text, "url": href, "base_url": base_url})
    return links


def _html_to_markdown(html: str) -> str:
    # Minimal markdown conversion for S04-S05 MVP.
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", "", html)
    text = re.sub(r"(?i)<h1[^>]*>(.*?)</h1>", r"# \1\n", text)
    text = re.sub(r"(?i)<h2[^>]*>(.*?)</h2>", r"## \1\n", text)
    text = re.sub(r"(?i)<h3[^>]*>(.*?)</h3>", r"### \1\n", text)
    text = re.sub(r"(?i)<p[^>]*>(.*?)</p>", r"\1\n\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def render_markdown(markdown: str, headings: str = "plain", images: str = "none", width: int = 80) -> str:
    rendered = markdown
    if headings != "plain":
        rendered = rendered.replace("# ", "[H1] ").replace("## ", "[H2] ").replace("### ", "[H3] ")
    if images != "none":
        rendered += f"\n\n[images mode={images}]"
    return rendered[: max(2000, width * 40)]


def fetch_render_bundle(
    url: str,
    reader: str = "readability",
    width: int = 80,
    image_mode: str = "none",
    cache_root: str = "cache/browser",
) -> Dict[str, Any]:
    cache_dir = Path(cache_root)
    cache_dir.mkdir(parents=True, exist_ok=True)
    key = _cache_key(url, reader, width, image_mode)
    entry_dir = cache_dir / key
    bundle_path = entry_dir / "bundle.json"

    if bundle_path.exists():
        bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
        bundle["meta"]["cache"] = "hit"
        return bundle

    if requests is None:
        html = f"<html><title>{url}</title><h1>{url}</h1><p>offline mode</p></html>"
    else:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        html = resp.text

    title = _extract_title(html, url)
    links = _extract_links(html, url)
    markdown = _html_to_markdown(html)
    tui_text = render_markdown(markdown, headings="plain", images=image_mode, width=width)
    bundle = {
        "url": url,
        "title": title,
        "markdown": markdown,
        "tui_text": tui_text,
        "links": links,
        "assets": [],
        "meta": {
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "cache": "miss",
            "source_bytes": len(html.encode("utf-8")),
            "cache_key": key,
        },
    }

    entry_dir.mkdir(parents=True, exist_ok=True)
    bundle_path.write_text(json.dumps(bundle, sort_keys=True), encoding="utf-8")
    (entry_dir / "raw.html").write_text(html, encoding="utf-8")
    (entry_dir / "content.md").write_text(markdown, encoding="utf-8")
    return bundle
