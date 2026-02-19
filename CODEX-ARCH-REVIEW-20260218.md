# Codex Architecture Review — 2026-02-18

**Raw log**: `codex-arch-review-20260218.log`
**Token cost**: ~93,000
**Model**: gpt-5.3-codex

## Scope

Top-level architecture, DRY, C++14/Turbo Vision practices, Python best practices, naming, documentation.

## Findings

| # | Severity | Area | Finding |
|---|----------|------|---------|
| 1 | High | Orchestrator | `ttyd` stdout/stderr piped but never drained → pipe buffer deadlock risk; bridge Popen handles not tracked/stopped |
| 2 | High | C++ IPC | Dual dispatch: `exec_command` (registry) AND giant if/else in `api_ipc.cpp:365` — parity drift risk |
| 3 | High | C++ | Window type identity split: `windowTypeName()` and `window_type_registry.cpp` are independent — silent desync risk |
| 4 | Medium | C++ | `registerWindow()` publishes `state_changed` → `api_get_state` (a read) can emit write-side effects |
| 5 | Medium | C++ | `ipcServer` raw `new`, no `TTestPatternApp` destructor → depends on process teardown not RAII |
| 6 | Medium | Python | Blocking `ipc_get_state`/`apply_delta_to_ipc` called inside async coroutines → stalls event loop on timeout |
| 7 | Medium | Python | `apply_delta_to_ipc` failures return `"FAIL ..."` but bridge never escalates or resyncs |
| 8 | Low | Docs | No versioned IPC protocol doc: framing, auth handshake, percent-encoding, command schema |
| 9 | Low | Naming | `app/ASCII_IMAGE_VIEWER.md`, `app/FRAME_PLAYER.md` are ALLCAPS — should be kebab-case |
| 10 | Low | DRY | Minor: no-arg spawn wrappers in `window_type_registry.cpp` are near-identical (candidates for template) |

## Overall Verdicts

**Documentation**: Strong high-level overview in CLAUDE.md. Biggest gap for new devs: no IPC protocol spec covering framing, auth, percent-encoding, command/event schemas, and the ID-remap behaviour in multiplayer sync.

**C++14/Turbo Vision**: Core TV conventions followed (growMode, ofTileable, draw/handleEvent/changeBounds throughout). Main concerns are lifecycle ownership (ipcServer raw new) and type identity duplication.

**Python**: Type hints decent. Main gaps: orchestrator process lifecycle, blocking IPC in async bridge.

**Single biggest architectural risk**: Stringly-typed IPC contract duplicated across `api_ipc.cpp`, `command_registry.cpp`, `window_type_registry.cpp`, `test_pattern_app.cpp`, and `state_diff.py`. Future breakage is most likely here, hardest to debug without a canonical protocol spec.

## Prioritised Action Items

### Short-term (high-value, low-effort)

1. **Fix orchestrator bridge lifecycle** (High) — redirect `ttyd` to `DEVNULL`, store bridge `Popen` in `RoomProcess`, terminate in `stop_room`/`stop_all`

2. **Write `docs/ipc-protocol.md`** (High/Low-effort) — document framing, auth handshake, percent-encoding rules, command table, event payloads, window type slugs

3. **Rename docs to kebab-case** (Low) — `app/ASCII_IMAGE_VIEWER.md` → `app/ascii-image-viewer.md` etc

### Medium-term

4. **`ensureWindowId()` vs `registerWindow()`** (Medium) — split to separate ID-assignment (no event) from first-time registration (eventful)

5. **`asyncio.to_thread()` for IPC calls in bridge** (Medium) — prevents event loop stalls on IPC timeouts

6. **Unify `windowTypeName()` with `window_type_registry`** (High) — add `type_slug` field to `WindowTypeSpec`, derive `windowTypeName` from registry lookup

### Long-term

7. **IPC dual-dispatch cleanup** — route all command-like ops through `exec_command`, keep only transport-level ops in `api_ipc.cpp`

8. **`std::unique_ptr<ApiIpcServer>`** — proper RAII ownership
