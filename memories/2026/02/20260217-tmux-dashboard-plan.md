> Maybe claude saved this already, unsure as ran out of context!

 Multi-Instance IPC Sockets + tmux Monitoring Sidebar

   tl;dr: Env var WIBWOB_INSTANCE drives per-instance socket naming (/tmp/wibwob_${ID}.sock). 4 touch points in C++ (hardcoded path read from env), 1 in Python (already done), 1 new monitoring script, 1 tmux
   launch script. 7 changes total, each independently testable.

   ---
   Design Decisions

   1. Env var over CLI args. The C++ main() has no argc/argv (line 1986 of test_pattern_app.cpp is int main()). Adding argc/argv would require changing the function signature and adding a parser. The env var
   approach is simpler, compatible with ttyd wrapping, and the Python side already uses TV_IPC_SOCK env var. Use WIBWOB_INSTANCE as the human-friendly identifier (e.g. 1, 2, 3, 4) and derive the socket path
   from it.

   2. Socket naming convention: /tmp/wibwob_${WIBWOB_INSTANCE}.sock. If WIBWOB_INSTANCE is unset, fall back to the legacy path /tmp/test_pattern_app.sock for backward compatibility. This means existing
   single-instance usage is zero-change.

   3. tui_tools.cpp socket discovery: The embedded LLM tools (TUIToolExecutor::sendIpcCommand) hardcode the socket path at line 82. This runs inside the same process as the TUI app, so it should use the same
   env var that the app used to derive its socket path. Read WIBWOB_INSTANCE from env at runtime, construct the path, done.

   4. Python monitoring script: Extend the existing ipc_client.py pattern. New standalone script tools/monitor/instance_monitor.py that discovers all /tmp/wibwob_*.sock sockets, polls get_state on each, and
   renders a compact dashboard. Uses curses or plain ANSI for the sidebar.

   5. Launch script: Bash + tmux. Creates a session with N panes + 1 sidebar pane. Each pane sets WIBWOB_INSTANCE=N and runs the TUI binary. Sidebar pane runs the monitor script.

   ---
   Phase 1: C++ Socket Path from Env Var

   What changes:

   File: /Users/james/Repos/wibandwob-dos-xterm/app/test_pattern_app.cpp (line ~694-697)

   Current:
   TTestPatternApp::TTestPatternApp() :
       TProgInit(&TTestPatternApp::initStatusLine,
                 &TTestPatternApp::initMenuBar,
                 &TTestPatternApp::initDeskTop),
       windowNumber(0)
   {
       ipcServer = new ApiIpcServer(this);
       ipcServer->start("/tmp/test_pattern_app.sock");

   Change to:
   {
       ipcServer = new ApiIpcServer(this);

       // Derive socket path from WIBWOB_INSTANCE env var.
       // Unset or empty: legacy path for backward compat.
       std::string sockPath = "/tmp/test_pattern_app.sock";
       const char* inst = std::getenv("WIBWOB_INSTANCE");
       if (inst && inst[0] != '\0') {
           sockPath = std::string("/tmp/wibwob_") + inst + ".sock";
       }
       ipcServer->start(sockPath);

   This is C++14 compatible (uses std::getenv which is standard C). No new headers needed -- cstdlib is already transitively included.

   File: /Users/james/Repos/wibandwob-dos-xterm/app/api_ipc.h (line 16)

   No change needed. The default parameter "/tmp/test_pattern_app.sock" is only used when start() is called with no args, which won't happen after the change above. Leaving it as-is preserves the header
   contract.

   Verification:

   # Build
   cmake --build ./build

   # Test 1: Legacy path (no env var)
   ./build/app/test_pattern &
   ls -l /tmp/test_pattern_app.sock  # should exist
   kill %1

   # Test 2: Instance path
   WIBWOB_INSTANCE=1 ./build/app/test_pattern &
   ls -l /tmp/wibwob_1.sock  # should exist
   kill %1

   # Test 3: IPC works on instance socket
   WIBWOB_INSTANCE=2 ./build/app/test_pattern &
   echo 'cmd:get_state' | nc -U /tmp/wibwob_2.sock  # should return JSON
   kill %1


   ---
   Phase 2: tui_tools.cpp Uses Env Var

   File: /Users/james/Repos/wibandwob-dos-xterm/app/llm/tools/tui_tools.cpp (lines 75-82)

   Current sendIpcCommand method:
   std::string sendIpcCommand(const std::string& command) {
       int sock = socket(AF_UNIX, SOCK_STREAM, 0);
       if (sock < 0) return "";

       struct sockaddr_un addr;
       memset(&addr, 0, sizeof(addr));
       addr.sun_family = AF_UNIX;
       strcpy(addr.sun_path, "/tmp/test_pattern_app.sock");

   Change to:
   std::string sendIpcCommand(const std::string& command) {
       int sock = socket(AF_UNIX, SOCK_STREAM, 0);
       if (sock < 0) return "";

       // Derive socket path from same env var as main app
       std::string sockPath = "/tmp/test_pattern_app.sock";
       const char* inst = std::getenv("WIBWOB_INSTANCE");
       if (inst && inst[0] != '\0') {
           sockPath = std::string("/tmp/wibwob_") + inst + ".sock";
       }

       struct sockaddr_un addr;
       memset(&addr, 0, sizeof(addr));
       addr.sun_family = AF_UNIX;
       strncpy(addr.sun_path, sockPath.c_str(), sizeof(addr.sun_path) - 1);

   Note: also replacing strcpy with strncpy to avoid potential buffer overflow.

   Add #include <cstdlib> at the top of the file if not already present (it's likely pulled in transitively, but better to be explicit).

   Verification:

   # Build
   cmake --build ./build

   # Start instance 3
   WIBWOB_INSTANCE=3 ./build/app/test_pattern &

   # The embedded chat's tui_tools will use WIBWOB_INSTANCE=3 env
   # (since it inherits the process env). Verify by opening chat (F12)
   # and asking it to list windows -- it should connect to /tmp/wibwob_3.sock


   ---
   Phase 3: Python ipc_client.py Alignment

   File: /Users/james/Repos/wibandwob-dos-xterm/tools/api_server/ipc_client.py (line 9)

   Current:
   SOCK_PATH = os.environ.get("TV_IPC_SOCK", "/tmp/test_pattern_app.sock")

   This already supports env var override. Two options:

   Option A (minimal): Document that users should set TV_IPC_SOCK=/tmp/wibwob_N.sock to match instance. No code change.

   Option B (preferred): Add WIBWOB_INSTANCE awareness so the two env vars are consistent:

   def _resolve_sock_path() -> str:
       """Resolve IPC socket path.
        
       Priority: TV_IPC_SOCK (explicit) > WIBWOB_INSTANCE (derived) > legacy default.
       """
       explicit = os.environ.get("TV_IPC_SOCK")
       if explicit:
           return explicit
       instance = os.environ.get("WIBWOB_INSTANCE")
       if instance:
           return f"/tmp/wibwob_{instance}.sock"
       return "/tmp/test_pattern_app.sock"

   SOCK_PATH = _resolve_sock_path()

   This is backward compatible: existing users who set neither env var get the legacy path.

   Verification:

   # Instance 1 running
   WIBWOB_INSTANCE=1 ./build/app/test_pattern &

   # API server targeting instance 1
   WIBWOB_INSTANCE=1 python -m tools.api_server.main --port=8089 &
   curl http://127.0.0.1:8089/state  # should return windows from instance 1

   # Also verify TV_IPC_SOCK still works
   TV_IPC_SOCK=/tmp/wibwob_1.sock python -c "
   from tools.api_server.ipc_client import send_cmd
   print(send_cmd('get_state'))
   "


   ---
   Phase 4: Update Hardcoded Paths in Test Scripts

   Files to update (4 files):

   ┌───────────────────────────────────────┬──────┬─────────────────────────────────────────────────────────────────────────┐
   │                 File                  │ Line │                                 Change                                  │
   ├───────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
   │ tools/api_server/test_ipc.py          │ 7    │ Use os.environ.get("WIBWOB_INSTANCE") to derive path, default to legacy │
   ├───────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
   │ tools/api_server/test_move.py         │ 7    │ Same pattern                                                            │
   ├───────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
   │ tools/api_server/test_browser_ipc.py  │ 16   │ Same pattern                                                            │
   ├───────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
   │ tools/api_server/move_test_pattern.py │ 7    │ Same pattern                                                            │
   └───────────────────────────────────────┴──────┴─────────────────────────────────────────────────────────────────────────┘

   Pattern for each:
   import os

   def _sock_path():
       inst = os.environ.get("WIBWOB_INSTANCE")
       if inst:
           return f"/tmp/wibwob_{inst}.sock"
       return "/tmp/test_pattern_app.sock"

   sock_path = _sock_path()

   Verification:

   # With instance
   WIBWOB_INSTANCE=1 uv run tools/api_server/test_ipc.py
   # Without instance (legacy)
   uv run tools/api_server/test_ipc.py


   ---
   Phase 5: Instance Monitor Script

   New file: tools/monitor/instance_monitor.py

   This is the tmux sidebar brain. Discovers all active WibWob sockets, polls each every 2s, and renders a compact text dashboard.

   Design:

    WibWob Instance Monitor
    ========================

    [1] /tmp/wibwob_1.sock
        Status: LIVE  | Windows: 3
        Provider: anthropic_api
        API Key: sk-a...****
        Uptime: 12m 34s

    [2] /tmp/wibwob_2.sock
        Status: LIVE  | Windows: 1
        Provider: claude_code_sdk
        API Key: (env)
        Uptime: 5m 12s

    [3] /tmp/wibwob_3.sock
        Status: DEAD  (connection refused)

    [4] /tmp/wibwob_4.sock
        Status: LIVE  | Windows: 0
        Provider: none
        API Key: (not set)
        Uptime: 0m 45s

    Last refresh: 12:34:56 | Polling: 2s


   Implementation approach:

   #!/usr/bin/env python3
   """WibWob-DOS Instance Monitor — tmux sidebar companion."""

   import glob
   import json
   import os
   import socket
   import sys
   import time


   def discover_sockets():
       """Find all /tmp/wibwob_*.sock files."""
       socks = sorted(glob.glob("/tmp/wibwob_*.sock"))
       # Also check legacy path
       legacy = "/tmp/test_pattern_app.sock"
       if os.path.exists(legacy) and legacy not in socks:
           socks.insert(0, legacy)
       return socks


   def probe_instance(sock_path: str, timeout: float = 2.0):
       """Send get_state to one socket, return parsed dict or error string."""
       try:
           s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
           s.settimeout(timeout)
           s.connect(sock_path)
           s.sendall(b"cmd:get_state\n")
           data = s.recv(8192)
           s.close()
           return json.loads(data.decode("utf-8", errors="ignore").strip())
       except (ConnectionRefusedError, FileNotFoundError):
           return "DEAD"
       except socket.timeout:
           return "TIMEOUT"
       except Exception as e:
           return f"ERROR: {e}"


   def render_dashboard(states: dict, term_width: int = 40):
       """Render ANSI dashboard to stdout."""
       # Clear screen
       print("\033[2J\033[H", end="")
       print("WibWob Instance Monitor")
       print("=" * min(term_width, 40))
       print()

       for sock_path, state in states.items():
           # Extract instance ID from path
           name = os.path.basename(sock_path).replace(".sock", "")

           if isinstance(state, str):
               # Error state
               print(f" [{name}] {sock_path}")
               print(f"     Status: {state}")
               print()
               continue

           win_count = len(state.get("windows", []))
           print(f" [{name}] {sock_path}")
           print(f"     Status: LIVE  | Windows: {win_count}")

           # Window titles
           for w in state.get("windows", [])[:3]:
               title = w.get("title", "?")[:25]
               print(f"       - {title}")
           if win_count > 3:
               print(f"       ... +{win_count - 3} more")
           print()

       print(f" Last refresh: {time.strftime('%H:%M:%S')} | Polling: 2s")


   def main():
       interval = float(sys.argv[1]) if len(sys.argv) > 1 else 2.0
       while True:
           socks = discover_sockets()
           if not socks:
               print("\033[2J\033[H", end="")
               print("No WibWob sockets found in /tmp/")
               print("Waiting...")
           else:
               states = {}
               for sp in socks:
                   states[sp] = probe_instance(sp)
               render_dashboard(states)
           time.sleep(interval)

   Key points:
   - Zero dependencies beyond stdlib (socket, glob, json, time)
   - Discovers sockets by glob pattern, not by config
   - 2s poll interval by default, configurable via argv
   - ANSI clear + redraw for live refresh
   - Gracefully handles dead/timeout sockets

   Verification:

   # Start two instances
   WIBWOB_INSTANCE=1 ./build/app/test_pattern &
   WIBWOB_INSTANCE=2 ./build/app/test_pattern &

   # Run monitor
   python tools/monitor/instance_monitor.py

   # Should show both instances with LIVE status and window counts
   # Kill one instance -- monitor should show DEAD on next refresh


   ---
   Phase 6: tmux Launch Script

   New file: tools/scripts/launch_tmux.sh

   #!/bin/bash
   # Launch N WibWob-DOS instances in tmux with monitoring sidebar.
   # Usage: ./tools/scripts/launch_tmux.sh [N]   (default: 4)

   set -e

   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
   N=${1:-4}
   SESSION="wibwob"
   BINARY="$REPO_ROOT/build/app/test_pattern"

   if [ ! -f "$BINARY" ]; then
       echo "Binary not found: $BINARY"
       echo "Run: cmake --build ./build"
       exit 1
   fi

   # Kill existing session if any
   tmux kill-session -t "$SESSION" 2>/dev/null || true

   # Create session with first instance pane
   tmux new-session -d -s "$SESSION" -x 200 -y 50 \
       "cd $REPO_ROOT && WIBWOB_INSTANCE=1 $BINARY 2>/tmp/wibwob_1.log"

   # Add remaining instance panes
   for i in $(seq 2 $N); do
       tmux split-window -t "$SESSION" -h \
           "cd $REPO_ROOT && WIBWOB_INSTANCE=$i $BINARY 2>/tmp/wibwob_$i.log"
   done

   # Even out the layout
   tmux select-layout -t "$SESSION" tiled

   # Add monitor sidebar (narrow right pane)
   tmux split-window -t "$SESSION" -h -l 42 \
       "cd $REPO_ROOT && python3 tools/monitor/instance_monitor.py 2"

   # Attach
   tmux attach-session -t "$SESSION"


   Verification:

   chmod +x tools/scripts/launch_tmux.sh
   ./tools/scripts/launch_tmux.sh 4

   # Should see 4 TUI instances + 1 monitor sidebar
   # Monitor should show all 4 as LIVE
   # Ctrl+b then q to show pane numbers
   # Each instance has its own socket: /tmp/wibwob_{1,2,3,4}.sock


   ---
   Phase 7: Documentation Updates

   Files to update:

   1. /Users/james/Repos/wibandwob-dos-xterm/CLAUDE.md -- Update architecture diagram to show per-instance socket naming. Add WIBWOB_INSTANCE to key env vars table. Mention tools/scripts/launch_tmux.sh.
   2. /Users/james/Repos/wibandwob-dos-xterm/tools/api_server/README.md -- Update socket path documentation. Note WIBWOB_INSTANCE env var.
   3. /Users/james/Repos/wibandwob-dos-xterm/.claude/skills/ww-build-test/SKILL.md -- Update socket path reference (line 118).

   ---
   Summary of All Files Changed

   ┌─────┬───────────────────────────────────────┬──────────────────────────────────────────┬──────────────────────────────┐
   │  #  │                 File                  │                  Nature                  │        Lines Changed         │
   ├─────┼───────────────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────┤
   │ 1   │ app/test_pattern_app.cpp              │ Read WIBWOB_INSTANCE, derive socket path │ ~5 lines added near L697     │
   ├─────┼───────────────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────┤
   │ 2   │ app/llm/tools/tui_tools.cpp           │ Read WIBWOB_INSTANCE, derive socket path │ ~6 lines changed near L75-82 │
   ├─────┼───────────────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────┤
   │ 3   │ tools/api_server/ipc_client.py        │ Add WIBWOB_INSTANCE to resolution chain  │ ~10 lines                    │
   ├─────┼───────────────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────┤
   │ 4   │ tools/api_server/test_ipc.py          │ Use env-aware socket path                │ ~5 lines                     │
   ├─────┼───────────────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────┤
   │ 5   │ tools/api_server/test_move.py         │ Use env-aware socket path                │ ~5 lines                     │
   ├─────┼───────────────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────┤
   │ 6   │ tools/api_server/test_browser_ipc.py  │ Use env-aware socket path                │ ~5 lines                     │
   ├─────┼───────────────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────┤
   │ 7   │ tools/api_server/move_test_pattern.py │ Use env-aware socket path                │ ~5 lines                     │
   ├─────┼───────────────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────┤
   │ 8   │ tools/monitor/instance_monitor.py     │ New file -- polling monitor              │ ~80 lines                    │
   ├─────┼───────────────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────┤
   │ 9   │ tools/scripts/launch_tmux.sh          │ New file -- tmux orchestrator            │ ~35 lines                    │
   ├─────┼───────────────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────┤
   │ 10  │ CLAUDE.md                             │ Docs: env var, multi-instance            │ ~10 lines                    │
   ├─────┼───────────────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────┤
   │ 11  │ tools/api_server/README.md            │ Docs: updated socket path info           │ ~5 lines                     │
   └─────┴───────────────────────────────────────┴──────────────────────────────────────────┴──────────────────────────────┘

   Total estimated diff: ~170 lines across 11 files (2 new, 9 modified).

   ---
   Risk Assessment

   - Backward compatibility: Zero risk. Unset WIBWOB_INSTANCE falls back to legacy /tmp/test_pattern_app.sock in all code paths.
   - Race condition on socket cleanup: ApiIpcServer::start() already calls unlink() before bind() (line 109 of api_ipc.cpp). Each instance has a unique path, so no conflict.
   - API server multi-instance: Each API server instance would need its own WIBWOB_INSTANCE (or TV_IPC_SOCK) to talk to its paired TUI instance. The monitor script handles discovery directly via glob,
   bypassing the API server entirely.
   - ttyd compatibility: ttyd wraps in bash -c, so WIBWOB_INSTANCE=1 bash -c '... ./build/app/test_pattern ...' propagates the env var correctly.

   ---
   Critical Files for Implementation

   - /Users/james/Repos/wibandwob-dos-xterm/app/test_pattern_app.cpp - Core change: read WIBWOB_INSTANCE env var at constructor (line 694-697) to derive per-instance socket path
   - /Users/james/Repos/wibandwob-dos-xterm/app/llm/tools/tui_tools.cpp - Embedded tool socket: hardcoded path at line 82 must use same env var derivation
   - /Users/james/Repos/wibandwob-dos-xterm/tools/api_server/ipc_client.py - Python socket resolution: add WIBWOB_INSTANCE to the priority chain (line 9)
   - /Users/james/Repos/wibandwob-dos-xterm/tools/monitor/instance_monitor.py - New file: polling monitor that discovers sockets via glob and renders dashboard
   - /Users/james/Repos/wibandwob-dos-xterm/tools/scripts/launch_tmux.sh - New file: tmux session orchestrator that spawns N instances with sidebar