# SPK01 — Rename test_pattern to wwdos

**tl;dr**: Rename the main binary from `test_pattern` to `wwdos` and the main app class from `TTestPatternApp` to `TWwdosApp`, without changing the `"test_pattern"` window-type protocol slug. A grep audit shows the class rename is much larger than originally estimated, and file-path/script/docs fallout is broader than the old spike suggested.

**status**: done
**severity**: housekeeping (no functional change intended)
**depends_on**: E009 (still recommended first; `app/test_pattern_app.cpp` remains a merge hotspot)

> Phase 0 note (2026-02-24): `gh pr list` / `gh issue list` could not be queried from this environment (`error connecting to api.github.com`), so in-flight PR conflict checks could not be confirmed from GitHub during this pass.

---

## Blast Radius Summary

### Audit Scope (for counts below)

Grep counts below are for live/actionable files and exclude noise/artifacts:
- `.codex-logs/**` (explicitly requested)
- `archive/**`
- `workings/**`
- `memories/**`
- `docs/codex-reviews/**`
- `.planning/**/.trash/**`
- `.planning/audits/**` (tracked separately; mostly audit outputs/history)

### Claimed vs Actual (grep-verified)

| Category | What | Spike claimed | Actual now (live/actionable scope) | Risk |
|----------|------|---------------|------------------------------------|------|
| A | Binary/executable name (`test_pattern` target/path/process refs) | `~11` | Core runtime/build refs: **11 matches / 4 files**, plus **1 launcher path-segment file** (`tools/room/orchestrator.py`), plus many docs/skills refs | Medium (larger docs/tooling sweep than implied) |
| B | C++ class name (`TTestPatternApp`) | `~26+` | **465 matches / 15 files** (including tests + skill docs); **459 matches / 10 app files** in core code/test harness | High |
| C | Window type string `"test_pattern"` | `~5` | **34 exact `"test_pattern"` literals** in `app/`, `tools/`, `tests/`, `scripts/` (DO NOT RENAME) | Critical if touched accidentally |
| D | Socket path (`/tmp/test_pattern_app.sock`) | `~14` | **24 matches / 16 files** (excluding this spike file) | Medium |
| E | Source filenames containing `test_pattern` | `~8` | **5 filenames** currently contain `test_pattern`; only **1 required code rename**, **2 keep**, **2 optional script renames** | Medium |
| F | Docs/skills/planning references | `~12` | **22 docs/skills/planning files** mention rename-related tokens (17 operational + 4 historical/template + this spike) | Low/Medium |

## Proposed Names

| Current | Proposed | Notes |
|---------|----------|-------|
| `test_pattern` (binary) | `wwdos` | Short, matches project name used elsewhere |
| `TTestPatternApp` (class) | `TWwdosApp` | Follows Turbo Vision naming convention |
| `test_pattern_app.cpp` | `wwdos_app.cpp` | Main app source (required if doing file rename phase) |
| `test_pattern.h/cpp` | `test_pattern.h/cpp` | KEEP — these are the test pattern view/module |
| `/tmp/test_pattern_app.sock` | `/tmp/wwdos.sock` | Simpler default; keep legacy fallback during transition |
| `"test_pattern"` (window type) | `"test_pattern"` | KEEP — protocol identifier |

## Implementation Sequence

### [x] Phase 1: Binary + CMake (low code risk, high workflow visibility)

**Estimate**: 0.5 day

**Grep-verified count (core runtime/build files)**: 11 matches across 4 files, plus 1 additional launcher file (`tools/room/orchestrator.py`) using path-segment construction.

**Manifest (must change in this phase)**
- `app/CMakeLists.txt` (CMake target `test_pattern`; binary target links)
- `scripts/dev-start.sh` (build target/path messaging)
- `tools/scripts/launch_tmux.sh` (binary path)
- `tools/room/orchestrator.py` (binary path segment `"test_pattern"`)
- `app/run_wwdos_logged.sh` (invokes `./build/test_pattern`; see also Phase 4 for script filename question)

**Notes**
- This phase is bigger than the original spike implied because launcher/orchestration paths exist outside the originally listed scripts.
- `app/CMakeLists.txt` is also touched again in Phase 4 if `test_pattern_app.cpp` is renamed.

### [x] Phase 2: Socket path (medium risk; compatibility-sensitive)

**Estimate**: 0.5 day (with fallback), 1 day (if changing instance naming convention too)

**Grep-verified count**: 24 matches across 16 files (excluding this spike file).

**Manifest**
- `app/api_ipc.h`
- `app/test_pattern_app.cpp`
- `app/llm/tools/tui_tools.cpp`
- `tools/api_server/ipc_client.py`
- `tools/api_server/test_ipc.py`
- `tools/api_server/test_paint_ipc.py`
- `tools/api_server/test_browser_ipc.py`
- `tools/api_server/test_move.py`
- `tools/api_server/move_wwdos.py`
- `tools/monitor/instance_monitor.py`
- `tests/test_paint_ipc.py`
- `start_api_server.sh`
- `tools/api_server/README.md`
- `CLAUDE.md`
- `.claude/skills/ww-build-test/SKILL.md`
- `.claude/skills/ww-build-game/SKILL.md`

**Notes**
- Keep legacy fallback (`/tmp/test_pattern_app.sock`) for at least one transition cycle to avoid breaking existing scripts and stale local habits.
- Decide whether `WIBWOB_INSTANCE` naming remains `/tmp/wibwob_N.sock` (recommended: keep) vs switching instance sockets to `/tmp/wwdos_N.sock` (higher blast radius).

### [x] Phase 3: Class rename (highest risk; signature-heavy)

**Estimate**: 1.0-1.5 days

**Grep-verified count**: 465 matches across 15 files.
- Core app/C++ + test harness: 459 matches across 10 `app/*` files
- External tests/skills/docs: 6 matches across 5 files

**Why it is large (not just “26+”)**
- `app/test_pattern_app.cpp`: 242 matches
- `app/window_type_registry.cpp`: 61 matches
- `app/command_registry.cpp`: 55 matches
- `app/api_ipc.cpp`: 24 matches
- `app/command_registry_test.cpp`: 33 matches (stubbed symbols)
- `app/scramble_engine_test.cpp`: 33 matches (stubbed symbols)
- `app/test_pattern_app.cpp` includes ~70 `friend` declarations and ~71 `TTestPatternApp::` method definitions

**Manifest**
- `app/test_pattern_app.cpp`
- `app/api_ipc.h`
- `app/api_ipc.cpp`
- `app/command_registry.h`
- `app/command_registry.cpp`
- `app/window_type_registry.h`
- `app/window_type_registry.cpp`
- `app/rogue_view.cpp`
- `app/command_registry_test.cpp`
- `app/scramble_engine_test.cpp`
- `tests/room/test_menu_cleanup.py`
- `tests/room/test_layout_restore.py`
- `tests/contract/test_theme_parity.py`
- `.pi/skills/wibwobdos/references/integrating-vendor-views.md`
- `.claude/skills/ww-build-game/SKILL.md`

**Notes**
- Test stubs (`command_registry_test.cpp`, `scramble_engine_test.cpp`) are easy to miss and were not called out in the original spike.
- A temporary alias (`using TTestPatternApp = TWwdosApp;`) can reduce churn but may complicate cleanup and grep validation. Prefer one-shot rename unless branch pressure is high.

### [x] Phase 4: Source file rename (medium risk; path/string fallout)

**Estimate**: 0.5-1.0 day

**Grep-verified facts**
- Filenames containing `test_pattern` today: **2**
  - `app/test_pattern.cpp` (KEEP)
  - `app/test_pattern.h` (KEEP)
- Code/tests/scripts filename-token refs (`wwdos_app.cpp`, `run_wwdos_logged.sh`, `move_wwdos.py`): **31 matches / 19 files**

**Manifest (required for `test_pattern_app.cpp -> wwdos_app.cpp`)**
- `app/test_pattern_app.cpp` (rename to `app/wwdos_app.cpp`)
- `app/CMakeLists.txt` (source list)
- `app/api_ipc.cpp`
- `app/command_registry.cpp`
- `app/window_type_registry.cpp`
- `app/rogue_view.cpp`
- `app/deep_signal_view.cpp`
- `app/wibwob_background.cpp`
- `app/app_launcher_view.cpp`
- `app/figlet_text_view.cpp`
- `app/windows/frame_animation_window.cpp` (additional comment/path reference found during execution)
- `scripts/parity-check.py`
- `tests/room/test_menu_cleanup.py`
- `tests/contract/test_browser_copy_ui_contract.py`
- `tests/contract/test_parity_drift.py`
- `tests/contract/test_surface_parity_matrix.py`
- `tests/contract/test_theme_persistence.py`
- `tests/contract/test_theme_parity.py`
- `app/README.md`

**Optional sub-phase (script filename polish)**
- `app/run_test_pattern_logged.sh` -> `app/run_wwdos_logged.sh`
- `tools/api_server/move_test_pattern.py` -> `tools/api_server/move_wwdos.py` (done; script semantics still target the `"test_pattern"` window type)

### [x] Phase 5: Documentation / Skills / Planning Sweep

**Estimate**: 0.5-1.0 day (depending on historical docs scope)

**Grep-verified count (docs/skills/planning union)**: 22 files with rename-related tokens
- 17 operational docs/skills/planning files
- 4 historical/template/session docs (optional to update)
- 1 current spike file (this file)

**Manifest (operational docs/skills/planning to update)**
- `README.md`
- `CLAUDE.md`
- `.claude/skills/ww-audit/SKILL.md`
- `.claude/skills/ww-build-game/SKILL.md`
- `.claude/skills/ww-build-test/SKILL.md`
- `.claude/skills/ww-scaffold-view/SKILL.md`
- `.claude/skills/ww-scaffold-view/references/templates.md`
- `.pi/skills/micropolis-engine/SKILL.md`
- `.pi/skills/wibwobdos/SKILL.md`
- `.pi/skills/wibwobdos/references/cross-platform-cpp.md`
- `.pi/skills/wibwobdos/references/docker-ops.md`
- `.pi/skills/wibwobdos/references/integrating-vendor-views.md`
- `.planning/epics/e005-theme-runtime-wiring/e005-epic-brief.md`
- `.planning/epics/e008-multiplayer-partykit/f04-chat-relay/f04-feature-brief.md`
- `docs/architecture/parity-drift-audit.md`
- `docs/architecture/phase-zero-canon-alignment.md`

**Manifest (historical/template/session docs; optional)**
- `HANDOVER.md`
- `docs/CODEX-RETRO-20260218.md`
- `docs/readme-stub.md`
- `.planning/retros/retro-figlet-catalogue-menu-wiring.md`
- `.planning/spikes/spk-paint-for-wib/spike-notes-by-wib.md`

**Notes**
- If historical docs are intended to preserve original wording/snapshots, leave them unchanged and add a short note in the PR explaining scope.

## Risks

1. **Class rename blast radius is much larger than originally estimated** — 445 live references, with heavy concentration in `app/test_pattern_app.cpp`, `app/window_type_registry.cpp`, and `app/command_registry.cpp`.
2. **Hidden breakage in test stubs and file-reading contract tests** — multiple tests hardcode `TTestPatternApp` or open `app/test_pattern_app.cpp` by path.
3. **Socket compatibility regression** — changing `/tmp/test_pattern_app.sock` without fallback will break existing local scripts and workflows immediately.
4. **Protocol slug confusion** — `"test_pattern"` appears in 34 exact literals across live code/tests/tools and must not be renamed (window type/protocol, not binary/class).
5. **Scope creep via docs/history** — there are 24 docs/skills/planning files with rename-related tokens; mixing operational and historical cleanup in one PR can bloat review.
6. **Merge conflicts remain likely** — `app/test_pattern_app.cpp` is a central edit point and still attracts concurrent changes.

## Open Questions

1. Is the socket migration limited to the legacy default (`/tmp/test_pattern_app.sock -> /tmp/wwdos.sock`) while keeping `WIBWOB_INSTANCE` sockets as `/tmp/wibwob_N.sock`? (recommended)
2. Should Phase 3 + Phase 4 be one PR (class + file rename together) or two PRs to reduce review noise?
3. Do we rename the two script filenames (`run_wwdos_logged.sh`, `move_wwdos.py`) in this spike, or leave them for a follow-up polish pass?
4. Should historical/template docs (`HANDOVER.md`, retros, old retrospectives) be updated, or explicitly left as historical snapshots?

## References

- Current binary examples: `README.md:85`, `CLAUDE.md:73`
- CMake target: `app/CMakeLists.txt:31`
- Main class declaration: `app/test_pattern_app.cpp:872`
- Socket default: `app/api_ipc.h:28`
- Default socket setup in app ctor: `app/test_pattern_app.cpp:1147`
- Window type slug (DO NOT RENAME): `app/window_type_registry.cpp:299`
