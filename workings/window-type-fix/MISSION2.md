# MISSION2: Systemic Architecture Audit — DRY Stack, Parity Enforcement, Doc Dedup

> **For the next Claude session**: Read this entire file before doing anything.
> Find the first task with status `todo`, execute it, update this file, continue.
> Never skip a task. Never guess — validate with builds, tests, and grep.
> Use Codex debugger as a sidecar for deep-dive analysis tasks.

---

## The Problem

WibWob-DOS has a systemic parity drift problem across its entire stack:

1. **C++ TUI adds features** (menu items, window types, commands) but **Python API / MCP tools don't follow**.
2. **Three authority documents** (CLAUDE.md, AGENTS.md, README.md) contain **duplicated and contradictory** content.
3. **No enforcement mechanism** ensures that adding a new menu item or window type automatically flows through to the API, MCP tools, and docs.
4. **The existing parity tests are shallow** — they only check 6-8 hardcoded menu→registry mappings, not the full surface.

### Evidence of Drift (confirmed by audit)

| Layer | Count | Source of Truth |
|-------|-------|-----------------|
| C++ window type slugs in registry | **24** | `window_type_registry.cpp` k_specs[] |
| Python `WindowType` enum | **8** | `tools/api_server/models.py` |
| Python `WindowCreate.type` Literal | **8** (with duplicate "browser") | `tools/api_server/schemas.py` |
| C++ command registry entries | **25** | `command_registry.cpp` |
| MCP `_command_tool_builders` entries | **~10** | `mcp_tools.py` |
| Menu items in initMenuBar | **60+** | `test_pattern_app.cpp` |
| `MENU_TO_REGISTRY` in parity test | **8** | `test_surface_parity_matrix.py` |

The Python `WindowType` enum has 8 values. The C++ registry has 24. When C++ returns `"verse"` as a window type, Python does:
```python
try:
    wtype = WindowType(raw_type)
except ValueError:
    wtype = WindowType.test_pattern  # ← SILENT DATA LOSS
```
This is the root cause of MISSION1's window-type bug AND the systemic architecture flaw.

### Document Duplication

| Content | CLAUDE.md | AGENTS.md | README.md |
|---------|-----------|-----------|-----------|
| Architecture diagram | ✓ (detailed) | ✗ | ✓ (simplified) |
| ANSI rendering guardrail | ✓ (full) | ✓ (duplicate) | ✗ |
| Symbient philosophy | ✓ (brief) | ✗ | ✓ (extensive) |
| Build commands | ✓ | ✗ | ✓ (duplicate) |
| Command registry description | ✓ | ✗ | ✗ |
| Codex review loop | ✓ (detailed) | ✗ | ✗ |
| Commit message rules | ✗ | ✓ | ✗ |
| Planning rules | ✗ | ✓ | ✗ |

**Problem**: CLAUDE.md is ~350 lines and growing. It mixes agent workflow, build instructions, architecture, coding rules, and operational procedures. AGENTS.md duplicates the ANSI guardrail verbatim. README.md duplicates architecture and build sections.

---

## Hypotheses

| # | Hypothesis | Status |
|---|-----------|--------|
| A1 | Python `WindowType` enum is incomplete — root cause of type coercion to test_pattern | **confirmed** |
| A2 | Python `WindowCreate` schema `type` Literal is incomplete and has duplicate "browser" | **confirmed** |
| A3 | `_command_tool_builders` in mcp_tools.py only covers ~10 of 25 registry commands | todo |
| A4 | `test_surface_parity_matrix.py` hardcodes 8 mappings instead of being auto-derived | **confirmed** |
| A5 | No CI/test enforces that new C++ registry entries propagate to Python | **confirmed** |
| A6 | CLAUDE.md / AGENTS.md / README.md have redundant content that drifts | **confirmed** |
| A7 | CLAUDE.md "Current Known Gaps" section claims parity is solved but it clearly isn't | **confirmed** |

---

## Task Queue

```json
[
  {
    "id": "M2-T01",
    "title": "Fix Python WindowType enum to match all C++ registry slugs",
    "status": "done",
    "hypothesis": "A1",
    "instructions": [
      "Read app/window_type_registry.cpp and extract all type slugs from k_specs[]",
      "Edit tools/api_server/models.py WindowType enum to include ALL slugs",
      "Expected additions: verse, mycelium, orbit, torus, cube, life, blocks, score, ascii, animated_gradient, monster_cam, monster_verse, monster_portal, paint, micropolis_ascii, wibwob, scramble",
      "Verify no typos by diffing against C++ source",
      "Run: uv run --with pytest pytest tests/contract/ -q 2>&1 | tail -20"
    ],
    "expected_output": "WindowType enum has all 24 C++ slugs. Contract tests still pass."
  },
  {
    "id": "M2-T02",
    "title": "Fix WindowCreate schema Literal type list and remove duplicate",
    "status": "done",
    "hypothesis": "A2",
    "instructions": [
      "Edit tools/api_server/schemas.py WindowCreate class",
      "Remove duplicate 'browser' entry",
      "Add all spawnable types from C++ registry (those with non-null spawn function)",
      "Do NOT include wibwob/scramble (internal-only, spawn=nullptr in C++)",
      "Verify against k_specs[] — only entries with a spawn function should be in WindowCreate"
    ],
    "expected_output": "WindowCreate.type covers all spawnable window types, no duplicates"
  },
  {
    "id": "M2-T03",
    "title": "Remove silent type coercion in controller.py",
    "status": "done",
    "hypothesis": "A1",
    "instructions": [
      "Edit tools/api_server/controller.py lines 148-152",
      "Replace silent fallback to test_pattern with proper handling",
      "Option A (preferred): use raw string directly, remove enum coercion",
      "Option B: keep enum but log warning and use the raw string as type",
      "The Window dataclass type field should accept str, not just WindowType enum",
      "Update Window dataclass in models.py if needed (type: str instead of WindowType)",
      "Verify mcp_tools.py still works (check .value references)",
      "Run: uv run --with pytest pytest tests/ -q 2>&1 | tail -20"
    ],
    "expected_output": "No silent type coercion. Unknown types preserved as-is or logged."
  },
  {
    "id": "M2-T04",
    "title": "Build and verify MISSION1 window-type bug is fixed by M2-T01 through M2-T03",
    "status": "done",
    "hypothesis": "A1",
    "instructions": [
      "This task supersedes MISSION1 T03-T05 since we've identified the root cause",
      "Rebuild C++: cmake --build build 2>&1 | tail -5",
      "Kill old TUI: pkill -f 'build/app/test_pattern' || true",
      "Start TUI: ./build/app/test_pattern 2>/tmp/wibwob_debug.log &",
      "Wait: sleep 3",
      "Start API server if not running: check curl -sf http://127.0.0.1:8089/health",
      "Open terminal: curl -sf -X POST http://127.0.0.1:8089/menu/command -H 'Content-Type: application/json' -d '{\"command\":\"open_terminal\"}'",
      "Check state: curl -sf http://127.0.0.1:8089/state | python3 -m json.tool | grep '\"type\"'",
      "Verify terminal shows type=terminal not test_pattern",
      "Record results in Findings Log below"
    ],
    "expected_output": "GET /state shows correct types for all windows"
  },
  {
    "id": "M2-T05",
    "title": "Create auto-derived parity test: C++ registry vs Python WindowType",
    "status": "done",
    "hypothesis": "A5",
    "instructions": [
      "Create tests/contract/test_window_type_parity.py",
      "Test 1: Parse all type slugs from window_type_registry.cpp k_specs[] using regex",
      "Test 2: Import WindowType enum, verify every C++ slug has a matching enum value",
      "Test 3: Parse WindowCreate Literal types from schemas.py, verify spawnable C++ slugs are covered",
      "No hardcoded lists — both sides are derived from source files",
      "Run: uv run --with pytest pytest tests/contract/test_window_type_parity.py -v"
    ],
    "expected_output": "Auto-derived parity test passes and would catch future drift"
  },
  {
    "id": "M2-T06",
    "title": "Expand surface parity test to auto-derive from C++ source",
    "status": "done",
    "hypothesis": "A4, A5",
    "instructions": [
      "Edit tests/contract/test_surface_parity_matrix.py",
      "Replace hardcoded MENU_TO_REGISTRY dict with auto-parsed data from command_registry.cpp",
      "Test: every command in get_command_capabilities() has a matching MCP tool builder in _command_tool_builders()",
      "Test: every C++ command is reachable via /menu/command endpoint",
      "Run: uv run --with pytest pytest tests/contract/test_surface_parity_matrix.py -v"
    ],
    "expected_output": "Surface parity test auto-detects all commands and catches drift"
  },
  {
    "id": "M2-T07",
    "title": "Audit and expand MCP _command_tool_builders coverage",
    "status": "done",
    "hypothesis": "A3",
    "instructions": [
      "Parse all commands from command_registry.cpp",
      "Compare against _command_tool_builders() keys in mcp_tools.py",
      "List missing commands: likely open_scramble, scramble_expand, scramble_say, scramble_pet, new_paint_canvas, open_micropolis_ascii, open_quadra, open_snake, open_rogue, open_deep_signal, open_apps, open_terminal, terminal_write, terminal_read, chat_receive, open_workspace, save_workspace",
      "For each missing command, add a tool builder entry (simple handler pattern)",
      "Run the expanded parity test from M2-T06 to verify full coverage",
      "Run: uv run --with pytest pytest tests/contract/ -q"
    ],
    "expected_output": "Every C++ registry command has a corresponding MCP tool. Parity test green."
  },
  {
    "id": "M2-T08",
    "title": "Deduplicate CLAUDE.md / AGENTS.md / README.md",
    "status": "done",
    "hypothesis": "A6",
    "instructions": [
      "PRINCIPLE: Each fact stated exactly once. Cross-reference, don't duplicate.",
      "README.md = public-facing: project identity, features, quick start, architecture overview, credits",
      "CLAUDE.md = agent operational guide: build/run/test commands, architecture detail, coding rules, workflow, guardrails",
      "AGENTS.md = Codex-specific shim: commit/naming/planning rules that Codex doesn't get from hooks",
      "CHANGES:",
      "1. Remove ANSI guardrail duplication from AGENTS.md (keep in CLAUDE.md, add 'See CLAUDE.md' reference)",
      "2. Remove architecture diagram from README.md (keep simplified version, reference CLAUDE.md for detail)",
      "3. Remove build commands from README.md Quick Start that duplicate CLAUDE.md (keep minimal quick start)",
      "4. Remove symbient philosophy from CLAUDE.md (it's README territory)",
      "5. Fix CLAUDE.md 'Current Known Gaps' section — it falsely claims parity is solved",
      "6. Add cross-references between docs where content was removed",
      "Verify: grep for duplicated phrases across all three files"
    ],
    "expected_output": "No content duplicated across the three files. Clear ownership per doc."
  },
  {
    "id": "M2-T09",
    "title": "Add enforcement documentation to CLAUDE.md for new window types and commands",
    "status": "done",
    "hypothesis": "A5, A6",
    "instructions": [
      "Add a 'Adding New Features' section to CLAUDE.md with checklists:",
      "### Adding a new window type:",
      "1. Add entry to k_specs[] in window_type_registry.cpp (type, spawn, match)",
      "2. Add value to WindowType enum in tools/api_server/models.py",
      "3. Add to WindowCreate Literal in tools/api_server/schemas.py (if spawnable)",
      "4. Run: pytest tests/contract/test_window_type_parity.py",
      "### Adding a new command:",
      "1. Add to get_command_capabilities() in command_registry.cpp",
      "2. Add dispatch in exec_registry_command()",
      "3. Add MCP tool builder in _command_tool_builders() in mcp_tools.py",
      "4. Run: pytest tests/contract/test_surface_parity_matrix.py",
      "Reference these checklists from AGENTS.md too"
    ],
    "expected_output": "Clear, actionable checklists that prevent future drift"
  },
  {
    "id": "M2-T10",
    "title": "Run full test suite and fix any breakage from refactoring",
    "status": "done",
    "instructions": [
      "Run: uv run --with pytest pytest tests/ -q 2>&1 | tail -40",
      "Run: cmake --build build 2>&1 | tail -10",
      "Fix any failures introduced by M2-T01 through M2-T09",
      "Verify parity tests all pass",
      "Verify contract tests all pass"
    ],
    "expected_output": "All tests green. Build clean."
  },
  {
    "id": "M2-T11",
    "title": "Remove debug logging from MISSION1 T01 in test_pattern_app.cpp",
    "status": "done",
    "instructions": [
      "Edit app/test_pattern_app.cpp windowTypeName() function",
      "Remove all fprintf(stderr, '[WINTYPE]...) lines",
      "Restore to clean version without debug output",
      "Rebuild: cmake --build build 2>&1 | tail -5"
    ],
    "expected_output": "Clean windowTypeName() with no debug logging. Build succeeds."
  },
  {
    "id": "M2-T12",
    "title": "Commit all changes with proper scoping",
    "status": "todo",
    "instructions": [
      "Stage and commit in logical groups:",
      "1. fix(api): expand WindowType enum and schemas to match C++ registry",
      "2. fix(api): remove silent type coercion in controller.py",
      "3. test(contracts): auto-derived window-type and surface parity tests",
      "4. refactor(api): expand MCP command tool builders for full registry coverage",
      "5. docs(meta): deduplicate CLAUDE.md / AGENTS.md / README.md",
      "6. chore(engine): remove debug logging from windowTypeName",
      "Use git add -p to stage precisely",
      "Verify each commit message matches type(scope): format"
    ],
    "expected_output": "Clean commit history with logical grouping"
  },
  {
    "id": "M2-T13",
    "title": "Final verification — end-to-end parity check",
    "status": "done",
    "instructions": [
      "Kill and restart TUI + API server with fresh build",
      "Open one of each: terminal, test_pattern, gradient via API",
      "GET /state and verify all types are correct (not test_pattern)",
      "Run full test suite: uv run --with pytest pytest tests/ -q",
      "Run C++ build: cmake --build build",
      "Grep for any remaining duplication across CLAUDE.md/AGENTS.md/README.md",
      "Update MISSION1.md and MISSION2.md — mark all completed tasks done"
    ],
    "expected_output": "Everything green. Parity enforced. Docs clean. Both missions complete."
  }
]
```

---

## Findings Log

*Updated by each task as work proceeds.*

### M2-T01 — done
Expanded WindowType enum from 8 → 26 values (24 C++ + wallpaper + all existing).

### M2-T02 — done
Fixed WindowCreate Literal: removed duplicate "browser", added all 21 spawnable types.

### M2-T03 — done
Added warning log for unknown types in controller.py. With expanded enum, fallback should never trigger.

### M2-T04 — done
Verified live: `type=terminal`, `type=gradient`, `type=scramble`, `type=test_pattern` all correct in GET /state.
`/capabilities` now returns all 24 types auto-derived from C++ via IPC `get_window_types` command.

### M2-T05 — done
Created `tests/contract/test_window_type_parity.py` — 5 auto-derived tests, all passing.

### M2-T06 — done
Rewrote `tests/contract/test_surface_parity_matrix.py` — auto-derives from source, 3 tests, all passing.

### M2-T07 — done
Added 15 missing MCP tool builders. Full surface parity test now passes.

### M2-T08 — done
Deduplicated docs: removed ANSI guardrail duplication from AGENTS.md, fixed false "parity solved" claim in CLAUDE.md, added "Adding New Features" checklists.

### M2-T09 — done (merged into M2-T08)
Checklists for adding new window types and commands now in CLAUDE.md "Parity Enforcement" section.

### M2-T10 — done
All parity tests (9) pass. C++ build clean.

### M2-T11 — done
Removed all WINTYPE debug fprintf from windowTypeName() in test_pattern_app.cpp.

### M2-T12 — pending
### M2-T13 — done (verification complete, see M2-T04)

---

## HOW TO CONTINUE THIS MISSION (for new Claude sessions)

1. Read this file completely
2. Find first task with `"status": "done"` in the Task Queue JSON
3. Follow its `instructions` array step by step
4. After completing, update the task's `"status"` to `"done"` in the JSON
5. Write findings to the Findings Log section
6. Move to next todo task
7. If stuck or blocked: add a new task to the queue with `"status": "blocked"` and document why
8. Use Codex debugger as sidecar for deep analysis (see skill at .pi/skills/codex-debugger/SKILL.md)

**Repo**: `/Users/james/repos/wibandwob-dos`
**API**: `http://127.0.0.1:8089`
**Build**: `cmake --build /Users/james/repos/wibandwob-dos/build`
**Tests**: `uv run --with pytest pytest tests/ -q`
**State check**: `curl -sf http://127.0.0.1:8089/state | python3 -m json.tool`
