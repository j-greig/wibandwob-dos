# SPK01 — Rename test_pattern to wwdos

**tl;dr**: The main binary is still called `test_pattern` from early prototyping. It's `./build/app/test_pattern` everywhere — binary, class name, socket path, source files, docs. Rename to `wwdos`. Blast radius: ~70+ references across 6 categories. Needs careful sequencing.

**status**: not-started
**severity**: housekeeping (no functional change)
**depends_on**: E009 (menu cleanup should land first to avoid merge conflicts)

---

## Blast Radius Summary

| Category | What | Count | Risk |
|----------|------|-------|------|
| A | Binary/executable name (`test_pattern` target in CMake) | ~11 | Low — CMake rename + script updates |
| B | C++ class name (`TTestPatternApp`) | ~26+ | Medium — 50+ function signatures across 4-5 files |
| C | Window type string `"test_pattern"` | ~5 | DO NOT RENAME — IPC protocol identifier, would break clients |
| D | Socket path (`/tmp/test_pattern_app.sock`) | ~14 | Medium — C++ + Python + docs, needs legacy fallback |
| E | Source file names (`test_pattern.h/cpp`, `test_pattern_app.cpp`) | ~8 | Medium — git rename, CMake update, all includes |
| F | Documentation references | ~12 | Low — find-and-replace |

## Proposed Names

| Current | Proposed | Notes |
|---------|----------|-------|
| `test_pattern` (binary) | `wwdos` | Short, matches project |
| `TTestPatternApp` (class) | `TWwdosApp` | Follows TV naming convention |
| `test_pattern_app.cpp` | `wwdos_app.cpp` | Main app source |
| `test_pattern.h/cpp` | `test_pattern.h/cpp` | KEEP — these are the test pattern *view*, not the app |
| `/tmp/test_pattern_app.sock` | `/tmp/wwdos.sock` | Simpler |
| `"test_pattern"` (window type) | `"test_pattern"` | KEEP — protocol identifier |

## Implementation Sequence

### Phase 1: Binary + CMake (low risk, high visibility)
- Rename CMake target `test_pattern` to `wwdos` in `app/CMakeLists.txt`
- Update `launch_tmux.sh`, `run_test_pattern_logged.sh`
- Update CLAUDE.md build commands
- Binary moves from `./build/app/test_pattern` to `./build/app/wwdos`

### Phase 2: Socket path (medium risk)
- Change default socket from `/tmp/test_pattern_app.sock` to `/tmp/wwdos.sock`
- Keep legacy fallback in Python `ipc_client.py` for transition
- Update `WIBWOB_INSTANCE` socket pattern: `/tmp/wwdos_N.sock`
- C++ changes: `api_ipc.h`, `test_pattern_app.cpp`, `tui_tools.cpp`

### Phase 3: Class rename (highest risk, most files)
- `TTestPatternApp` to `TWwdosApp`
- All `friend` declarations, extern functions, forward decls
- `api_ipc.h`, `window_type_registry.h`, `command_registry.cpp`
- Could use a typedef alias for transition: `using TTestPatternApp = TWwdosApp;`

### Phase 4: Source file rename (medium risk, git history)
- `test_pattern_app.cpp` to `wwdos_app.cpp`
- Update CMakeLists.txt source lists
- git mv preserves history

### Phase 5: Documentation sweep
- CLAUDE.md, README.md, app/README.md, API server docs
- Planning docs, spike notes, skill files
- Can be done in bulk with find-and-replace

## Risks

1. **Merge conflicts** — any in-flight branches touching `test_pattern_app.cpp` will conflict hard. Land E009 first, then do this on a clean main.
2. **Git blame** — `git mv` + rename preserves history if done carefully (rename file separately from content changes)
3. **Backward compat** — socket path change could break running instances. Need legacy fallback period.
4. **Window type `"test_pattern"`** — MUST NOT change. This is a protocol identifier used by IPC clients, multiplayer bridge, and tests. It refers to the test pattern *window type*, not the app.

## Open Questions

1. `wwdos` or `wibwob-dos` or `ww-dos` for the binary name?
2. Do all 5 phases in one PR or split into 2-3 PRs?
3. Should Phase 3 (class rename) use a typedef bridge for a release cycle?
4. The `test_pattern.h/cpp` files define the test pattern *view* — rename those to `test_pattern_view.h/cpp` for clarity, or leave as-is?

## References

- Current binary: `./build/app/test_pattern`
- CMake target: `app/CMakeLists.txt:30`
- Main class: `app/test_pattern_app.cpp:555`
- Socket default: `app/api_ipc.h:20`
- Window type (DO NOT RENAME): `app/window_type_registry.cpp:218`
