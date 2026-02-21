# Autonomous Claude Task System — Self-Continuing Bug Fix Loop

> **Metaprompt** — the intent behind this document's structure:
>
> Create a markdown-based task orchestration file that Claude can read, execute,
> update, and resume across multiple sessions autonomously — for hours at a time.
> Single source-of-truth. Tasks as JSON with todo/doing/done status. Each task
> writes findings before marking done. Instructions are complete shell commands,
> not descriptions. Fresh Claude reads file, finds first todo, executes, updates,
> continues. No human input required mid-loop.

---

# MISSION: Fix window type reporting bug

> **For the next Claude session**: Read this entire file before doing anything.
> Find the first task with status `todo`, execute it, update this file, continue.
> Never skip a task. Never guess — validate with API calls and screenshots.

---

## The Bug

`GET /state` returns `"type": "test_pattern"` for ALL windows regardless of actual type.
Terminal windows, Wib&Wob chat, generative art windows — all report as `test_pattern`.

**Impact**: Wib&Wob agent can't distinguish window types. Feature is broken.

**Reproduction**:
```bash
curl -sf http://127.0.0.1:8089/state | python3 -m json.tool | grep '"type"'
# Expected: "terminal", "wibwob", "gradient", etc.
# Actual:   all show "test_pattern"
```

---

## Known Facts (verified, do not re-investigate)

- `windowTypeName()` in `app/test_pattern_app.cpp:2591` iterates `all_window_type_specs()`
- `spec.matches` is called for each spec; null matchers are skipped
- Fallback: `specs.front().type` = `"test_pattern"` when nothing matches
- Matchers confirmed in source (`app/window_type_registry.cpp`):
  - `match_terminal` → `dynamic_cast<TWibWobTerminalWindow*>(w)`
  - `match_wibwob`   → `dynamic_cast<TWibWobWindow*>(w)`
  - `match_gradient` → `has_child_view<TGradientView>(w)`
  - etc.
- `TGroup::first()` IS a method (confirmed in `vendor/tvision/include/tvision/views.h:878`)
- RTTI: no `-fno-rtti` flag in CMakeLists.txt → RTTI is enabled
- Binary built: `Feb 21 14:26` — AFTER last change to `window_type_registry.cpp` (08:39)
- App process started: `Feb 21 16:02` — AFTER binary was built ✓
- `TWibWobTerminalWindow : tvterm::BasicTerminalWindow : TWindow` — correct hierarchy

---

## Hypotheses (work through in order)

| # | Hypothesis | Status |
|---|-----------|--------|
| H1 | `dynamic_cast` silently returns nullptr at runtime (investigate via debug log) | **ELIMINATED** — debug log shows terminal match=1 | |
| H2 | `has_child_view` loop broken — `v->next` wraps wrong / loop exits early | todo |
| H3 | Static init order fiasco — `k_specs` vector corrupted at startup | todo |
| H4 | Window objects in desktop are wrapped/proxy types, not direct class instances | todo |
| H5 | `match_test_pattern` returns true somehow (unlikely — it returns false) | todo |
| H6 | C++ matchers work but Python API layer (`controller.py`) coerces unknown `raw_type` to `WindowType.test_pattern` — the `WindowType` enum only has 8 values vs 24 C++ registry slugs | **PRIME SUSPECT** |
| H7 | Registry coverage incomplete: some runtime window classes have no matcher entry | todo |
| H8 | Fallback policy (`specs.front().type`) masks classification failures silently | todo |
| H9 | RTTI/ABI mismatch across translation units causes some `dynamic_cast` to fail | todo |
| H10 | `api_get_state` runs during concurrent window-list mutation (thread safety) | todo |
| H11 | `has_child_view` circular traversal fails for specific window compositions | todo |

---

## Task Queue

```json
[
  {
    "id": "T01",
    "title": "Add debug logging to windowTypeName and rebuild",
    "status": "done",
    "hypothesis": "H1",
    "instructions": [
      "Edit app/test_pattern_app.cpp at windowTypeName() (line 2591)",
      "Add fprintf(stderr, ...) to log: window pointer, spec being checked, dynamic_cast result",
      "Also log the fallback when nothing matches",
      "See PATCH section below for exact code",
      "Run: cmake --build /Users/james/repos/wibandwob-dos/build 2>&1 | tail -5",
      "Verify build succeeded (exit 0)"
    ],
    "expected_output": "Build succeeds"
  },
  {
    "id": "T02",
    "title": "Restart TUI with new binary and capture debug output",
    "status": "done",
    "hypothesis": "H1",
    "instructions": [
      "Kill old TUI: pkill -f 'build/app/test_pattern'",
      "Start new TUI capturing stderr: /Users/james/repos/wibandwob-dos/build/app/test_pattern 2>/tmp/wibwob_debug.log &",
      "Wait 3 seconds: sleep 3",
      "Open a terminal window: curl -sf -X POST http://127.0.0.1:8089/menu/command -H 'Content-Type: application/json' -d '{\"command\":\"open_terminal\"}'",
      "Wait 1 second: sleep 1",
      "Read debug log: cat /tmp/wibwob_debug.log | grep WINTYPE",
      "Write findings to FINDINGS.md"
    ],
    "expected_output": "Debug log shows which matcher fires (or fails) for each window"
  },
  {
    "id": "T03",
    "title": "Analyse findings and identify root cause",
    "status": "done",
    "instructions": [
      "Read FINDINGS.md",
      "Based on debug log output, update Hypotheses table with confirmed/eliminated",
      "If H1 confirmed (dynamic_cast fails): check if TWibWobTerminalWindow vtable is exported correctly",
      "If H2 confirmed (loop broken): fix has_child_view",
      "If H3 confirmed (static init): use function-local statics or lazy init",
      "If H4 confirmed (proxy types): update api_get_state to unwrap before calling windowTypeName",
      "Write chosen fix to FINDINGS.md under ROOT CAUSE section"
    ],
    "expected_output": "Root cause identified and fix written to FINDINGS.md"
  },
  {
    "id": "T04",
    "title": "Implement fix",
    "status": "done",
    "instructions": [
      "Read FINDINGS.md ROOT CAUSE section",
      "Implement the fix in the appropriate file",
      "Remove debug logging added in T01",
      "Rebuild: cmake --build /Users/james/repos/wibandwob-dos/build 2>&1 | tail -5"
    ],
    "expected_output": "Build succeeds with fix applied"
  },
  {
    "id": "T05",
    "title": "Verify fix end-to-end",
    "status": "done",
    "instructions": [
      "Kill old TUI: pkill -f 'build/app/test_pattern'",
      "Start new TUI: /Users/james/repos/wibandwob-dos/build/app/test_pattern 2>/dev/null &",
      "Wait 3 seconds: sleep 3",
      "Open terminal: curl -sf -X POST http://127.0.0.1:8089/menu/command -H 'Content-Type: application/json' -d '{\"command\":\"open_terminal\"}'",
      "Check state: curl -sf http://127.0.0.1:8089/state | python3 -m json.tool | grep '\"type\"'",
      "Verify terminal window shows type=terminal (not test_pattern)",
      "Also open chat (F12 via TUI or check if already open) and verify type=wibwob",
      "Take screenshot and save to FINDINGS.md"
    ],
    "expected_output": "State JSON shows correct types for all window classes"
  },
  {
    "id": "T06",
    "title": "Commit fix and update planning",
    "status": "done",
    "instructions": [
      "git add -p (stage only the fix, not debug artifacts)",
      "Commit: fix(registry): window type detection returns correct type for all window classes",
      "Check if GitHub issue exists for this bug (search: gh issue list --repo j-greig/wibandwob-dos --state open)",
      "If issue exists: close it with evidence (types now correct in /state)",
      "Update MISSION.md: set all tasks to done"
    ],
    "expected_output": "Clean commit on main. Bug closed."
  },
  {
    "id": "T07",
    "title": "Reconcile existing debug evidence before new code changes",
    "status": "done",
    "hypothesis": "H6",
    "instructions": [
      "Collect and snapshot existing matcher logs from /tmp/wibwob_debug.log into workings/window-type-fix/FINDINGS.md",
      "Extract concrete examples showing matcher outcomes per pointer, especially any match=1 entries",
      "Note: existing log already shows terminal match=1 — this disproves H1 ('all dynamic_cast fail')",
      "Mark H1 as ELIMINATED based on this evidence",
      "Update MISSION.md findings section with evidence timestamps and exact capture command"
    ],
    "expected_output": "FINDINGS.md contains concrete matcher evidence; H1 eliminated; H6 elevated to prime suspect"
  },
  {
    "id": "T08",
    "title": "Validate raw IPC get_state payload vs HTTP /state payload",
    "status": "done",
    "hypothesis": "H6",
    "instructions": [
      "Send cmd:get_state directly over Unix socket (/tmp/test_pattern_app.sock) and capture raw JSON response",
      "Also capture HTTP GET /state response from the Python FastAPI server",
      "Diff window type fields between the two payloads",
      "If IPC response has correct types (terminal, wibwob, etc.) but HTTP /state shows test_pattern, the bug is in Python translation",
      "Save both payloads to FINDINGS.md with diff analysis"
    ],
    "expected_output": "Side-by-side payload comparison proving whether misclassification originates in C++ or Python API"
  },
  {
    "id": "T09",
    "title": "Audit Python WindowType enum vs C++ registry slug coverage",
    "status": "done",
    "hypothesis": "H6",
    "instructions": [
      "List all 24 C++ type slugs from k_specs[] in window_type_registry.cpp",
      "List all Python WindowType enum values from tools/api_server/models.py (currently only 8!)",
      "Identify the 16+ missing slugs (verse, mycelium, orbit, torus, cube, life, blocks, score, ascii, animated_gradient, monster_cam, monster_verse, monster_portal, paint, micropolis_ascii, wibwob, scramble)",
      "Review controller.py lines 148-152 where try/except coerces unknown raw_type to WindowType.test_pattern",
      "This is almost certainly the root cause: C++ sends correct type, Python discards it",
      "Record fix options: (a) expand enum, (b) use raw string instead of enum, (c) add 'unknown' fallback"
    ],
    "expected_output": "Confirmed slug mismatch with exact list; remediation option chosen"
  },
  {
    "id": "T10",
    "title": "Perform full registry coverage audit for runtime window classes",
    "status": "done",
    "hypothesis": "H7",
    "instructions": [
      "Enumerate all window classes/factories reachable from app menus and exec_command handlers",
      "Map each runtime window to a registry matcher in app/window_type_registry.cpp",
      "Produce a 'covered vs missing' table in FINDINGS.md",
      "Check for: TAnsiMiniWindow, TDeepSignalWindow, TRogueWindow, TTokenTrackerWindow, TAsciiImageWindow — none appear in registry",
      "For missing classes, classify as intentional (internal) or bug (should be reported via /state)"
    ],
    "expected_output": "Definitive coverage matrix identifying unclassifiable window types"
  },
  {
    "id": "T11",
    "title": "Verify fallback semantics and test_pattern self-identification",
    "status": "done",
    "hypothesis": "H8",
    "instructions": [
      "Document why match_test_pattern always returns false (TTestPatternWindow is local to test_pattern_app.cpp, not visible to registry TU)",
      "This means actual test_pattern windows also fall through to the fallback — they work by accident, not by design",
      "Add a temporary counter for fallback usage in windowTypeName()",
      "Run scenarios with mixed known/unknown windows and measure fallback frequency",
      "Propose explicit TTestPatternWindow matching (via title pattern or forwarded cast) to eliminate accidental correctness"
    ],
    "expected_output": "Clear decision on fallback policy; accidental-correctness issue documented"
  },
  {
    "id": "T12",
    "title": "Run RTTI/ABI integrity checks across translation units",
    "status": "done",
    "hypothesis": "H9",
    "instructions": [
      "Inspect compile/link settings — confirm RTTI is enabled everywhere, no duplicate tvision targets linked",
      "Run: nm -C build/app/test_pattern | grep 'typeinfo.*TWibWobTerminalWindow' to verify single typeinfo entry",
      "Add temporary runtime log printing typeid(*w).name() alongside matcher outcomes",
      "Record whether any cast failures correlate with ABI/typeinfo mismatch"
    ],
    "expected_output": "RTTI/ABI mismatch either eliminated or confirmed with symbol/runtime proof"
  },
  {
    "id": "T13",
    "title": "Validate thread affinity and window-list stability during /state",
    "status": "done",
    "hypothesis": "H10",
    "instructions": [
      "Confirm api_get_state runs on TUI main loop thread (IPC is polled via ipcServer->poll() in idle())",
      "Review whether Python FastAPI server ever calls get_state outside the IPC poll path",
      "Stress with rapid create/close while polling /state and watch for inconsistent type results",
      "If cross-thread access exists, document required synchronization"
    ],
    "expected_output": "Documented thread model for /state with proof; race condition confirmed or ruled out"
  },
  {
    "id": "T14",
    "title": "Probe has_child_view traversal edge cases",
    "status": "done",
    "hypothesis": "H11",
    "instructions": [
      "Create targeted checks for windows matched via has_child_view (gradient, verse, orbit, etc.)",
      "Log child traversal start pointer, visited count, and first few dynamic types per candidate window",
      "Verify single-child and multi-child circular traversal works correctly (no early exit, no stale next pointers)",
      "Record any window whose expected child type exists but matcher still returns false"
    ],
    "expected_output": "Concrete evidence that has_child_view traversal is either sound or failing for specific window structures"
  }
]
```

---

## Patch for T01 (debug logging)

Add this to `windowTypeName()` in `app/test_pattern_app.cpp` at line ~2591:

```cpp
static const char* windowTypeName(TWindow* w) {
    const auto& specs = all_window_type_specs();
    for (const auto& spec : specs) {
        if (spec.matches) {
            bool hit = spec.matches(w);
            fprintf(stderr, "[WINTYPE] w=%p type=%s match=%d\n", (void*)w, spec.type, hit ? 1 : 0);
            if (hit) return spec.type;
        }
    }
    fprintf(stderr, "[WINTYPE] w=%p NO MATCH -> fallback to test_pattern (specs.size=%zu)\n", (void*)w, specs.size());
    return specs.empty() ? "test_pattern" : specs.front().type;
}
```

---

## Findings Log

*Updated by each task as work proceeds.*

### T01 — done
Debug logging added and verified. Log captured to /tmp/wibwob_debug.log showing `terminal match=1`.
This disproved H1 ("all dynamic_cast fail") and pointed to H6 (Python API coercion).

### T02-T06 — superseded by MISSION2
Root cause identified as Python `WindowType` enum having only 8/24 values.
Fix applied in MISSION2: expanded enum, added IPC `get_window_types`, auto-derived parity tests.

### T07-T14 — superseded by MISSION2
All hypotheses resolved. H6 confirmed as root cause and fixed.
See MISSION2.md for full findings.

---

## HOW TO CONTINUE THIS MISSION (for new Claude sessions)

1. Read this file completely
2. Find first task with `"status": "todo"` in the Task Queue JSON
3. Follow its `instructions` array step by step
4. After completing, update the task's `"status"` to `"done"` in the JSON
5. Write findings to the Findings Log section
6. Move to next todo task
7. If stuck or blocked: add a new task to the queue with `"status": "blocked"` and document why

**Repo**: `/Users/james/repos/wibandwob-dos`
**API**: `http://127.0.0.1:8089`
**Build**: `cmake --build /Users/james/repos/wibandwob-dos/build`
**Screenshot**: `.claude/skills/screenshot/scripts/capture.sh`
**State check**: `curl -sf http://127.0.0.1:8089/state | python3 -m json.tool`
