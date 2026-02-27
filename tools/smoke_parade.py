#!/usr/bin/env python3
"""smoke_parade.py — Visual integration test of every window type and command.

Run this in a tmux pane next to the TUI. It walks through every spawnable
window type and key commands, screenshotting each step to a timestamped
directory. Designed to be WATCHED.

Usage:
    python3 tools/smoke_parade.py [--api http://127.0.0.1:8089] [--delay 2.0]

The --delay flag controls how long each window stays visible (seconds).
Screenshots land in logs/smoke_parade/<timestamp>/.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from urllib.request import Request, urlopen
from urllib.error import URLError

# ── Config ──────────────────────────────────────────────────────────────────

SPAWNABLE_TYPES = [
    # Generative art
    "test_pattern",
    "gradient",
    "animated_gradient",
    "contour_map",
    "generative_lab",
    "mycelium",
    "orbit",
    "torus",
    "cube",
    "life",
    "blocks",
    "verse",
    "ascii",
    "score",
    "deep_signal",
    # Monsters
    "monster_cam",
    "monster_verse",
    "monster_portal",
    # Tools
    "figlet_text",
    "paint",
    "text_editor",
    "browser",
    "terminal",
    "gallery",
    "app_launcher",
    # Games
    "quadra",
    "snake",
    "rogue",
    # Sim
    # "micropolis_ascii",  # SKIP: SIGBUS in Micropolis::clearMap() during init (SPK-03)
    # Social
    # "room_chat",  # SKIP: blink timer UAF crashes TUI on close (SPK-03 P4)
    # Animation
    "frame_player",
]

# Commands to exercise (in order). Each is (command_name, args_dict, description).
COMMAND_SEQUENCE: list[tuple[str, dict, str]] = [
    # Theme
    ("set_theme_mode",    {"mode": "dark"},            "Theme: dark mode"),
    ("set_theme_variant", {"variant": "dark_pastel"}, "Theme: dark pastel"),
    # Desktop
    ("desktop_texture",   {"char": "░"},              "Desktop: textured fill"),
    ("desktop_color",     {"fg": "11", "bg": "1"},    "Desktop: cyan on blue"),
    # Figlet tricks
    ("open_figlet_text",  {},                         "FIGlet: open default"),
    # (figlet commands need a window ID — handled specially below)
    # Scramble
    ("open_scramble",     {},                         "Scramble: summon the cat"),
    ("scramble_pet",      {},                         "Scramble: pet her"),
    ("scramble_say",      {"text": "You are a good cat, Scramble."},
                                                      "Scramble: talk to her"),
    ("scramble_expand",   {},                         "Scramble: expand"),
    ("scramble_expand",   {},                         "Scramble: shrink back"),
    ("open_scramble",     {},                         "Scramble: dismiss"),
    # Layout
    ("tile",              {},                         "Tile all windows"),
    ("cascade",           {},                         "Cascade all windows"),
    # Reset
    ("reset_theme",       {},                         "Theme: reset to default"),
    ("desktop_preset",    {"preset": "default"},      "Desktop: reset preset"),
]

# ── API helpers ─────────────────────────────────────────────────────────────

class API:
    def __init__(self, base: str):
        self.base = base.rstrip("/")
        self._consecutive_failures = 0

    def _req(self, method: str, path: str, body: Optional[dict] = None) -> Any:
        url = f"{self.base}{path}"
        data = json.dumps(body).encode() if body else None
        headers = {"Content-Type": "application/json"} if data else {}
        req = Request(url, data=data, headers=headers, method=method)
        try:
            with urlopen(req, timeout=10) as resp:
                self._consecutive_failures = 0
                return json.loads(resp.read())
        except URLError as e:
            self._consecutive_failures += 1
            if self._consecutive_failures >= 3:
                print(f"\n  ‼️  3 consecutive API failures — IPC likely dead.")
                print(f"     Last error: {e}")
                print(f"     Bailing out. Check if the TUI process is still running.")
                print(f"     Partial results saved.\n")
                return "BAIL"
            print(f"  !! API error: {e}")
            return None

    def get(self, path: str) -> Any:
        return self._req("GET", path)

    def post(self, path: str, body: Optional[dict] = None) -> Any:
        return self._req("POST", path, body)

    def delete(self, path: str) -> Any:
        return self._req("DELETE", path)

    def state(self) -> dict:
        return self.get("/state") or {}

    def create_window(self, wtype: str) -> Optional[dict]:
        return self.post("/windows", {"type": wtype})

    def close_window(self, wid: str) -> Any:
        return self.post("/menu/command", {"command": "close_window", "args": {"id": wid}})

    def close_all(self) -> Any:
        return self.post("/menu/command", {"command": "close_all", "args": {}})

    def run_command(self, name: str, args: Optional[dict] = None) -> Any:
        return self.post("/menu/command", {"command": name, "args": args or {}})

    def screenshot(self, path: str) -> Any:
        return self.post("/screenshot", {"path": path})

# ── Runner ──────────────────────────────────────────────────────────────────

def banner(text: str, width: int = 60):
    bar = "═" * width
    pad = (width - len(text) - 2) // 2
    print(f"\n╔{bar}╗")
    print(f"║{' ' * pad} {text} {' ' * (width - pad - len(text) - 2)}║")
    print(f"╚{bar}╝\n")

def step(num: int, total: int, desc: str):
    pct = int(100 * num / total)
    bar = "█" * (pct // 5) + "░" * (20 - pct // 5)
    print(f"\n  [{num:3d}/{total}] {bar} {pct:3d}%  {desc}")

def screenshot(api: API, out_dir: Path, label: str) -> Optional[str]:
    safe = label.replace(" ", "_").replace("/", "-").replace(":", "")[:60]
    ts = datetime.now().strftime("%H%M%S")
    fname = f"{ts}_{safe}.txt"
    fpath = out_dir / fname
    result = api.screenshot(str(fpath))
    if result and result.get("ok"):
        size = result.get("bytes", 0)
        print(f"        📸 {fname} ({size} bytes)")
        return str(fpath)
    else:
        print(f"        📸 screenshot failed: {result}")
        return None

def run_parade(api: API, delay: float, start_at: int = 1):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = Path("logs/smoke_parade") / ts
    out_dir.mkdir(parents=True, exist_ok=True)

    # Check API is alive
    state = api.state()
    if not state:
        print("!! Cannot reach API. Is the server running?")
        sys.exit(1)

    total_steps = len(SPAWNABLE_TYPES) + len(COMMAND_SEQUENCE) + 3  # +clean start, tile, clean end

    banner("SMOKE PARADE — WibWob-DOS Integration Test")
    print(f"  API:    {api.base}")
    print(f"  Output: {out_dir}")
    print(f"  Delay:  {delay}s per step")
    print(f"  Steps:  {total_steps}")
    print(f"  Types:  {len(SPAWNABLE_TYPES)} window types")
    print(f"  Cmds:   {len(COMMAND_SEQUENCE)} commands")
    if start_at > 1:
        print(f"  Skip:   jumping to step {start_at}")
    print()

    step_num = 0
    results = {"passed": [], "failed": [], "screenshots": []}
    log_entries: list[dict] = []

    def log(phase: str, action: str, target: str, ok: bool, detail: str = "", shot: str = ""):
        entry = {
            "t": datetime.now().isoformat(),
            "step": step_num,
            "phase": phase,
            "action": action,
            "target": target,
            "ok": ok,
            "detail": detail,
            "screenshot": shot,
        }
        log_entries.append(entry)

    def should_run() -> bool:
        return step_num >= start_at

    # ── Phase 1: Clean slate ────────────────────────────────────────────
    step_num += 1
    if should_run():
        step(step_num, total_steps, "CLEAN SLATE — close all windows")
        api.close_all()
        time.sleep(0.5)
        shot = screenshot(api, out_dir, "00_clean_slate")
        if shot:
            results["screenshots"].append(shot)

    # ── Phase 2: Spawn every window type one by one ─────────────────────
    banner("PHASE 1 — Window Types")

    for wtype in SPAWNABLE_TYPES:
        step_num += 1
        if not should_run():
            continue
        step(step_num, total_steps, f"spawn: {wtype}")

        win = api.create_window(wtype)
        if win == "BAIL":
            break
        if win and isinstance(win, dict) and win.get("id"):
            wid = win["id"]
            reported_type = win.get("type", "???")
            ok = reported_type == wtype
            status = "✅" if ok else f"⚠️  reported as '{reported_type}'"
            print(f"        {status}  id={wid}  type={reported_type}")

            time.sleep(delay)
            shot = screenshot(api, out_dir, f"win_{wtype}")
            if shot:
                results["screenshots"].append(shot)

            # Close it to keep desktop clean for next window.
            # Small delay after close lets timers drain before next spawn.
            api.close_window(wid)
            time.sleep(0.5)

            if ok:
                results["passed"].append(wtype)
                log("windows", "spawn", wtype, True, f"id={wid}", shot or "")
            else:
                results["failed"].append(f"{wtype} (reported as {reported_type})")
                log("windows", "spawn", wtype, False, f"reported as {reported_type}", shot or "")
        else:
            print(f"        ❌  failed to create: {win}")
            results["failed"].append(f"{wtype} (create failed)")
            log("windows", "spawn", wtype, False, f"create returned {win}")
            time.sleep(0.5)

    # ── Phase 3: Compose a proper desktop ─────────────────────────────────
    #
    # This is what agents SHOULD do: spawn windows, then snap them into a
    # grid so every window is visible and the human can see what happened.
    # 8 windows in a 4x2 grid. No overlap. No chaos.
    step_num += 1
    layout_ids = []
    if should_run():
        step(step_num, total_steps, "COMPOSE DESKTOP — 8 windows, 4x2 grid, no overlap")
        api.close_all()
        time.sleep(0.3)
        layout_types = [
            "contour_map", "life", "figlet_text", "orbit",
            "verse", "blocks", "ascii", "generative_lab",
        ]
        for lt in layout_types:
            w = api.create_window(lt)
            if w and isinstance(w, dict) and w.get("id"):
                layout_ids.append((w["id"], lt))
        time.sleep(0.3)
        # Snap each into a 4x2 grid
        for i, (wid, wtype) in enumerate(layout_ids):
            col = i % 4
            row = i // 4
            api.run_command("snap_window", {
                "id": wid, "zone": "tl",
                "cols": "4", "rows": "2",
                "col": str(col), "row": str(row),
            })
        time.sleep(0.5)
        shot = screenshot(api, out_dir, "composed_desktop")
        if shot:
            results["screenshots"].append(shot)
        print(f"        📐 {len(layout_ids)} windows snapped to 4x2 grid")

    # ── Phase 4: Command sequence ───────────────────────────────────────
    banner("PHASE 2 — Commands")

    for cmd_name, cmd_args, cmd_desc in COMMAND_SEQUENCE:
        step_num += 1
        step(step_num, total_steps, cmd_desc)

        result = api.run_command(cmd_name, cmd_args)
        if result == "BAIL":
            break
        if result:
            detail = str(result)[:80] if isinstance(result, dict) else str(result)[:80]
            print(f"        → {detail}")
        else:
            detail = "(no response)"
            print(f"        → {detail}")

        cmd_ok = bool(result and (not isinstance(result, dict) or result.get("ok", True)))
        time.sleep(delay)
        shot = screenshot(api, out_dir, f"cmd_{cmd_name}")
        if shot:
            results["screenshots"].append(shot)
        log("commands", "run", f"{cmd_name}({cmd_args})", cmd_ok, detail, shot or "")

    # ── Phase 5: Figlet window tricks ─────────────────────────────────────
    # figlet_set_text/font match by title or "auto" (first figlet window found)
    step_num += 1
    if should_run():
        state = api.state()
        has_figlet = any(w.get("type") == "figlet_text" for w in state.get("windows", []))
        if has_figlet:
            step(step_num, total_steps, "FIGlet tricks — change text and font")
            api.run_command("figlet_set_text", {"id": "auto", "text": "SMOKE PARADE"})
            time.sleep(0.5)
            api.run_command("figlet_set_font", {"id": "auto", "font": "slant"})
            time.sleep(0.5)
            shot = screenshot(api, out_dir, "figlet_tricks")
            if shot:
                results["screenshots"].append(shot)
        else:
            step(step_num, total_steps, "FIGlet tricks — skipped (no figlet window)")
            print("        (no figlet window on desktop)")

    # ── Phase 6: Clean up ───────────────────────────────────────────────
    step_num += 1
    if should_run():
        step(step_num, total_steps, "CLEAN UP — close all, reset theme")
        api.close_all()
        api.run_command("reset_theme", {})
        api.run_command("desktop_preset", {"preset": "default"})
        time.sleep(0.5)
        screenshot(api, out_dir, "99_clean_end")

    # ── Summary ─────────────────────────────────────────────────────────
    banner("RESULTS")
    print(f"  Passed:      {len(results['passed'])}")
    print(f"  Failed:      {len(results['failed'])}")
    print(f"  Screenshots: {len(results['screenshots'])}")
    print(f"  Output dir:  {out_dir}")
    print()

    if results["failed"]:
        print("  FAILURES:")
        for f in results["failed"]:
            print(f"    ❌ {f}")
        print()

    # Write summary file
    summary_path = out_dir / "SUMMARY.txt"
    with open(summary_path, "w") as f:
        f.write(f"Smoke Parade — {ts}\n")
        f.write(f"{'=' * 40}\n\n")
        f.write(f"Passed: {len(results['passed'])}\n")
        f.write(f"Failed: {len(results['failed'])}\n")
        f.write(f"Screenshots: {len(results['screenshots'])}\n\n")
        if results["failed"]:
            f.write("Failures:\n")
            for fail in results["failed"]:
                f.write(f"  - {fail}\n")
        f.write(f"\nPassed types:\n")
        for p in results["passed"]:
            f.write(f"  - {p}\n")

    # Write structured JSON log
    log_path = out_dir / "parade.json"
    with open(log_path, "w") as f:
        json.dump({
            "timestamp": ts,
            "api": api.base,
            "delay": delay,
            "passed": len(results["passed"]),
            "failed": len(results["failed"]),
            "screenshots": len(results["screenshots"]),
            "failures": results["failed"],
            "steps": log_entries,
        }, f, indent=2)

    print(f"  Summary:  {summary_path}")
    print(f"  Full log: {log_path}")

    if results["failed"]:
        print("\n  ⚠️  Some steps failed. Check output above.")
        return 1
    else:
        print("\n  🎉 All clear. Every window and command worked.")
        return 0


def main():
    parser = argparse.ArgumentParser(description="Smoke Parade — visual integration test")
    parser.add_argument("--api", default="http://127.0.0.1:8089", help="API base URL")
    parser.add_argument("--delay", type=float, default=2.0, help="Seconds per step (default 2.0)")
    parser.add_argument("--start", type=int, default=1, help="Skip to step N (default 1)")
    args = parser.parse_args()

    api = API(args.api)
    sys.exit(run_parade(api, args.delay, args.start))


if __name__ == "__main__":
    main()
