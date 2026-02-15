from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import tools.api_server.browser_pipeline as pipeline


class _Resp:
    def __init__(self, text: str) -> None:
        self.text = text

    def raise_for_status(self) -> None:
        return None


def test_fetch_bundle_uses_cache(monkeypatch, tmp_path: Path) -> None:
    calls = {"count": 0}

    def _get(url: str, timeout: int = 30):
        calls["count"] += 1
        return _Resp(f"<html><title>{url}</title><h1>Hello</h1><p>world</p></html>")

    monkeypatch.setattr(pipeline, "requests", type("R", (), {"get": _get}))

    b1 = pipeline.fetch_render_bundle("https://example.com/cache", cache_root=str(tmp_path))
    b2 = pipeline.fetch_render_bundle("https://example.com/cache", cache_root=str(tmp_path))
    assert calls["count"] == 1
    assert b1["meta"]["cache"] == "miss"
    assert b2["meta"]["cache"] == "hit"
