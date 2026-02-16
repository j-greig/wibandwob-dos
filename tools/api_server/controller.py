from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, List, Optional
from pathlib import Path
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from urllib.parse import urljoin

from .events import EventHub
from .browser_pipeline import fetch_render_bundle, render_markdown
from .models import AppState, Rect, Window, WindowType, new_id
from .ipc_client import send_cmd
from .schemas import (
    BatchLayoutRequest, 
    BatchLayoutResponse, 
    BatchOp, 
    BatchOpResult,
    BoundsModel, 
    TimelineSummary,
)
from .monodraw_parser import MonodrawParser, MonodrawLayer, scale_coordinates
import json
import tempfile
import os

ANSI_CSI_RE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")


def _strip_ansi(text: str) -> str:
    return ANSI_CSI_RE.sub("", text or "")


def _copy_text_to_system_clipboard(text: str) -> Dict[str, Any]:
    content = str(text or "")
    if not content:
        return {"ok": False, "error": "empty_content"}

    commands: List[List[str]] = []
    if sys.platform == "darwin":
        commands.append(["pbcopy"])
    elif sys.platform.startswith("win"):
        commands.append(["powershell", "-NoProfile", "-Command", "Set-Clipboard"])
        commands.append(["clip"])
    else:
        if shutil.which("wl-copy"):
            commands.append(["wl-copy"])
        if shutil.which("xclip"):
            commands.append(["xclip", "-selection", "clipboard"])
        if shutil.which("xsel"):
            commands.append(["xsel", "--clipboard", "--input"])

    if not commands:
        return {"ok": False, "error": "clipboard_unavailable"}

    last_err = "clipboard_write_failed"
    for cmd in commands:
        try:
            subprocess.run(cmd, input=content, text=True, check=True, capture_output=True)
            return {"ok": True, "command": " ".join(cmd)}
        except Exception as exc:  # pragma: no cover - platform dependent
            last_err = str(exc)

    return {"ok": False, "error": last_err}


class Controller:
    """In-memory controller for the API MVP.

    Designed to be replaced by an IPC-backed adapter that forwards calls to
    the Turbo Vision app and reflects authoritative state back.
    """

    def __init__(self, events: EventHub) -> None:
        self._state = AppState()
        self._events = events
        self._lock = asyncio.Lock()
        # Batch layout support
        self._requests: Dict[str, BatchLayoutResponse] = {}
        self._timelines: Dict[str, List[asyncio.Task]] = {}
        # Repo root (two levels up from this file)
        self._repo_root = Path(__file__).resolve().parents[2]
        default_log_path = self._repo_root / "logs" / "state" / "events.ndjson"
        self._state_event_log_path = Path(os.environ.get("WWD_STATE_EVENT_LOG_PATH", str(default_log_path)))

    # ----- Query -----
    async def get_state(self) -> AppState:
        await self._sync_state()
        return self._state

    async def get_registry_capabilities(self) -> Dict[str, Any]:
        """Fetch canonical command capabilities from the C++ registry via IPC."""
        try:
            resp = send_cmd("get_capabilities")
            if resp and resp.strip().startswith("{"):
                data = json.loads(resp.strip())
                if isinstance(data, dict):
                    return data
        except Exception:
            pass
        return {"version": "v1", "commands": []}

    async def get_capabilities(self) -> Dict[str, Any]:
        """Return API capabilities derived from canonical C++ command metadata."""
        registry = await self.get_registry_capabilities()
        command_names = [
            cmd.get("name")
            for cmd in registry.get("commands", [])
            if isinstance(cmd, dict) and cmd.get("name")
        ]
        return {
            "version": registry.get("version", "v1"),
            "window_types": [t.value for t in WindowType],
            "commands": command_names,
            "properties": {
                "frame_player": {"fps": {"type": "number", "min": 1, "max": 120}},
                "test_pattern": {"variant": {"type": "string"}},
            },
        }

    async def _sync_state(self) -> None:
        """Sync in-memory state with the real C++ app via IPC"""
        try:
            resp = send_cmd("get_state")
            if resp and resp.strip():
                # Parse JSON response
                state_data = json.loads(resp.strip())
                
                async with self._lock:
                    # Update theme state from C++
                    self._state.theme_mode = state_data.get("theme_mode", "light")
                    self._state.theme_variant = state_data.get("theme_variant", "monochrome")

                    # Update windows list with real IDs from C++
                    new_windows = []
                    for win_data in state_data.get("windows", []):
                        win = Window(
                            id=win_data["id"],
                            type=WindowType.test_pattern,  # Default for now
                            title=win_data["title"],
                            rect=Rect(
                                x=win_data["x"],
                                y=win_data["y"],
                                w=win_data["width"],
                                h=win_data["height"]
                            ),
                            z=0,  # C++ doesn't provide z-order
                            focused=False,  # Will be determined later
                            props={}
                        )
                        new_windows.append(win)

                    self._state.windows = new_windows
                    
            # Get canvas size separately
            canvas_resp = send_cmd("get_canvas_size")
            if canvas_resp and canvas_resp.strip():
                canvas_data = json.loads(canvas_resp.strip())
                self._state.canvas_width = canvas_data.get("width", 80)
                self._state.canvas_height = canvas_data.get("height", 25)
        except Exception:
            # If sync fails, keep existing state
            pass

    # ----- Windows -----
    async def create_window(
        self,
        wtype: WindowType,
        title: Optional[str],
        rect: Optional[Rect],
        props: Dict[str, Any],
    ) -> Window:
        # Try forwarding to the live app via IPC (best-effort)
        try:
            cmd_params = {"type": wtype.value}
            
            # Add positioning parameters if rect is provided
            if rect:
                cmd_params.update({
                    "x": str(rect.x),
                    "y": str(rect.y), 
                    "w": str(rect.w),
                    "h": str(rect.h)
                })
            
            if wtype == WindowType.test_pattern:
                send_cmd("create_window", cmd_params)
            elif wtype == WindowType.gradient:
                kind = str(props.get("gradient", "horizontal"))
                cmd_params["gradient"] = kind
                send_cmd("create_window", cmd_params)
            elif wtype in (WindowType.frame_player, WindowType.text_view):
                path = str(props.get("path", ""))
                if path:
                    cmd_params["path"] = path
                    send_cmd("create_window", cmd_params)
            elif wtype == WindowType.text_editor:
                send_cmd("create_window", cmd_params)
        except Exception:
            pass
        async with self._lock:
            win_id = new_id("win")
            if not rect:
                rect = Rect(3 + len(self._state.windows) * 2, 2 + len(self._state.windows) * 1, 40, 12)
            t = title or wtype.value
            win = Window(
                id=win_id,
                type=wtype,
                title=t,
                rect=rect,
                z=self._state.next_z,
                focused=True,
                props=props or {},
            )
            self._state.next_z += 1
            # unfocus others
            for w in self._state.windows:
                w.focused = False
            self._state.windows.append(win)
        await self._events.emit("window.created", self._serialize_window(win))
        self._append_state_event("window.created", {"window_id": win.id, "type": win.type.value}, actor="api")
        return win

    async def move_resize(self, win_id: str, *, x=None, y=None, w=None, h=None) -> Window:
        # Sync state first to get current window info
        await self._sync_state()
        
        try:
            # Find the window after syncing
            win = self._require(win_id)
            
            if x is not None or y is not None:
                move_x = x if x is not None else win.rect.x
                move_y = y if y is not None else win.rect.y
                send_cmd("move_window", {"id": win_id, "x": str(move_x), "y": str(move_y)})
            
            if w is not None or h is not None:
                new_w = w if w is not None else win.rect.w
                new_h = h if h is not None else win.rect.h
                send_cmd("resize_window", {"id": win_id, "width": str(new_w), "height": str(new_h)})
        except Exception:
            pass
        
        # Sync state again and return updated window
        await self._sync_state()
        try:
            win = self._require(win_id)
            await self._events.emit("window.updated", self._serialize_window(win))
            self._append_state_event("window.moved_or_resized", {"window_id": win_id}, actor="api")
            return win
        except KeyError:
            raise KeyError(win_id)

    async def focus(self, win_id: str) -> Window:
        # Send focus command to C++ app
        try:
            send_cmd("focus_window", {"id": win_id})
        except Exception:
            pass
        
        # Sync state and return focused window
        await self._sync_state()
        try:
            win = self._require(win_id)
            await self._events.emit("window.updated", self._serialize_window(win))
            return win
        except KeyError:
            raise KeyError(win_id)

    async def clone(self, win_id: str) -> Window:
        async with self._lock:
            src = self._require(win_id)
            new_rect = Rect(src.rect.x + 2, src.rect.y + 1, src.rect.w, src.rect.h)
            clone = Window(
                id=new_id("win"),
                type=src.type,
                title=f"{src.title} (copy)",
                rect=new_rect,
                z=self._state.next_z,
                focused=True,
                props=dict(src.props),
            )
            self._state.next_z += 1
            for w in self._state.windows:
                w.focused = False
            self._state.windows.append(clone)
        await self._events.emit("window.created", self._serialize_window(clone))
        return clone

    async def close(self, win_id: str) -> None:
        # Send close command to C++ app
        try:
            send_cmd("close_window", {"id": win_id})
        except Exception:
            pass
        
        # Sync state and emit event
        await self._sync_state()
        await self._events.emit("window.closed", {"id": win_id})
        self._append_state_event("window.closed", {"window_id": win_id}, actor="api")

    async def close_all(self) -> None:
        try:
            send_cmd("close_all")
        except Exception:
            pass
        async with self._lock:
            ids = [w.id for w in self._state.windows]
            self._state.windows.clear()
        for wid in ids:
            await self._events.emit("window.closed", {"id": wid})
            self._append_state_event("window.closed", {"window_id": wid}, actor="api")

    async def cascade(self) -> None:
        try:
            send_cmd("cascade")
        except Exception:
            pass
        async with self._lock:
            x, y = 3, 2
            for w in self._state.windows:
                w.rect.x, w.rect.y = x, y
                x += 2
                y += 1
        await self._events.emit("layout.cascade", {})
        self._append_state_event("layout.cascade", {}, actor="api")

    async def tile(self, cols: int = 2) -> None:
        try:
            send_cmd("tile", {"cols": str(cols)})
        except Exception:
            pass
        async with self._lock:
            if not self._state.windows:
                return
            # simple grid tile
            col = 0
            row = 0
            base_w, base_h = 40, 12
            for w in self._state.windows:
                w.rect.x = col * (base_w + 2) + 2
                w.rect.y = row * (base_h + 1) + 1
                w.rect.w = base_w
                w.rect.h = base_h
                col += 1
                if col >= cols:
                    col = 0
                    row += 1
        await self._events.emit("layout.tile", {"cols": cols})
        self._append_state_event("layout.tile", {"cols": cols}, actor="api")

    # ----- Properties / Commands -----
    async def set_props(self, win_id: str, props: Dict[str, Any]) -> Window:
        async with self._lock:
            win = self._require(win_id)
            win.props.update(props)
        await self._events.emit("window.updated", self._serialize_window(win))
        return win

    async def send_text(self, win_id: str, content: str, mode: str = "append", position: str = "end") -> Dict[str, Any]:
        """Send text to a text editor window"""
        try:
            print(f"[DEBUG] send_text called: win_id={win_id}, content_len={len(content)}, mode={mode}, position={position}")
            print(f"[DEBUG] Content has {content.count(chr(10))} newlines")

            # Forward to the live app via IPC
            print(f"[DEBUG] Calling send_cmd...")
            resp = send_cmd("send_text", {
                "id": win_id,
                "content": content,
                "mode": mode,
                "position": position
            })
            if isinstance(resp, str) and resp.lower().startswith("err"):
                raise RuntimeError(resp)
            print(f"[DEBUG] send_cmd completed successfully")

            # Persist injected content for debugging/traceability
            self._maybe_write_spawn_log(win_id, content)

            # Update in-memory state (simplified)
            # Skip state update for "auto" (C++ side will find/create editor)
            if win_id != "auto":
                async with self._lock:
                    win = self._require(win_id)
                    if win.type == WindowType.text_editor:
                        if "content" not in win.props:
                            win.props["content"] = ""

                        if mode == "replace":
                            win.props["content"] = content
                        elif mode == "append":
                            win.props["content"] += content
                        # For insert mode, we'd need cursor position - simplified for MVP

            await self._events.emit("text.sent", {"window_id": win_id, "content": content, "mode": mode})
            return {"ok": True, "window_id": win_id}

        except Exception as e:
            return {"ok": False, "error": str(e)}

    def _maybe_write_spawn_log(self, win_id: str, content: str) -> None:
        """Write injected content to a timestamped file at repo root for audit/debug."""
        if not content:
            return
        try:
            ts = datetime.now().strftime("%y%m%d-%H%M")
            # Build a slug from window id and first few words
            first_words = " ".join(content.strip().split()[:5])
            raw_slug = f"{win_id}-{first_words}" if win_id else first_words
            raw_slug = raw_slug or "content"
            slug = re.sub(r"[^a-zA-Z0-9-]+", "-", raw_slug).strip("-")
            if not slug:
                slug = "content"
            fname = f"{ts}-{slug[:40]}-spawned.txt"
            target = self._repo_root / fname
            with open(target, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"[DEBUG] spawn log written: {target}")
        except Exception as e:
            print(f"[WARN] failed to write spawn log: {e}")

    async def send_figlet(self, win_id: str, text: str, font: str = "standard", width: int = 0, mode: str = "append") -> Dict[str, Any]:
        """Send figlet ASCII art to a text editor window"""
        try:
            # Forward to the live app via IPC
            resp = send_cmd("send_figlet", {
                "id": win_id,
                "text": text,
                "font": font,
                "width": str(width) if width > 0 else "",
                "mode": mode
            })
            if isinstance(resp, str) and resp.lower().startswith("err"):
                raise RuntimeError(resp)
            
            # Update in-memory state (simplified)
            async with self._lock:
                win = self._require(win_id)
                if win.type == WindowType.text_editor:
                    if "figlet_history" not in win.props:
                        win.props["figlet_history"] = []
                    win.props["figlet_history"].append({"text": text, "font": font, "width": width})
                    
            await self._events.emit("figlet.sent", {"window_id": win_id, "text": text, "font": font, "mode": mode})
            return {"ok": True, "window_id": win_id, "text": text, "font": font}
            
        except Exception as e:
            return {"ok": False, "error": str(e)}

    async def exec_command(self, name: str, args: Dict[str, Any], actor: str = "api") -> Dict[str, Any]:
        handled = {"command": name, "ok": True, "actor": actor or "api"}
        payload: Dict[str, str] = {"name": name}
        payload["actor"] = handled["actor"]
        for key, value in (args or {}).items():
            payload[key] = str(value)
        try:
            resp = send_cmd("exec_command", payload)
            if isinstance(resp, str) and resp.lower().startswith("err"):
                handled["ok"] = False
                handled["error"] = resp
        except Exception as exc:
            handled["ok"] = False
            handled["error"] = str(exc)

        # Refresh mirrored state after command execution for best-effort parity.
        if handled["ok"]:
            await self._sync_state()
        await self._events.emit("command.executed", handled)
        self._append_state_event("command.executed", {"command": name}, actor=handled["actor"])
        return handled

    async def set_pattern_mode(self, mode: str) -> None:
        try:
            send_cmd("pattern_mode", {"mode": mode})
        except Exception:
            pass
        async with self._lock:
            self._state.pattern_mode = mode
        await self._events.emit("pattern.mode", {"mode": mode})

    async def set_theme_mode(self, mode: str) -> Dict[str, Any]:
        """Set theme mode (light or dark) via command registry"""
        return await self.exec_command("set_theme_mode", {"mode": mode})

    async def set_theme_variant(self, variant: str) -> Dict[str, Any]:
        """Set theme variant (monochrome or dark_pastel) via command registry"""
        return await self.exec_command("set_theme_variant", {"variant": variant})

    async def reset_theme(self) -> Dict[str, Any]:
        """Reset theme to defaults (monochrome + light) via command registry"""
        return await self.exec_command("reset_theme", {})

    # ----- Workspace / Screenshot -----
    async def save_workspace(self, path: str) -> Dict[str, Any]:
        res = await self.export_state(path, "json")
        if not res.get("ok"):
            return res
        async with self._lock:
            self._state.last_workspace = path
        await self._events.emit("workspace.saved", {"path": path})
        return {"ok": True, "path": path, "format": "json", "fallback": bool(res.get("fallback", False))}

    async def open_workspace(self, path: str) -> Dict[str, Any]:
        res = await self.import_state(path, "replace")
        if not res.get("ok"):
            return res
        async with self._lock:
            self._state.last_workspace = path
        await self._events.emit("workspace.opened", {"path": path})
        return {"ok": True, "path": path, "mode": "replace", "fallback": bool(res.get("fallback", False))}

    async def screenshot(self, path: Optional[str]) -> Dict[str, Any]:
        """Capture screenshot via canonical app command path and verify output exists."""
        start_ts = time.time()
        shots_dir = self._repo_root / "screenshots"
        shots_dir.mkdir(parents=True, exist_ok=True)

        try:
            resp = send_cmd("screenshot")
            if isinstance(resp, str) and resp.lower().startswith("err"):
                return {"ok": False, "error": "screenshot_command_failed", "detail": resp}
        except Exception as exc:
            return {"ok": False, "error": "screenshot_ipc_failed", "detail": str(exc)}

        # The app emits tui_<timestamp>.{txt,ans}; wait briefly for filesystem visibility.
        generated: List[Path] = []
        for _ in range(30):
            candidates = sorted(
                (
                    p for p in shots_dir.glob("tui_*")
                    if p.suffix in {".txt", ".ans"}
                    and p.exists()
                    and p.stat().st_mtime >= (start_ts - 0.2)
                ),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            if candidates:
                generated = candidates
                break
            await asyncio.sleep(0.05)

        if not generated:
            return {"ok": False, "error": "screenshot_missing_output", "detail": "no_capture_files_found"}

        def _select_source(ext: Optional[str]) -> Path:
            if ext:
                for p in generated:
                    if p.suffix.lower() == ext.lower():
                        return p
            for preferred in (".txt", ".ans"):
                for p in generated:
                    if p.suffix == preferred:
                        return p
            return generated[0]

        requested = (path or "").strip()
        if requested:
            target = Path(requested)
            if not target.is_absolute():
                target = self._repo_root / target
            source = _select_source(target.suffix if target.suffix else None)
            try:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
            except Exception as exc:
                return {
                    "ok": False,
                    "error": "screenshot_copy_failed",
                    "detail": str(exc),
                    "source_path": str(source),
                    "requested_path": str(target),
                }
            final_path = target
        else:
            source = _select_source(None)
            final_path = source

        if not final_path.exists():
            return {"ok": False, "error": "screenshot_missing_output", "detail": str(final_path)}

        size_bytes = int(final_path.stat().st_size)
        result = {
            "ok": True,
            "path": str(final_path),
            "backend": "ipc_screenshot",
            "source_path": str(source),
            "file_exists": True,
            "bytes": size_bytes,
        }

        async with self._lock:
            self._state.last_screenshot = str(final_path)
        await self._events.emit("screenshot.saved", result)
        return result

    # ----- Browser -----
    async def browser_open(
        self,
        url: str,
        window_id: Optional[str] = None,
        mode: str = "new",
        record_history: bool = True,
    ) -> Dict[str, Any]:
        if mode == "same" and window_id:
            win = self._require(window_id)
            if win.type != WindowType.browser:
                raise KeyError(window_id)
        else:
            win = await self.create_window(
                WindowType.browser,
                "Browser",
                Rect(2, 1, 100, 30),
                {},
            )
        image_mode = str(win.props.get("image_mode", "none"))
        render_mode = str(win.props.get("render_mode", "plain"))
        bundle = fetch_render_bundle(url, width=win.rect.w, image_mode=image_mode)
        win.title = str(bundle.get("title", "Browser"))
        tui_text = render_markdown(
            str(bundle.get("markdown", "")),
            headings=render_mode,
            images=image_mode,
            width=win.rect.w,
            assets=list(bundle.get("assets", [])),
        )

        history = list(win.props.get("history", []))
        if record_history:
            history.append(url)
            history_index = len(history) - 1
        else:
            history_index = int(win.props.get("history_index", max(0, len(history) - 1)))
        win.props.update(
            {
                "url": url,
                "history": history,
                "history_index": history_index,
                "markdown": bundle.get("markdown", ""),
                "tui_text": tui_text,
                "links": bundle.get("links", []),
                "assets": bundle.get("assets", []),
                "render_mode": render_mode,
                "image_mode": image_mode,
            }
        )
        await self._events.emit("browser.opened", {"window_id": win.id, "url": url})
        self._append_state_event("browser.opened", {"window_id": win.id, "url": url}, actor="api")
        return {"ok": True, "window_id": win.id, "url": url, "title": bundle.get("title", url), "bundle": bundle}

    async def browser_back(self, window_id: str) -> Dict[str, Any]:
        win = self._require(window_id)
        history = list(win.props.get("history", []))
        idx = int(win.props.get("history_index", 0))
        if idx <= 0:
            return {"ok": False, "error": "no_back_history"}
        idx -= 1
        win.props["history_index"] = idx
        url = history[idx]
        return await self.browser_open(url, window_id=window_id, mode="same", record_history=False)

    async def browser_forward(self, window_id: str) -> Dict[str, Any]:
        win = self._require(window_id)
        history = list(win.props.get("history", []))
        idx = int(win.props.get("history_index", 0))
        if idx >= len(history) - 1:
            return {"ok": False, "error": "no_forward_history"}
        idx += 1
        win.props["history_index"] = idx
        url = history[idx]
        return await self.browser_open(url, window_id=window_id, mode="same", record_history=False)

    async def browser_refresh(self, window_id: str) -> Dict[str, Any]:
        win = self._require(window_id)
        url = str(win.props.get("url", ""))
        return await self.browser_open(url, window_id=window_id, mode="same", record_history=False)

    async def browser_find(self, window_id: str, query: str, direction: str = "next") -> Dict[str, Any]:
        win = self._require(window_id)
        text = str(win.props.get("tui_text", ""))
        idx = text.lower().find(query.lower())
        return {"ok": idx >= 0, "index": idx, "direction": direction}

    async def browser_set_mode(self, window_id: str, headings: Optional[str], images: Optional[str]) -> Dict[str, Any]:
        win = self._require(window_id)
        if headings:
            win.props["render_mode"] = headings
        if images:
            win.props["image_mode"] = images
        current_url = str(win.props.get("url", ""))
        if current_url:
            bundle = fetch_render_bundle(
                current_url,
                width=win.rect.w,
                image_mode=str(win.props.get("image_mode", "none")),
            )
            win.props["markdown"] = bundle.get("markdown", "")
            win.props["links"] = bundle.get("links", [])
            win.props["assets"] = bundle.get("assets", [])
        win.props["tui_text"] = render_markdown(
            str(win.props.get("markdown", "")),
            headings=str(win.props.get("render_mode", "plain")),
            images=str(win.props.get("image_mode", "none")),
            width=win.rect.w,
            assets=list(win.props.get("assets", [])),
        )
        return {"ok": True, "window_id": window_id, "render_mode": win.props.get("render_mode"), "image_mode": win.props.get("image_mode")}

    async def browser_fetch(
        self,
        url: str,
        reader: str = "readability",
        fmt: str = "tui_bundle",
        images: str = "none",
        width: int = 80,
    ) -> Dict[str, Any]:
        bundle = fetch_render_bundle(url, reader=reader, width=width, image_mode=images)
        if fmt == "markdown":
            return {"ok": True, "url": url, "markdown": bundle.get("markdown", ""), "meta": bundle.get("meta", {})}
        return {"ok": True, "bundle": bundle}

    async def browser_render(self, markdown: str, headings: str = "plain", images: str = "none", width: int = 80) -> Dict[str, Any]:
        return {"ok": True, "tui_text": render_markdown(markdown, headings=headings, images=images, width=width, assets=[])}

    async def browser_get_content(self, window_id: str, fmt: str = "text") -> Dict[str, Any]:
        win = self._require(window_id)
        if fmt == "markdown":
            return {"ok": True, "content": win.props.get("markdown", "")}
        if fmt == "links":
            return {"ok": True, "links": win.props.get("links", [])}
        return {"ok": True, "content": win.props.get("tui_text", "")}

    async def browser_summarise(self, window_id: str, target: str = "new_window") -> Dict[str, Any]:
        win = self._require(window_id)
        text = str(win.props.get("markdown", ""))
        summary = (text[:400] + "...") if len(text) > 400 else text
        if target == "new_window":
            new_win = await self.create_window(WindowType.text_editor, "Summary", Rect(6, 4, 90, 22), {"content": summary})
            return {"ok": True, "window_id": new_win.id, "summary": summary}
        return {"ok": True, "summary": summary}

    async def browser_extract_links(self, window_id: str, pattern: Optional[str] = None) -> Dict[str, Any]:
        win = self._require(window_id)
        links = list(win.props.get("links", []))
        if pattern:
            try:
                rx = re.compile(pattern)
                links = [l for l in links if rx.search(str(l.get("url", ""))) or rx.search(str(l.get("text", "")))]
            except re.error as exc:
                return {"ok": False, "error": str(exc)}
        return {"ok": True, "links": links}

    async def browser_clip(self, window_id: str, path: Optional[str] = None, include_images: bool = False) -> Dict[str, Any]:
        win = self._require(window_id)
        out_path = Path(path or f"clips/{window_id}.md")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        markdown = str(win.props.get("markdown", ""))
        if include_images:
            assets = list(win.props.get("assets", []))
            blocks = []
            for asset in assets:
                src = str(asset.get("source_url", ""))
                alt = str(asset.get("alt", ""))
                status = str(asset.get("status", "skipped"))
                blocks.append(f"- [{status}] {alt or src}")
                if asset.get("ansi_block"):
                    blocks.append("\n```ansi")
                    blocks.append(str(asset.get("ansi_block")))
                    blocks.append("```")
            markdown += "\n\n## Images\n" + "\n".join(blocks) + "\n"
        out_path.write_text(markdown, encoding="utf-8")
        return {"ok": True, "path": str(out_path)}

    async def browser_copy(
        self,
        window_id: str,
        fmt: str = "plain",
        include_image_urls: bool = False,
        image_url_mode: str = "full",
    ) -> Dict[str, Any]:
        win = self._require(window_id)
        if win.type != WindowType.browser:
            return {"ok": False, "error": "not_browser_window"}

        if fmt not in ("plain", "markdown", "tui"):
            return {"ok": False, "error": "invalid_format"}
        if image_url_mode != "full":
            return {"ok": False, "error": "invalid_image_url_mode"}

        markdown = str(win.props.get("markdown", "") or "")
        tui_text = str(win.props.get("tui_text", "") or "")
        if fmt == "markdown":
            content = markdown
        elif fmt == "tui":
            content = tui_text
        else:
            content = _strip_ansi(tui_text)

        if not content.strip():
            return {"ok": False, "error": "no_browser_content"}

        resolved_urls: List[str] = []
        if include_image_urls:
            base_url = str(win.props.get("url", "") or "")
            seen = set()
            for asset in list(win.props.get("assets", [])):
                src = str(asset.get("source_url", "") or "").strip()
                if not src:
                    continue
                full = urljoin(base_url, src) if image_url_mode == "full" and base_url else src
                if full in seen:
                    continue
                seen.add(full)
                resolved_urls.append(full)
            if resolved_urls:
                content = content.rstrip() + "\n\nImage URLs:\n" + "\n".join(f"- {u}" for u in resolved_urls) + "\n"

        copied = _copy_text_to_system_clipboard(content)
        if not copied.get("ok"):
            return {"ok": False, "error": f"clipboard_write_failed: {copied.get('error', 'unknown')}"}

        return {
            "ok": True,
            "window_id": window_id,
            "chars": len(content),
            "copied": True,
            "format": fmt,
            "included_image_urls": len(resolved_urls),
        }

    async def browser_toggle_gallery(self, window_id: str) -> Dict[str, Any]:
        win = self._require(window_id)
        win.props["image_mode"] = "gallery"
        gallery_id = win.props.get("gallery_window_id")
        if gallery_id:
            return {"ok": True, "gallery_window_id": gallery_id, "reused": True}
        assets = list(win.props.get("assets", []))
        gallery_text = "\n".join(
            [f"[{a.get('status', 'skipped')}] {a.get('alt') or a.get('source_url')}" for a in assets]
        )
        gallery = await self.create_window(
            WindowType.text_view,
            f"Gallery: {win.title}",
            Rect(30, 3, 118, 30),
            {"source_window_id": window_id, "content": gallery_text},
        )
        win.props["gallery_window_id"] = gallery.id
        return {"ok": True, "gallery_window_id": gallery.id, "reused": False}

    async def export_state(self, path: str, fmt: str = "json") -> Dict[str, Any]:
        if fmt not in ("json", "ndjson"):
            return {"ok": False, "error": "invalid_format"}
        try:
            resp = send_cmd("export_state", {"path": path, "format": fmt})
            if isinstance(resp, str) and resp.lower().startswith("err"):
                raise RuntimeError(resp)
            return {"ok": True, "path": path, "format": fmt}
        except Exception:
            try:
                snapshot = self._snapshot_from_state()
                target = Path(path)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(json.dumps(snapshot, sort_keys=True), encoding="utf-8")
                return {"ok": True, "path": path, "format": fmt, "fallback": True}
            except Exception as exc:
                return {"ok": False, "error": str(exc)}

    async def import_state(self, path: str, mode: str = "replace") -> Dict[str, Any]:
        if mode not in ("replace", "merge"):
            return {"ok": False, "error": "invalid_mode"}
        try:
            resp = send_cmd("import_state", {"path": path, "mode": mode})
            if isinstance(resp, str) and resp.lower().startswith("err"):
                raise RuntimeError(resp)
            await self._sync_state()
            return {"ok": True, "path": path, "mode": mode}
        except Exception:
            try:
                payload = json.loads(Path(path).read_text(encoding="utf-8"))
                self._apply_snapshot(payload, mode=mode)
                return {"ok": True, "path": path, "mode": mode, "fallback": True}
            except Exception as exc:
                return {"ok": False, "error": str(exc)}

    # ----- Helpers -----
    def _require(self, win_id: str) -> Window:
        for w in self._state.windows:
            if w.id == win_id:
                return w
        raise KeyError(win_id)

    def _serialize_window(self, w: Window) -> Dict[str, Any]:
        return {
            "id": w.id,
            "type": w.type.value,
            "title": w.title,
            "rect": {"x": w.rect.x, "y": w.rect.y, "w": w.rect.w, "h": w.rect.h},
            "z": w.z,
            "focused": w.focused,
            "zoomed": w.zoomed,
            "props": dict(w.props),
        }

    def _append_state_event(self, event_type: str, data: Dict[str, Any], actor: str) -> None:
        """Append state events as NDJSON for local-first auditability."""
        entry = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "event": event_type,
            "actor": actor,
            "data": data,
        }
        try:
            self._state_event_log_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self._state_event_log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, separators=(",", ":")) + "\n")
        except Exception:
            # Logging must not break command flow in this MVP.
            pass

    def _snapshot_from_state(self) -> Dict[str, Any]:
        started = datetime.fromtimestamp(self._state.started_at, tz=timezone.utc)
        return {
            "version": "1",
            "timestamp": started.isoformat(),
            "canvas": {"w": self._state.canvas_width, "h": self._state.canvas_height},
            "pattern_mode": self._state.pattern_mode,
            "theme_mode": self._state.theme_mode,
            "theme_variant": self._state.theme_variant,
            "windows": [
                {
                    "id": w.id,
                    "type": w.type.value,
                    "title": w.title,
                    "rect": {"x": w.rect.x, "y": w.rect.y, "w": w.rect.w, "h": w.rect.h},
                    "z": w.z,
                    "focused": w.focused,
                    "props": dict(w.props),
                }
                for w in self._state.windows
            ],
        }

    def _apply_snapshot(self, payload: Dict[str, Any], mode: str = "replace") -> None:
        if mode == "replace":
            self._state.windows = []
            self._state.next_z = 1

        ts = payload.get("timestamp")
        if isinstance(ts, str):
            try:
                self._state.started_at = datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
            except Exception:
                pass

        self._state.pattern_mode = payload.get("pattern_mode", self._state.pattern_mode)
        self._state.theme_mode = payload.get("theme_mode", self._state.theme_mode)
        self._state.theme_variant = payload.get("theme_variant", self._state.theme_variant)
        canvas = payload.get("canvas", {})
        self._state.canvas_width = int(canvas.get("w", self._state.canvas_width))
        self._state.canvas_height = int(canvas.get("h", self._state.canvas_height))

        for item in payload.get("windows", []):
            rect = item.get("rect", {})
            wtype_raw = item.get("type", "test_pattern")
            try:
                wtype = WindowType(wtype_raw)
            except ValueError:
                wtype = WindowType.test_pattern
            win = Window(
                id=item.get("id", new_id("win")),
                type=wtype,
                title=item.get("title", ""),
                rect=Rect(
                    x=int(rect.get("x", 0)),
                    y=int(rect.get("y", 0)),
                    w=max(1, int(rect.get("w", 40))),
                    h=max(1, int(rect.get("h", 12))),
                ),
                z=int(item.get("z", self._state.next_z)),
                focused=bool(item.get("focused", False)),
                props=dict(item.get("props", {})),
            )
            self._state.windows.append(win)
            self._state.next_z = max(self._state.next_z, win.z + 1)

    # ----- Batch Layout -----
    async def batch_layout(self, req: BatchLayoutRequest) -> BatchLayoutResponse:
        """Batch create/move/close windows with macro expansion (MVP: immediate apply)"""
        # Idempotency check
        if req.request_id in self._requests:
            return self._requests[req.request_id]

        results: List[BatchOpResult] = []
        warnings: List[str] = []
        expanded_ops: List[BatchOp] = []

        # Macro expansion (grid only in MVP)
        for op in req.ops:
            if op.op == "macro.create_grid" and op.grid:
                g = op.grid
                vt = op.view_type or (req.defaults.view_type if req.defaults else None)
                if not vt:
                    results.append(BatchOpResult(
                        status="rejected", 
                        reason="missing view_type for macro.create_grid"
                    ))
                    continue
                
                # Expand grid macro into individual create operations
                idx = 0
                if g.order == "row_major":
                    for r in range(g.rows):
                        for c in range(g.cols):
                            x = g.origin.x + c * (g.cell_w + g.gap_x)
                            y = g.origin.y + r * (g.cell_h + g.gap_y)
                            expanded_ops.append(BatchOp(
                                op="create",
                                view_type=vt,
                                title=(op.title or f"{vt} #{idx+1}"),
                                bounds=BoundsModel(x=x, y=y, w=g.cell_w, h=g.cell_h),
                                options=dict(op.options or {}),
                                schedule=op.schedule,
                            ))
                            idx += 1
                else:  # col_major
                    for c in range(g.cols):
                        for r in range(g.rows):
                            x = g.origin.x + c * (g.cell_w + g.gap_x)
                            y = g.origin.y + r * (g.cell_h + g.gap_y)
                            expanded_ops.append(BatchOp(
                                op="create",
                                view_type=vt,
                                title=(op.title or f"{vt} #{idx+1}"),
                                bounds=BoundsModel(x=x, y=y, w=g.cell_w, h=g.cell_h),
                                options=dict(op.options or {}),
                                schedule=op.schedule,
                            ))
                            idx += 1
            else:
                # Pass through non-macro operations
                expanded_ops.append(op)

        # MVP: apply operations immediately (ignore schedule fields for now)
        if not req.dry_run:
            for eop in expanded_ops:
                try:
                    if eop.op == "create" and eop.view_type:
                        # Map view_type string to WindowType enum
                        try:
                            wtype = WindowType(eop.view_type)
                        except ValueError:
                            results.append(BatchOpResult(
                                status="rejected",
                                reason=f"unsupported view_type: {eop.view_type}"
                            ))
                            continue
                        
                        rect = None
                        if eop.bounds:
                            rect = Rect(eop.bounds.x, eop.bounds.y, eop.bounds.w, eop.bounds.h)
                        
                        win = await self.create_window(wtype, eop.title, rect, eop.options or {})
                        results.append(BatchOpResult(
                            status="applied",
                            window_id=win.id,
                            final_bounds=BoundsModel(x=win.rect.x, y=win.rect.y, w=win.rect.w, h=win.rect.h)
                        ))
                    
                    elif eop.op == "move_resize" and eop.window_id and eop.bounds:
                        win = await self.move_resize(
                            eop.window_id, 
                            x=eop.bounds.x, 
                            y=eop.bounds.y, 
                            w=eop.bounds.w, 
                            h=eop.bounds.h
                        )
                        results.append(BatchOpResult(
                            status="applied",
                            window_id=win.id,
                            final_bounds=BoundsModel(x=win.rect.x, y=win.rect.y, w=win.rect.w, h=win.rect.h)
                        ))
                    
                    elif eop.op == "close" and eop.window_id:
                        await self.close(eop.window_id)
                        results.append(BatchOpResult(
                            status="applied",
                            window_id=eop.window_id
                        ))
                    
                    else:
                        results.append(BatchOpResult(
                            status="rejected",
                            reason=f"unsupported or invalid operation: {eop.op}"
                        ))
                        
                except Exception as ex:
                    results.append(BatchOpResult(
                        status="rejected",
                        reason=str(ex)
                    ))
        else:
            # Dry run: simulate operations without applying
            for eop in expanded_ops:
                if eop.op == "create":
                    results.append(BatchOpResult(
                        status="scheduled",
                        reason="dry_run simulation",
                        final_bounds=eop.bounds
                    ))
                else:
                    results.append(BatchOpResult(
                        status="scheduled", 
                        reason="dry_run simulation"
                    ))

        resp = BatchLayoutResponse(
            dry_run=req.dry_run,
            applied=(not req.dry_run),
            group_id=req.group_id,
            op_results=results,
            warnings=warnings,
            timeline_summary=TimelineSummary(counts={"ops": len(results)})
        )
        
        # Cache response for idempotency
        self._requests[req.request_id] = resp
        return resp

    async def cancel_timeline(self, group_id: str) -> Dict[str, Any]:
        """Cancel scheduled timeline operations (MVP stub)"""
        return {
            "ok": True,
            "group_id": group_id,
            "canceled": 0
        }

    async def get_timeline_status(self, group_id: str) -> Dict[str, Any]:
        """Get timeline operation status (MVP stub)"""
        return {
            "group_id": group_id,
            "scheduled": 0,
            "pending": 0,
            "applied": 0
        }

    # ----- Monodraw Integration -----
    async def load_monodraw_file(
        self,
        file_path: str,
        scale: float = 1.0,
        offset_x: int = 0,
        offset_y: int = 0,
        window_types: Optional[Dict[str, str]] = None,
        target: str = "windows",
        layers_filter: Optional[List[str]] = None,
        mode: str = "replace",
        flatten: bool = True,
        insert_position: str = "end",
        insert_header: bool = True
    ) -> Dict[str, Any]:
        """Load Monodraw JSON file and spawn windows OR import to text editor."""
        try:
            # Parse Monodraw file
            layers = MonodrawParser.parse_file(file_path)
            
            if not layers:
                return {
                    "ok": False,
                    "error": "No named layers found in Monodraw file",
                    "windows_created": [],
                    "total_layers": 0
                }

            # Filter layers if specified
            if layers_filter:
                layers = self._filter_layers(layers, layers_filter)
                if not layers:
                    return {
                        "ok": False,
                        "error": f"No layers matched filter: {layers_filter}",
                        "windows_created": [],
                        "total_layers": 0
                    }

            # ROUTE: Text Editor Import
            if target == "text_editor":
                print(f"[DEBUG] Text editor import: {len(layers)} layers, target={target}, flatten={flatten}")

                if flatten:
                    # Compose layers onto 2D canvas (spatial layout preserved)
                    document_text = MonodrawParser.compose_to_canvas(layers)
                    if insert_header:
                        header = f"# Imported from {os.path.basename(file_path)}\n# {len(layers)} layers composited\n\n"
                        document_text = header + document_text
                else:
                    # Sequential flattening (legacy, for simple text-only exports)
                    document_text = self._flatten_layers(layers, insert_header, file_path)

                print(f"[DEBUG] Composed text: {len(document_text)} chars, {document_text.count(chr(10))} newlines")
                print(f"[DEBUG] First 100 chars: {document_text[:100]!r}")

                # Calculate metadata
                lines = document_text.count('\n') + 1
                width = max(len(line) for line in document_text.split('\n')) if document_text else 0

                print(f"[DEBUG] About to call send_text with win_id='auto', mode={mode}")

                # TODO: Send to text editor via IPC
                # For now, use send_text to "auto" which finds/creates text editor
                result = await self.send_text("auto", document_text, mode, insert_position)

                print(f"[DEBUG] send_text result: {result}")

                return {
                    "ok": True,
                    "target": "text_editor",
                    "window_id": result.get("window_id", "unknown"),
                    "layers_imported": [layer.name for layer in layers],
                    "lines": lines,
                    "width": width,
                    "flatten": flatten
                }

            # ROUTE: Window Spawning (original behaviour)
            # Get terminal size for scaling
            await self._sync_state()
            terminal_size = (self._state.canvas_width, self._state.canvas_height)

            # Scale coordinates to fit terminal
            if scale != 1.0 or terminal_size != (80, 24):
                layers = scale_coordinates(layers, scale, terminal_size)

            # Apply offset
            if offset_x != 0 or offset_y != 0:
                for layer in layers:
                    layer.origin = (
                        layer.origin[0] + offset_x,
                        layer.origin[1] + offset_y
                    )

            # Create windows for each layer
            windows_created = []
            errors = []
            
            for layer in layers:
                try:
                    # Determine window type
                    window_type = self._infer_window_type(layer, window_types or {})
                    
                    # Create window rect
                    rect = Rect(
                        x=layer.origin[0],
                        y=layer.origin[1], 
                        w=layer.frame_size[0],
                        h=layer.frame_size[1]
                    )
                    
                    # Set window properties based on content
                    props = {"monodraw_layer": layer.name}
                    if window_type == WindowType.text_view:
                        # Create temporary file with layer content
                        temp_file = tempfile.NamedTemporaryFile(
                            mode='w', 
                            suffix=f'_{layer.name}.txt',
                            delete=False,
                            encoding='utf-8'
                        )
                        temp_file.write(layer.text_content)
                        temp_file.close()
                        props["path"] = temp_file.name
                    
                    # Create the window
                    window = await self.create_window(
                        wtype=window_type,
                        title=layer.name,
                        rect=rect,
                        props=props
                    )
                    
                    windows_created.append({
                        "id": window.id,
                        "type": window.type.value,
                        "title": window.title,
                        "rect": {
                            "x": window.rect.x,
                            "y": window.rect.y, 
                            "w": window.rect.w,
                            "h": window.rect.h
                        },
                        "monodraw_layer": layer.name
                    })
                    
                except Exception as e:
                    errors.append(f"Failed to create window for layer '{layer.name}': {str(e)}")
            
            return {
                "ok": True,
                "windows_created": windows_created,
                "errors": errors,
                "total_layers": len(layers),
                "windows_spawned": len(windows_created)
            }
            
        except Exception as e:
            return {
                "ok": False,
                "error": f"Failed to load Monodraw file: {str(e)}",
                "windows_created": [],
                "total_layers": 0
            }
    
    def _infer_window_type(self, layer: MonodrawLayer, explicit_types: Dict[str, str]) -> WindowType:
        """Infer appropriate window type from layer content."""
        # Check for explicit type mapping first
        if layer.name in explicit_types:
            try:
                return WindowType(explicit_types[layer.name])
            except ValueError:
                pass  # Fall back to inference

        # For now, treat all content as text_view
        # TODO: Add pattern detection for other window types
        return WindowType.text_view

    def _filter_layers(self, layers: List[MonodrawLayer], layer_names: Optional[List[str]]) -> List[MonodrawLayer]:
        """Filter layers by name if specified."""
        if not layer_names:
            return layers
        return [layer for layer in layers if layer.name in layer_names]

    def _flatten_layers(self, layers: List[MonodrawLayer], insert_header: bool = True, filename: str = "") -> str:
        """Flatten multiple layers into single document with separators."""
        if not layers:
            return ""

        parts = []

        # Optional header comment
        if insert_header and filename:
            import os
            from datetime import datetime
            parts.append(f"# Imported from {os.path.basename(filename)}")
            parts.append(f"# Layers: {', '.join(layer.name for layer in layers)}")
            parts.append(f"# Timestamp: {datetime.now().isoformat()}")
            parts.append("")

        # Add each layer with separator
        for i, layer in enumerate(layers):
            if i > 0:
                parts.append("")
                parts.append(f"# ────── Layer: {layer.name} ──────")
                parts.append("")
            parts.append(layer.text_content)

        return "\n".join(parts)
    
    async def parse_monodraw_file(self, file_path: str) -> Dict[str, Any]:
        """Parse Monodraw file without creating windows (preview mode)."""
        try:
            layers = MonodrawParser.parse_file(file_path)
            canvas_w, canvas_h = MonodrawParser.get_canvas_bounds(layers)
            
            layer_previews = []
            for layer in layers:
                preview_text = layer.text_content[:100] + "..." if len(layer.text_content) > 100 else layer.text_content
                layer_previews.append({
                    "name": layer.name,
                    "position": {"x": layer.origin[0], "y": layer.origin[1]},
                    "size": {"w": layer.frame_size[0], "h": layer.frame_size[1]},
                    "content_preview": preview_text.replace('\n', ' '),
                    "suggested_type": "text_view",
                    "confidence": 1.0
                })
            
            return {
                "ok": True,
                "layers": layer_previews,
                "canvas_bounds": {"w": canvas_w, "h": canvas_h},
                "total_layers": len(layers)
            }
            
        except Exception as e:
            return {
                "ok": False,
                "error": f"Failed to parse Monodraw file: {str(e)}",
                "layers": [],
                "canvas_bounds": {"w": 0, "h": 0},
                "total_layers": 0
            }
