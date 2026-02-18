# WibWob-DOS: Codex Retro & Agent Guide

## TL;DR (max 200 words)
WibWob-DOS is a C++14 Turbo Vision symbient OS with Python as integration/control plane, where C++ is authoritative runtime state and multiplayer (E008) mirrors semantic window state (`add/remove/update`) across instances. The E008 hardening campaign (Rounds 2-8) fixed real failure modes: missing auth handshake, SIGPIPE/partial-write event push failures, async race conditions, reconnect deadlocks, delta-apply bugs, and file-backed window parity gaps. The three most important Codex prompting rules here are: always include prior round summaries (Codex has no memory), require file:line + root-cause + fix + test outputs, and scope reviews to contract/parity/async risks rather than style. The three most important architectural truths are: (1) C++ owns truth and Python must mirror it, never invent it; (2) unified registries are mandatory to prevent parity drift (commands already unified, window types were hardened toward same model); (3) blocking work in async paths and write-side side effects during read flows create systemic instability. If you remember only one thing: this codebase fails at boundaries (IPC, async/task lifecycle, registry parity), so every change should be treated as a contract change and tested at that boundary.

## Part A: How to Prompt Codex Better on This Codebase

### A1: What worked well in the review prompts
The strongest prompt pattern was iterative verification against prior fixes, not greenfield critique.

Effective patterns that repeatedly produced actionable findings:
- Devnote continuity across rounds: `"Always include a devnote preamble... lists the last 5-10 CODEX-ANALYSIS..."` (`CLAUDE.md:202`).
- Tight verification scope per round, e.g. Round 5 explicitly constrained review to `api_get_state`, `windowTypeName`, delta apply, and chat relay (`CODEX-ANALYSIS-ROUND5-REVIEW.md:8`).
- Findings formatted by severity table + concrete fix sections (`CODEX-ANALYSIS-ROUND3-REVIEW.md:12`, `CODEX-ANALYSIS-ROUND3-REVIEW.md:23`).
- Root cause -> fix -> test sequencing (best in R5/R6/R7), e.g. reconnect deadlock diagnosis with `asyncio.gather()` and a specific `FIRST_COMPLETED` remediation plus test (`CODEX-ANALYSIS-ROUND6-REVIEW.md:39`, `CODEX-ANALYSIS-ROUND6-REVIEW.md:44`, `CODEX-ANALYSIS-ROUND6-REVIEW.md:49`).
- Explicit protocol-level checks (auth framing, width/height key names, percent encoding) caught high-impact boundary bugs (`CODEX-ANALYSIS-ROUND3-REVIEW.md:16`, `CODEX-ANALYSIS-ROUND3-REVIEW.md:17`, `CODEX-ANALYSIS-ROUND3-REVIEW.md:43`).

### A2: What was missing or weak in review prompts
Recurring prompt weaknesses:
- Insufficient environment constraints: Round 4 stalled on missing `pytest` in sandbox (`CODEX-ANALYSIS-ROUND4-REVIEW.md:4`, `CODEX-ANALYSIS-ROUND4-REVIEW.md:9`). Prompts should require “if tests cannot run, do static verification and list exactly what could not be executed.”
- Under-specified contract map: several issues were key-name or route mismatches (`w/h` vs `width/height`, direct `chat_receive` vs `exec_command`) that happen when prompts do not require explicit producer/consumer contract cross-checks (`CODEX-ANALYSIS-ROUND3-REVIEW.md:17`, `CODEX-ANALYSIS-ROUND3-REVIEW.md:19`).
- Missing side-effect audit in read paths: architecture review caught `registerWindow()` side effects triggered by `api_get_state` (`CODEX-ARCH-REVIEW-20260218.md:18`) only after broad architecture sweep.
- Missing async lifecycle checklist: reconnect and writer cleanup defects were found in later rounds, implying earlier prompts did not force task cancellation/closure audit (`CODEX-ANALYSIS-ROUND6-REVIEW.md:15`, `CODEX-ANALYSIS-ROUND7-REVIEW.md:16`).

What should always be in the prompt:
- Contract matrix check (command names, key names, framing/auth order).
- Async lifecycle check (task completion semantics, cancellation, cleanup).
- Read/write side-effect check.
- File-backed window parity check (`get_state` props required for remote create).
- Test delta requirement (new/updated tests per finding).

### A3: The optimal Codex prompt template for this repo
Use this template verbatim and fill placeholders.

```text
You are doing a verification-focused architecture/code review for WibWob-DOS.

DEVNOTE CONTEXT (required)
- Read first:
  - CODEX-ANALYSIS-ROUND8-REVIEW.md
  - CODEX-ANALYSIS-ROUND7-REVIEW.md
  - CODEX-ANALYSIS-ROUND6-REVIEW.md
  - CODEX-ANALYSIS-ROUND5-REVIEW.md
  - CODEX-ANALYSIS-ROUND4-REVIEW.md
  - CODEX-ANALYSIS-ROUND3-REVIEW.md
  - CODEX-ANALYSIS-ROUND2-REVIEW.md
  - CODEX-ANALYSIS-ARCHITECTURE-REVIEW.md
  - CODEX-ARCH-REVIEW-20260218.md

REQUIRED FILE POINTERS (read before findings)
- CLAUDE.md
- docs/master-philosophy.md
- app/api_ipc.cpp
- app/test_pattern_app.cpp
- app/window_type_registry.cpp
- app/command_registry.cpp
- tools/room/partykit_bridge.py
- tools/room/state_diff.py
- tests/room/*

SCOPE
- Prioritize: correctness, safety, parity drift, async/event-loop integrity, IPC contract consistency.
- Deprioritize: style-only comments, naming nits unless they cause defects.
- Explicitly verify producer/consumer pairs for every changed command or field.

OUTPUT FORMAT (mandatory)
1. Findings table sorted by severity: Critical/High/Medium/Low.
2. Each finding must include:
   - file:line
   - concrete failure mode
   - root cause
   - specific fix
   - test proposal (or test update) with target test file.
3. “Confirmed safe/correct” section listing what was checked.
4. “Not verified” section for anything blocked by environment.

If no Critical/High issues: say so explicitly.
```

Example invocation command:

```bash
cat > /tmp/codex-review-prompt.txt <<'PROMPT'
<PASTE TEMPLATE WITH CURRENT ROUND SCOPE>
PROMPT
codex exec -C /Users/james/Repos/wibandwob-dos "$(cat /tmp/codex-review-prompt.txt)" \
  2>&1 | tee /Users/james/Repos/wibandwob-dos/codex-review-roundN-$(date +%Y%m%d-%H%M%S).log
```

### A4: Context-setting tips specific to WibWob-DOS
- TUI event loop model: this is Turbo Vision; blocking calls in event-driven paths or async bridge paths stall responsiveness and reconnect logic. Treat blocking IPC in async coroutines as a defect class (`CODEX-ARCH-REVIEW-20260218.md:20`).
- IPC contract authority: C++ is the authority; Python mirrors state and applies commands. Contract drift breaks quickly because transport is stringly typed (`CODEX-ARCH-REVIEW-20260218.md:34`).
- Unified command registry and parity drift: commands should flow through `exec_command` registry path; dual dispatch in `api_ipc.cpp` is a known risk (`CODEX-ARCH-REVIEW-20260218.md:16`).
- Turbo Vision view lifecycle: raw pointer usage and registration lifecycles can produce stale pointer/id behavior; stale-map and id-remap bugs were real failure modes in E008 (`CODEX-ANALYSIS-ROUND2-REVIEW.md:19`).
- Multiplayer sync model: sync semantic state diffs, not terminal buffers; this is explicitly the E008 scope (`docs/master-philosophy.md:56`, `CODEX-ANALYSIS-ARCHITECTURE-REVIEW.md:165`).

## Part B: Architecture & Code Quality Lessons

### B1: Recurring bug patterns across all rounds
Pointer safety / lifecycle coupling:
- Why it recurs: Turbo Vision raw pointers + window registration lifecycle + manual identity wiring.
- Evidence: id map reset/remap bug and type identity split risk (`CODEX-ANALYSIS-ROUND2-REVIEW.md:19`, `CODEX-ARCH-REVIEW-20260218.md:17`).
- Systemic fix: registry-derived identity everywhere + explicit stale-pointer/id-map purge rules + ownership cleanup (RAII for IPC server).

Async correctness:
- Why it recurs: mixed blocking IPC and multi-task async loops with implicit lifecycle assumptions.
- Evidence: auth sequencing race, lock gaps, reconnect deadlock, writer cleanup leaks (`CODEX-ANALYSIS-ROUND3-REVIEW.md:16`, `CODEX-ANALYSIS-ROUND3-REVIEW.md:18`, `CODEX-ANALYSIS-ROUND6-REVIEW.md:15`, `CODEX-ANALYSIS-ROUND7-REVIEW.md:16`).
- Systemic fix: lifecycle checklist per coroutine (auth -> subscribe -> read loop -> finally close), `FIRST_COMPLETED` supervision, cancellation-safe exception handling.

IPC contract drift:
- Why it recurs: string key/value protocol duplicated across C++ and Python.
- Evidence: `w/h` vs `width/height`, route mismatch for chat command, percent-encoding breakage (`CODEX-ANALYSIS-ROUND3-REVIEW.md:17`, `CODEX-ANALYSIS-ROUND3-REVIEW.md:19`, `CODEX-ANALYSIS-ROUND2-REVIEW.md:21`).
- Systemic fix: protocol spec + contract tests + eventually dual-stack JSON protocol.

Event side-effects:
- Why it recurs: registration and state emission are tightly coupled; reads can trigger writes/events.
- Evidence: `registerWindow()` side-effect risk during `api_get_state` (`CODEX-ARCH-REVIEW-20260218.md:18`).
- Systemic fix: split pure identity assignment from eventful registration.

Key/format mismatches:
- Why it recurs: no canonical schema enforcement across all entry points.
- Evidence: path omissions for file-backed windows, partial update defaults causing spurious moves (`CODEX-ANALYSIS-ROUND5-REVIEW.md:18`, `CODEX-ANALYSIS-ROUND7-REVIEW.md:15`).
- Systemic fix: schema-level state snapshots and strict delta application guards.

### B2: Strongest architectural improvements made
Highest leverage fixes from R2-R8 and architecture work:
- `WindowTypeRegistry` migration removed “add type in 3+ places” fragility and improved type dispatch correctness (`CODEX-ANALYSIS-ARCHITECTURE-REVIEW.md:27`, `CODEX-ANALYSIS-ROUND4-REVIEW.md:19`).
- Event push hardening (SIGPIPE protection + partial write handling + EINTR handling) prevented silent event loss and process-kill risks (`CODEX-ANALYSIS-ROUND2-REVIEW.md:17`, `CODEX-ANALYSIS-ROUND2-REVIEW.md:18`, `CODEX-ANALYSIS-ROUND3-REVIEW.md:20`).
- Full auth handshake on both sync and async paths removed subscription black holes (`CODEX-ANALYSIS-ROUND3-REVIEW.md:16`, `CODEX-ANALYSIS-ROUND4-REVIEW.md:41`).
- `FIRST_COMPLETED` task supervision fixed reconnect deadlocks and made shutdown/reconnect behavior deterministic enough for production operation (`CODEX-ANALYSIS-ROUND6-REVIEW.md:44`, `CODEX-ANALYSIS-ROUND8-REVIEW.md:23`).
- Delta-apply correctness fixes (no defaulted move/resize, path propagation for file-backed windows) eliminated classes of state divergence (`CODEX-ANALYSIS-ROUND7-REVIEW.md:30`, `CODEX-ANALYSIS-ROUND5-REVIEW.md:25`).

Inference note: The requested “emit_event param”, “stale pointer purge”, and “success response check” items are referenced in task framing; only adjacent behaviors are explicitly documented in the provided round summaries. Treat them as part of the same hardening pattern: explicit event semantics, stale-state cleanup, and strict failure escalation.

### B3: Remaining architectural risks
High severity backlog:
- Orchestrator process lifecycle risk: `ttyd` pipe deadlock and untracked bridge subprocess lifecycle (`CODEX-ARCH-REVIEW-20260218.md:15`).
- IPC dual-dispatch/parity drift remains architecturally unresolved (`CODEX-ARCH-REVIEW-20260218.md:16`, `CODEX-ARCH-REVIEW-20260218.md:56`).
- Window type identity still has residual split risk unless fully unified (`CODEX-ARCH-REVIEW-20260218.md:17`, `CODEX-ARCH-REVIEW-20260218.md:52`).

Medium severity backlog:
- Read path side effects (`registerWindow` behavior) should be split into pure/eventful operations (`CODEX-ARCH-REVIEW-20260218.md:18`, `CODEX-ARCH-REVIEW-20260218.md:48`).
- Blocking IPC calls inside async code should move to thread offload (`CODEX-ARCH-REVIEW-20260218.md:20`, `CODEX-ARCH-REVIEW-20260218.md:50`).
- Delta apply failure handling should escalate/resync, not silently continue (`CODEX-ARCH-REVIEW-20260218.md:21`).

Low severity backlog:
- No canonical IPC protocol doc (`CODEX-ARCH-REVIEW-20260218.md:22`).
- Naming cleanup for ALLCAPS docs (`CODEX-ARCH-REVIEW-20260218.md:23`).
- `_rect()` double-nested edge case remains low-risk (`CODEX-ANALYSIS-ROUND8-REVIEW.md:17`).

### B4: CLAUDE.md review + suggested improvements
What is strong:
- Good high-level architecture and workflow guidance.
- Strong Codex multi-round review loop instructions (`CLAUDE.md:192`).

What is missing/outdated and should be edited:

1) IPC format language is misleading.
- Existing (`CLAUDE.md:83`): `"JSON command/response protocol"`.
- Problem: current transport is legacy key/value with JSON event payloads and selective JSON framing; calling it simply JSON misleads reviewers.
- Proposed replacement:
  - `Unix socket listener, line-framed IPC transport (legacy cmd:key=value plus JSON auth/event envelopes). See docs/ipc-protocol.md for canonical schema/framing.`

2) Verification section under-specifies the active test surface.
- Existing (`CLAUDE.md:43`): `"No C++ unit test framework is configured..."`.
- Problem: true but incomplete; major regression coverage is now in `tests/room/` and should be called out.
- Proposed addition after line 43:
  - `Primary automated regression coverage for multiplayer/IPC lives in tests/room (Python). Run that suite for boundary/contract changes.`

3) Missing explicit async safety rules.
- Add new section after architecture:
  - `Async Safety Rules: never call blocking IPC directly inside async coroutines; use thread offload/timeouts; ensure task groups have explicit completion policy (FIRST_COMPLETED vs gather); always close StreamWriter in finally.`

4) Missing explicit IPC contract checklist.
- Add new section:
  - `IPC Change Checklist: producer/consumer key parity, auth ordering, framing, percent-encoding, command route parity (exec_command vs transport commands), and test updates.`

5) Codex loop should require explicit “not verified” reporting.
- Existing loop is strong, but add in `CLAUDE.md:215` section:
  - `Every round summary must include Not Verified items when tooling/env blocks execution.`

Recommendation on `docs/ipc-protocol.md`: create it.
- Priority: high (despite low severity label in one review) because it addresses the biggest systemic breakage vector (`CODEX-ARCH-REVIEW-20260218.md:34`).
- Required contents:
  - Transport framing (newline-delimited messages).
  - Auth handshake (challenge/auth/auth_ok) for sync and async paths.
  - Encoding rules (percent-encoding/decoding for legacy kv).
  - Command table: command name, required args, source of truth, side effects.
  - Event schema: event names, payload shape, sequence semantics.
  - Error semantics: what constitutes failure and required retry/resync behavior.
  - Versioning/capability negotiation plan for JSON dual-stack.

### B5: docs/master-philosophy.md review
What it gets right:
- Correct authority model (C++ authoritative, Python mirror) (`docs/master-philosophy.md:16`, `docs/master-philosophy.md:34`).
- Correct multiplayer framing (“state diffs, not terminal buffers”) (`docs/master-philosophy.md:56`, `docs/master-philosophy.md:59`).
- Strong parity and traceability ethos (`docs/master-philosophy.md:46`, `docs/master-philosophy.md:68`).

What should be strengthened based on 8 rounds:
- Add explicit async lifecycle invariants (task supervision, cancellation propagation, writer cleanup) because this caused real defects in R6-R8.
- Add explicit IPC contract invariants (auth order, key names, encoding) because drift was the main bug source.
- Add explicit “read operations must be side-effect free unless documented” to prevent `get_state`-triggered event hazards.
- Add explicit failure-escalation policy for bridge apply failures (resync/backoff/alert), not silent `FAIL` strings.

## Part C: Quick-Start Checklist for Future Agents

1. **Read first**: `CLAUDE.md`, `docs/master-philosophy.md`, `docs/CODEX-RETRO-20260218.md`
   (the retro supersedes individual round summaries — read it first, then any `CODEX-ANALYSIS-ROUND*` files dated after the retro).
   Then read the active `.planning` epic brief for your issue.

2. **Orient** (run before touching any code):
   ```bash
   git status --short
   uv run --with pytest pytest tests/room/ -q   # baseline — note pass count before you change anything
   cmake . -B ./build && cmake --build ./build   # confirm build is green
   rg -n "exec_command|windowTypeName|findWindowById|publish_event|ipc_send|apply_delta_to_ipc" app tools tests
   ```
   Always start the TUI with debug logging so crashes produce evidence:
   ```bash
   ./build/app/test_pattern 2> /tmp/wibwob_debug.log
   ```

3. **Before writing C++**:
   - Check whether the change touches registry parity (`command_registry`, `window_type_registry`).
   - Check IPC command path for duplicate dispatch or key drift (`exec_command` vs transport-level handlers in `api_ipc.cpp`).
   - Check event side-effects: read operations must not emit events (see `registerWindow(emit_event=false)` pattern).
   - Check ownership/lifecycle: any `TWindow*` stored in `idToWin`/`winToId` can go stale. Always verify liveness before dereferencing — see `findWindowById` purge pattern.

4. **Before writing Python**:
   - Treat C++ state as authority; Python only mirrors/applies, never invents fields.
   - Never call blocking IPC (`ipc_send`, `ipc_get_state`) directly inside async coroutines — stalls event loop on timeout.
   - Validate auth/framing/encoding contract with C++ parser (key names, percent-encoding, `{"success":true}` vs `"ok"` response format).
   - Ensure task lifecycle: use `asyncio.wait(FIRST_COMPLETED)` for multi-task supervision; always close `StreamWriter` in `finally`.

5. **Before committing**:
   - Run `tests/room/` — compare pass count to baseline from step 2.
   - Ensure AC → Test traceability in planning brief.
   - Confirm issue lifecycle updates and evidence notes are posted.
   - Commit format: `type(scope): imperative summary` (no emoji).

6. **Codex review invocation checklist**:
   - Include devnote preamble listing `docs/CODEX-RETRO-20260218.md` + any newer `CODEX-ANALYSIS-ROUND*` files.
   - Include file pointers: `app/api_ipc.cpp`, `app/test_pattern_app.cpp`, `app/window_type_registry.cpp`, `tools/room/partykit_bridge.py`, `tools/room/state_diff.py`, `tests/room/`.
   - Require output: severity + `file:line` + root cause + fix + test proposal + **not-verified section** (this last item was missing from early rounds).
   - Save raw log, write `CODEX-ANALYSIS-ROUNDn-REVIEW.md` before next implementation slice.
