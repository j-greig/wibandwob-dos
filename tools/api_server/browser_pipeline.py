from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import time
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

try:
    import requests
except Exception:  # pragma: no cover
    requests = None

try:
    from PIL import Image
except Exception:  # pragma: no cover
    Image = None


MAX_IMAGE_SOURCE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_DIMENSION = 4096
MAX_RENDER_WIDTH_CELLS = 120
PER_IMAGE_RENDER_TIMEOUT_MS = 3000
TOTAL_IMAGE_RENDER_BUDGET_MS = 10000
MAX_TUI_TEXT_CHARS = 250000
PIPELINE_CACHE_VERSION = "v2"
KEY_INLINE_MAX_IMAGES = 5


def _debug_log(event: str, data: Dict[str, Any]) -> None:
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "event": event,
        "data": data,
    }
    try:
        p = Path("logs/browser/image-render.ndjson")
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, separators=(",", ":")) + "\n")
    except Exception:
        pass


def _needs_image_refresh(bundle: Dict[str, Any], image_mode: str) -> bool:
    if image_mode == "none":
        return False
    assets = list(bundle.get("assets", []))
    if not assets:
        return False
    for a in assets:
        status = str(a.get("status", ""))
        if status in ("failed", "deferred"):
            return True
        if status == "ready" and not a.get("ansi_block"):
            return True
    return False


def _cache_key(url: str, reader: str, width: int, image_mode: str) -> str:
    raw = f"{PIPELINE_CACHE_VERSION}|{url}|{reader}|{width}|{image_mode}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _image_cache_key(
    source_hash: str,
    mode: str,
    width_cells: int,
    backend: str,
    dither: str = "none",
    color_mode: str = "full",
) -> str:
    raw = f"{source_hash}|{mode}|{width_cells}|{backend}|{dither}|{color_mode}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _extract_title(html: str, url: str) -> str:
    m = re.search(r"<title>(.*?)</title>", html, flags=re.IGNORECASE | re.DOTALL)
    if m:
        return re.sub(r"\s+", " ", m.group(1)).strip()
    return url


def _extract_links(html: str, base_url: str) -> List[Dict[str, Any]]:
    links = []
    for idx, m in enumerate(
        re.finditer(
            r'<a[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
            html,
            flags=re.IGNORECASE | re.DOTALL,
        ),
        1,
    ):
        href = m.group(1).strip()
        text = re.sub(r"<[^>]+>", "", m.group(2))
        text = re.sub(r"\s+", " ", text).strip() or href
        links.append({"id": idx, "text": text, "url": urljoin(base_url, href)})
    return links


def _html_to_markdown(html: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", "", html)
    text = re.sub(r"(?i)<h1[^>]*>(.*?)</h1>", r"# \1\n", text)
    text = re.sub(r"(?i)<h2[^>]*>(.*?)</h2>", r"## \1\n", text)
    text = re.sub(r"(?i)<h3[^>]*>(.*?)</h3>", r"### \1\n", text)
    text = re.sub(r"(?i)<p[^>]*>(.*?)</p>", r"\1\n\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_image_assets(html: str, base_url: str) -> List[Dict[str, Any]]:
    assets: List[Dict[str, Any]] = []
    for idx, m in enumerate(re.finditer(r"<img\b([^>]*)>", html, flags=re.IGNORECASE | re.DOTALL), start=1):
        attrs = m.group(1)
        src_match = re.search(r'src=["\']([^"\']+)["\']', attrs, flags=re.IGNORECASE)
        if not src_match:
            continue
        src = src_match.group(1).strip()
        if not src:
            continue
        alt_match = re.search(r'alt=["\']([^"\']*)["\']', attrs, flags=re.IGNORECASE)
        alt = alt_match.group(1).strip() if alt_match else ""
        source_url = urljoin(base_url, src)
        assets.append(
            {
                "id": f"img{idx}",
                "source_url": source_url,
                "alt": alt,
                "anchor_index": idx,
                "status": "skipped",
                "render_meta": {"backend": "chafa", "width_cells": 0, "height_cells": 0, "duration_ms": 0, "cache_hit": False},
            }
        )
    return assets


def _clamp_width(width: int) -> int:
    return max(20, min(int(width), MAX_RENDER_WIDTH_CELLS))


def _select_assets(assets: List[Dict[str, Any]], mode: str) -> List[int]:
    if mode == "none":
        return []
    if mode == "all-inline":
        return list(range(len(assets)))
    if mode == "gallery":
        # Until a separate gallery pane is implemented in the native TUI browser,
        # render all assets inline for visibility.
        return list(range(len(assets)))
    if mode == "key-inline":
        # Hero + first few meaningful images (currently first N in document order).
        return list(range(min(KEY_INLINE_MAX_IMAGES, len(assets))))
    return []


def _probe_dimensions(image_bytes: bytes) -> Optional[Dict[str, int]]:
    if Image is None:
        return None
    try:
        with tempfile.NamedTemporaryFile(delete=True) as tmp:
            tmp.write(image_bytes)
            tmp.flush()
            with Image.open(tmp.name) as img:
                return {"w": int(img.width), "h": int(img.height)}
    except Exception:
        return None


def _run_chafa(image_bytes: bytes, width_cells: int, timeout_ms: int) -> Dict[str, Any]:
    if shutil.which("chafa") is None:
        return {"ok": False, "error": "chafa_not_found"}
    height_cells = max(1, min(80, width_cells // 2))
    with tempfile.NamedTemporaryFile(delete=True, suffix=".img") as tmp:
        tmp.write(image_bytes)
        tmp.flush()
        cmd = ["chafa", "--size", f"{width_cells}x{height_cells}", "--format", "symbols", "--animate", "off", tmp.name]
        try:
            started = time.perf_counter()
            proc = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=max(0.1, timeout_ms / 1000.0))
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            if proc.returncode != 0:
                return {"ok": False, "error": (proc.stderr.strip() or "chafa_error"), "duration_ms": elapsed_ms}
            return {"ok": True, "ansi_block": proc.stdout.rstrip("\n"), "duration_ms": elapsed_ms}
        except subprocess.TimeoutExpired:
            return {"ok": False, "error": "timeout", "duration_ms": timeout_ms}


def _cache_paths(image_cache_root: Path, key: str) -> Path:
    image_cache_root.mkdir(parents=True, exist_ok=True)
    return image_cache_root / f"{key}.json"


def _fetch_image_bytes(source_url: str) -> Dict[str, Any]:
    if requests is None:
        return {"ok": False, "error": "requests_unavailable"}
    headers = {"User-Agent": "WibWob-DOS/0.1"}
    try:
        try:
            resp = requests.get(source_url, timeout=15, headers=headers)
        except TypeError:
            # Test doubles may not accept extra kwargs.
            resp = requests.get(source_url, timeout=15)
        resp.raise_for_status()
        content = resp.content
    except requests.exceptions.SSLError:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                try:
                    resp = requests.get(source_url, timeout=15, headers=headers, verify=False)
                except TypeError:
                    resp = requests.get(source_url, timeout=15)
                resp.raise_for_status()
                content = resp.content
        except Exception as exc:
            return {"ok": False, "error": str(exc)}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

    if len(content) > MAX_IMAGE_SOURCE_BYTES:
        return {"ok": False, "error": "source_too_large", "source_bytes": len(content)}
    return {"ok": True, "content": content, "source_bytes": len(content)}


def _render_asset(
    asset: Dict[str, Any],
    mode: str,
    width_cells: int,
    image_cache_root: Path,
    budget_state: Dict[str, int],
) -> Dict[str, Any]:
    src = str(asset.get("source_url", ""))
    src_hash = hashlib.sha256(src.encode("utf-8")).hexdigest()
    cache_key = _image_cache_key(src_hash, mode, width_cells, "chafa")
    cache_path = _cache_paths(image_cache_root, cache_key)

    if cache_path.exists():
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        out = dict(asset)
        out["status"] = "ready"
        out["ansi_block"] = cached.get("ansi_block", "")
        meta = dict(cached.get("render_meta", {}))
        meta["cache_hit"] = True
        out["render_meta"] = meta
        _debug_log("image.cache_hit", {"source_url": src, "mode": mode, "status": "ready"})
        return out

    if budget_state["remaining_ms"] <= 0:
        out = dict(asset)
        out["status"] = "deferred"
        out["render_error"] = "budget_exhausted"
        out["render_meta"] = {"backend": "chafa", "width_cells": width_cells, "height_cells": 0, "duration_ms": 0, "cache_hit": False}
        _debug_log("image.deferred", {"source_url": src, "mode": mode, "reason": "budget_exhausted"})
        return out

    fetched = _fetch_image_bytes(src)
    if not fetched.get("ok"):
        out = dict(asset)
        out["status"] = "failed"
        out["render_error"] = str(fetched.get("error", "fetch_failed"))
        out["render_meta"] = {"backend": "chafa", "width_cells": width_cells, "height_cells": 0, "duration_ms": 0, "cache_hit": False}
        _debug_log("image.failed", {"source_url": src, "mode": mode, "reason": out["render_error"]})
        return out

    image_bytes = fetched["content"]
    dims = _probe_dimensions(image_bytes)
    if dims and (dims["w"] > MAX_IMAGE_DIMENSION or dims["h"] > MAX_IMAGE_DIMENSION):
        out = dict(asset)
        out["status"] = "failed"
        out["render_error"] = "dimensions_too_large"
        out["render_meta"] = {"backend": "chafa", "width_cells": width_cells, "height_cells": 0, "duration_ms": 0, "cache_hit": False}
        _debug_log("image.failed", {"source_url": src, "mode": mode, "reason": "dimensions_too_large", "dims": dims})
        return out

    timeout_ms = min(PER_IMAGE_RENDER_TIMEOUT_MS, budget_state["remaining_ms"])
    rendered = _run_chafa(image_bytes, width_cells=width_cells, timeout_ms=timeout_ms)
    duration_ms = int(rendered.get("duration_ms", 0))
    budget_state["remaining_ms"] = max(0, budget_state["remaining_ms"] - duration_ms)

    out = dict(asset)
    if not rendered.get("ok"):
        out["status"] = "failed" if rendered.get("error") != "timeout" else "deferred"
        out["render_error"] = str(rendered.get("error", "render_failed"))
        out["render_meta"] = {"backend": "chafa", "width_cells": width_cells, "height_cells": 0, "duration_ms": duration_ms, "cache_hit": False}
        _debug_log("image.failed", {"source_url": src, "mode": mode, "reason": out["render_error"], "duration_ms": duration_ms})
        return out

    ansi_block = rendered.get("ansi_block", "")
    out["status"] = "ready"
    out["ansi_block"] = ansi_block
    out["render_meta"] = {
        "backend": "chafa",
        "width_cells": width_cells,
        "height_cells": max(1, len(ansi_block.splitlines())) if ansi_block else 0,
        "duration_ms": duration_ms,
        "cache_hit": False,
    }
    _debug_log("image.ready", {"source_url": src, "mode": mode, "duration_ms": duration_ms, "bytes": fetched.get("source_bytes", 0)})
    cache_path.write_text(json.dumps({"ansi_block": ansi_block, "render_meta": out["render_meta"]}, sort_keys=True), encoding="utf-8")
    return out


def render_markdown(
    markdown: str,
    headings: str = "plain",
    images: str = "none",
    width: int = 80,
    assets: Optional[List[Dict[str, Any]]] = None,
) -> str:
    rendered = markdown
    if headings != "plain":
        rendered = rendered.replace("# ", "[H1] ").replace("## ", "[H2] ").replace("### ", "[H3] ")

    if images != "none":
        rendered += f"\n\n[images mode={images}]"

    if assets:
        rendered += "\n\n"
        if images == "gallery":
            rendered += f"[gallery assets={len(assets)}]\n"
        for asset in assets:
            alt = str(asset.get("alt") or asset.get("source_url", ""))
            status = str(asset.get("status", "skipped"))
            if status == "ready" and asset.get("ansi_block"):
                rendered += f"\n[image:{alt}]\n{asset['ansi_block']}\n"
            else:
                reason = str(asset.get("render_error", "")).strip()
                if reason:
                    rendered += f"\n[image:{alt}] ({status}: {reason})\n"
                else:
                    rendered += f"\n[image:{alt}] ({status})\n"

    return rendered[:MAX_TUI_TEXT_CHARS]


def _render_assets_for_mode(
    html: str,
    base_url: str,
    image_mode: str,
    width: int,
    image_cache_root: Path,
) -> List[Dict[str, Any]]:
    assets = _extract_image_assets(html, base_url)
    if not assets:
        return []

    selected = set(_select_assets(assets, image_mode))
    width_cells = _clamp_width(width)
    budget_state = {"remaining_ms": TOTAL_IMAGE_RENDER_BUDGET_MS}
    rendered_assets: List[Dict[str, Any]] = []

    for idx, asset in enumerate(assets):
        if image_mode == "none":
            out = dict(asset)
            out["status"] = "skipped"
            rendered_assets.append(out)
            continue
        if idx not in selected:
            out = dict(asset)
            out["status"] = "skipped"
            rendered_assets.append(out)
            continue
        rendered_assets.append(_render_asset(asset, image_mode, width_cells, image_cache_root, budget_state))

    return rendered_assets


def fetch_render_bundle(
    url: str,
    reader: str = "readability",
    width: int = 80,
    image_mode: str = "none",
    cache_root: str = "cache/browser",
) -> Dict[str, Any]:
    _debug_log(
        "bundle.fetch_start",
        {"url": url, "reader": reader, "width": width, "image_mode": image_mode, "cache_root": cache_root},
    )
    cache_dir = Path(cache_root)
    cache_dir.mkdir(parents=True, exist_ok=True)
    key = _cache_key(url, reader, width, image_mode)
    entry_dir = cache_dir / key
    bundle_path = entry_dir / "bundle.json"
    image_cache_root = cache_dir / "images"

    if bundle_path.exists():
        bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
        if not _needs_image_refresh(bundle, image_mode=image_mode):
            bundle["meta"]["cache"] = "hit"
            _debug_log(
                "bundle.cache_hit",
                {
                    "url": url,
                    "image_mode": image_mode,
                    "cache_key": key,
                    "assets": len(bundle.get("assets", [])),
                },
            )
            return bundle
        _debug_log(
            "bundle.cache_stale",
            {
                "url": url,
                "image_mode": image_mode,
                "cache_key": key,
                "reason": "failed_or_deferred_assets",
            },
        )

    raw_html_path = entry_dir / "raw.html"
    direct_image_mode = False
    if raw_html_path.exists():
        html = raw_html_path.read_text(encoding="utf-8")
    elif requests is None:
        html = f"<html><title>{url}</title><h1>{url}</h1><p>offline mode</p></html>"
    else:
        headers = {"User-Agent": "WibWob-DOS/0.1"}
        try:
            try:
                resp = requests.get(url, timeout=30, headers=headers)
            except TypeError:
                resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            ctype = str(resp.headers.get("content-type", "")).lower()
            if ctype.startswith("image/"):
                direct_image_mode = True
                html = ""
            else:
                html = resp.text
        except requests.exceptions.SSLError:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                try:
                    resp = requests.get(url, timeout=30, headers=headers, verify=False)
                except TypeError:
                    resp = requests.get(url, timeout=30)
                resp.raise_for_status()
                ctype = str(resp.headers.get("content-type", "")).lower()
                if ctype.startswith("image/"):
                    direct_image_mode = True
                    html = ""
                else:
                    html = resp.text

    if direct_image_mode:
        title = url
        links = []
        markdown = f"# Image\n\n{url}"
        assets = [
            {
                "id": "img1",
                "source_url": url,
                "alt": "direct image",
                "anchor_index": 1,
                "status": "skipped",
                "render_meta": {"backend": "chafa", "width_cells": 0, "height_cells": 0, "duration_ms": 0, "cache_hit": False},
            }
        ]
        if image_mode != "none":
            budget_state = {"remaining_ms": TOTAL_IMAGE_RENDER_BUDGET_MS}
            assets = [_render_asset(assets[0], image_mode, _clamp_width(width), image_cache_root, budget_state)]
    else:
        title = _extract_title(html, url)
        links = _extract_links(html, url)
        markdown = _html_to_markdown(html)
        assets = _render_assets_for_mode(html, base_url=url, image_mode=image_mode, width=width, image_cache_root=image_cache_root)
    tui_text = render_markdown(markdown, headings="plain", images=image_mode, width=width, assets=assets)
    bundle = {
        "url": url,
        "title": title,
        "markdown": markdown,
        "tui_text": tui_text,
        "links": links,
        "assets": assets,
        "meta": {
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "cache": "miss",
            "source_bytes": len(html.encode("utf-8")),
            "cache_key": key,
            "image_mode": image_mode,
        },
    }
    ready = sum(1 for a in assets if a.get("status") == "ready")
    failed = sum(1 for a in assets if a.get("status") == "failed")
    deferred = sum(1 for a in assets if a.get("status") == "deferred")
    skipped = sum(1 for a in assets if a.get("status") == "skipped")
    _debug_log(
        "bundle.fetch_done",
        {
            "url": url,
            "image_mode": image_mode,
            "cache": "miss",
            "assets_total": len(assets),
            "ready": ready,
            "failed": failed,
            "deferred": deferred,
            "skipped": skipped,
            "source_bytes": bundle["meta"].get("source_bytes", 0),
            "cache_key": key,
        },
    )

    entry_dir.mkdir(parents=True, exist_ok=True)
    bundle_path.write_text(json.dumps(bundle, sort_keys=True), encoding="utf-8")
    (entry_dir / "raw.html").write_text(html, encoding="utf-8")
    (entry_dir / "content.md").write_text(markdown, encoding="utf-8")
    return bundle
