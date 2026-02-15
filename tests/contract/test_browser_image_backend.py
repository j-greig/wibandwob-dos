from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import tools.api_server.browser_pipeline as pipeline


class _Resp:
    def __init__(self, *, text: str = "", content: bytes = b"") -> None:
        self.text = text
        self.content = content

    def raise_for_status(self) -> None:
        return None


def _mock_get(url: str, timeout: int = 30):  # pylint: disable=unused-argument
    if url.startswith("https://img.example.com/"):
        return _Resp(content=b"fake-image-bytes")
    return _Resp(
        text=(
            "<html><title>T</title><h1>H</h1>"
            "<img src='https://img.example.com/a.png' alt='a'/>"
            "<img src='https://img.example.com/b.png' alt='b'/>"
            "</html>"
        )
    )


def test_image_backend_renders_assets_with_meta(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(pipeline, "requests", SimpleNamespace(get=_mock_get))
    monkeypatch.setattr(pipeline.shutil, "which", lambda _: "/usr/bin/chafa")
    monkeypatch.setattr(
        pipeline.subprocess,
        "run",
        lambda *a, **k: SimpleNamespace(returncode=0, stdout="ANSI\nBLOCK", stderr=""),
    )

    bundle = pipeline.fetch_render_bundle(
        "https://example.com/with-images",
        image_mode="all-inline",
        cache_root=str(tmp_path),
    )
    assert bundle["assets"]
    assert any(a["status"] == "ready" for a in bundle["assets"])
    assert "render_meta" in bundle["assets"][0]


def test_image_backend_timeout_degrades_without_crash(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(pipeline, "requests", SimpleNamespace(get=_mock_get))
    monkeypatch.setattr(pipeline.shutil, "which", lambda _: "/usr/bin/chafa")

    def _timeout(*a, **k):
        raise subprocess.TimeoutExpired(cmd=["chafa"], timeout=1.5)

    monkeypatch.setattr(pipeline.subprocess, "run", _timeout)
    bundle = pipeline.fetch_render_bundle(
        "https://example.com/timeout-images",
        image_mode="all-inline",
        cache_root=str(tmp_path),
    )
    statuses = {a["status"] for a in bundle["assets"]}
    assert "deferred" in statuses or "failed" in statuses


def test_image_backend_cache_reuses_previous_render(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(pipeline, "requests", SimpleNamespace(get=_mock_get))
    monkeypatch.setattr(pipeline.shutil, "which", lambda _: "/usr/bin/chafa")
    calls = {"count": 0}

    def _run(*a, **k):
        calls["count"] += 1
        return SimpleNamespace(returncode=0, stdout="ANSI\nBLOCK", stderr="")

    monkeypatch.setattr(pipeline.subprocess, "run", _run)

    pipeline.fetch_render_bundle("https://example.com/cache-images", image_mode="all-inline", cache_root=str(tmp_path))
    pipeline.fetch_render_bundle("https://example.com/cache-images", image_mode="all-inline", cache_root=str(tmp_path))
    assert calls["count"] >= 1
    assert calls["count"] <= 2
