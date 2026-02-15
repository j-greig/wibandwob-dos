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


def test_render_bundle_contains_required_fields(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(
        pipeline,
        "requests",
        type("R", (), {"get": lambda url, timeout=30: _Resp("<html><title>T</title><h1>H</h1><a href='https://x'>x</a></html>")}),
    )
    bundle = pipeline.fetch_render_bundle("https://example.com/schema", cache_root=str(tmp_path))
    for key in ("url", "title", "markdown", "tui_text", "links", "assets", "meta"):
        assert key in bundle
