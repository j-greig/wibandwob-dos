# PRD: E055 — TUI AppleScript Control

## 1. Introduction / Overview

Agents currently drive the WibWob-DOS TUI by screenshotting, parsing text to find coordinates, and sending AppleScript mouse clicks. This is fragile — positions shift with screen size, window layout, and content. This epic fixes it at the source.

**Phase 1 (this epic):** Make the runtime tell agents where things are (coords in `describeState()`). This is the quick win — no microapp changes, delivers value immediately.

**Phase 2 (architectural follow-on):** Make things addressable by name so position doesn't matter at all (`registerAction`, `window.action`). Depends on Phase 1 proving the pattern.

Self-verification: every story is testable via `bash autoresearch.sh`. Target: **15/15 stable**.

---

## 2. Goals

- `wibwob state` exposes clickable element positions for every open window
- Agents click buttons/tabs/controls by reading state, not by parsing screenshots
- `wibwob window <id> click --label "Font"` works end-to-end without coordinates
- `menu.close` command exists and is reliable from CLI/API
- `wait-for.sh` eliminates all `sleep` calls from scripts (observe-and-proceed)
- Autoresearch benchmark reaches 15/15 stable (3 consecutive runs)

---

## 3. User Stories

### US-001: Clickable positions in window state
**Description:** As an agent, I want `wibwob state` to tell me where every button and tab is, so I can click by label without parsing the screenshot.

**Acceptance Criteria:**
- [ ] `WindowFacade.registerClickable(node, label)` method exists in `window-facade.ts`
- [ ] Method reads `node.atop`, `node.aleft`, `node.width` relative to the window body
- [ ] Positions recalculate on window resize
- [ ] `describeState()` on any window with registered clickables includes `clickables: [{ label, row, col, width }]`
- [ ] `wibwob state` shows clickable positions for a window that registers them
- [ ] TypeScript compiles with `bunx tsc --noEmit`

### US-002: SDK composition helpers auto-register clickables
**Description:** As a microapp author, I want createButtonBar and createTabs to auto-register their buttons/tabs so agents can click them without any extra code from me.

**Acceptance Criteria:**
- [ ] `createButtonBar` calls `registerClickable` for each button at creation time
- [ ] `createTabs` calls `registerClickable` for each tab at creation time
- [ ] No changes required in any existing microapp
- [ ] Open figlet banner → `wibwob state` shows `[V] All`, `[S] Favs`, `[F] Font`, `[E] Edit` with row/col positions
- [ ] Open primer gallery → `wibwob state` shows tab positions (`1 A-E`, `2 F-J`, etc.)
- [ ] TypeScript compiles

### US-003: `wibwob window <id> click --label` CLI command
**Description:** As an agent, I want to click a named button in a window via the CLI without knowing its pixel coordinates.

**Acceptance Criteria:**
- [ ] `window.click` command registered in `command-catalog.ts` with `api: true, agent: true`
- [ ] Args: `{ id: number, label: string }`
- [ ] Handler looks up `label` in the window's `clickables`, converts row/col to pixel coords via calibration, fires a mouse click via the AppleScript side or blessed programmatic click
- [ ] `POST /windows/click { id: 1, label: "[F] Font" }` opens the font picker in figlet
- [ ] `wibwob window 1 click --label "[F] Font"` (CLI form) works
- [ ] Returns `{ ok: false, error: "label not found", available: [...] }` when label not registered
- [ ] TypeScript compiles

### US-004: Overlay button positions in `/overlay/info`
**Description:** As an agent, I want `/overlay/info` to tell me where the OK and Cancel buttons are so I can click them precisely if needed (even though API confirm/cancel already exists).

**Acceptance Criteria:**
- [ ] `ActiveOverlay` interface gains optional `buttons: [{ label, row, col }]`
- [ ] `openValuePrompt` registers OK and Cancel button positions via `createButtonBar`
- [ ] `getActiveOverlayInfo()` includes `buttons` when positions are known
- [ ] Open figlet text prompt → `curl /overlay/info` shows `buttons: [{ label: "OK", row: N, col: M }, { label: "Cancel", ... }]`
- [ ] TypeScript compiles

### US-005: `menu.close` API/CLI command
**Description:** As an agent, I want to close an open menu reliably via API — not by clicking an empty area or pressing escape.

**Acceptance Criteria:**
- [ ] `menu.close` registered in command-catalog with `api: true, agent: true`
- [ ] Handler calls `this.menuUi.closeMenus()` (already exists internally)
- [ ] `wibwob cmd menu.close` closes an open menu
- [ ] `POST /commands/run { id: "menu.close" }` closes an open menu
- [ ] If no menu is open, returns `{ ok: true }` silently (idempotent)
- [ ] TypeScript compiles

### US-006: `/menu/list` includes open state and highlighted item
**Description:** As an agent, I want to know from the API whether a menu is currently open and which item is highlighted, so I can verify menu interaction without screenshot parsing.

**Acceptance Criteria:**
- [ ] `GET /menu/list` response includes top-level `{ openMenu: string | null }`
- [ ] When File menu is open: `openMenu: "File"`
- [ ] When no menu open: `openMenu: null`
- [ ] TypeScript compiles

### US-007: `menu-click.sh` uses `menu.close` + `wait-for.sh`
**Description:** As an agent using ghostty-control scripts, I want menu-click.sh to close any stale open menu before opening a new one, and wait reliably for results.

**Acceptance Criteria:**
- [ ] `menu-click.sh` calls `wibwob cmd menu.close` at the start (before clicking)
- [ ] After opening a menu, uses `wait-for.sh text` instead of `sleep 0.5`
- [ ] After clicking a menu item, uses `wait-for.sh no-overlay` or `wait-for.sh window` instead of bare sleep
- [ ] `autoresearch.sh` menu tests pass consistently

### US-008: Fix `wait-for.sh` arg parsing
**Description:** As a script author, I want `wait-for.sh overlay --timeout 2` to correctly time out at 2s (currently it ignores the flag when condition has no ARG).

**Acceptance Criteria:**
- [ ] All `--flags` parsed before positional args regardless of order
- [ ] `bash wait-for.sh overlay --timeout 2` times out in ~2s (not 10s)
- [ ] `bash wait-for.sh health --timeout 5` returns immediately when wibwob is running
- [ ] `bash wait-for.sh no-health --timeout 3` times out in ~3s when instance is running
- [ ] `@desc` line updated to reflect fixed usage

### US-009: Integrate `wait-for.sh` into `autoresearch.sh`
**Description:** As a benchmark runner, I want autoresearch.sh to have zero bare `sleep` calls — all timing replaced with observable conditions.

**Acceptance Criteria:**
- [ ] `grep 'sleep' autoresearch.sh` returns zero matches (except comments)
- [ ] Each replaced sleep uses the most specific `wait-for.sh` condition (not just `wait-for.sh health` as a catch-all)
- [ ] Benchmark runtime is ≤ baseline (no regressions from removed sleep optimism)
- [ ] `autoresearch.sh` scores 15/15 stable on 3 consecutive runs

### US-010: Integrate `wait-for.sh` into other scripts
**Description:** As a script user, I want `send-to-terminal.sh` to optionally block until the app is healthy, so I don't need to manually sleep after calling it.

**Acceptance Criteria:**
- [ ] `send-to-terminal.sh` gains optional `--wait` flag
- [ ] With `--wait`: polls `wibwob health` until healthy or 15s timeout
- [ ] Without `--wait`: existing fire-and-forget behaviour unchanged
- [ ] `bash send-to-terminal.sh wibandwob-dos "bun run dev" --wait` returns only when healthy
- [ ] `@desc` updated

### US-011: Fix benchmark test isolation (Test 13 — multi-app)
**Description:** As a benchmark runner, I want Test 13 (open second app while first exists) to pass reliably by ensuring it sets up its own state rather than depending on earlier tests.

**Acceptance Criteria:**
- [ ] Test 13 in `autoresearch.sh` opens a first app itself before trying to open a second
- [ ] Does not depend on windows created by earlier tests (which are destroyed by quit/restart in lifecycle tests)
- [ ] Test 13 passes on 3 consecutive runs
- [ ] Overall benchmark 15/15

### US-012: `click-text.sh --window-id N` scoped search
**Description:** As an agent, I want to search for text within a specific window so I don't get false matches from other windows' content.

**Acceptance Criteria:**
- [ ] `click-text.sh` accepts `--window-id N`
- [ ] With `--window-id`: uses `wibwob screenshot N` (single window text)
- [ ] Without `--window-id`: existing full-desktop screenshot behaviour
- [ ] `bash click-text.sh "OK" --window-id 2` only matches text in window 2
- [ ] `@desc` updated

### US-013: Error messages with actionable hints
**Description:** As an agent hitting a script failure, I want error messages that tell me what to check and what's available, not just "not found".

**Acceptance Criteria:**
- [ ] `calibrate.sh` failure prints: "is Ghostty running? is WibWob-DOS started? run: wibwob health"
- [ ] `menu-click.sh` "item not found" prints available items from `/menu/list`
- [ ] `click-text.sh` "text not found" prints the first 5 lines of the screenshot for context
- [ ] `menu-click.sh` "menu not found" prints available menu labels
- [ ] Each error path exits non-zero

### US-014: `menu.activate` — trigger menu item directly
**Description:** As an agent, I want to trigger a menu item by its command ID without going through the UI mouse click path — with an optional `--visual` flag to also exercise the visual menu rendering.

**Acceptance Criteria:**
- [ ] `menu.activate` command registered in command-catalog. Args: `{ item: string }`
- [ ] Default (no flag): calls the command directly via `runCommand(item)` — no visual menu
- [ ] `--visual` flag (API: `{ item, visual: true }`): opens the menu, highlights the item, then triggers
- [ ] `POST /commands/run { id: "menu.activate", args: { item: "microapp.wibwob.figlet.open" } }` opens figlet
- [ ] Returns `{ ok: false, error: "unknown item" }` for unrecognised command IDs
- [ ] TypeScript compiles

---

## 4. Functional Requirements

- **FR-1:** `WindowFacade.registerClickable(node, label)` is the single registration point for all clickable elements.
- **FR-2:** Clickable positions are relative to the window body (row 0 = first row of body content), not the screen.
- **FR-3:** SDK composition helpers (`createButtonBar`, `createTabs`) auto-register with no microapp changes required.
- **FR-4:** `window.click` handler fires a programmatic blessed `emit("click")` on the found node, not an AppleScript mouse event — so it works headlessly.
- **FR-5:** `menu.close` is idempotent — safe to call when no menu is open.
- **FR-6:** `wait-for.sh` polls at 250ms intervals, default timeout 10s.
- **FR-7:** All scripts remain zero-python (jq + awk + bash only).
- **FR-8:** No hardcoded ports or instance IDs in any script.

---

## 5. Non-Goals (Out of Scope)

- F02 named actions / `registerAction` — architectural follow-on, not this epic
- Right-click / context menus
- Keyboard navigation testing (only mouse/click path)
- Windows or Linux support (macOS + Ghostty only)
- Remote/headless operation (requires local Ghostty window)
- Changing how existing blessed mouse events work at the library level

---

## 6. Technical Considerations

- `WindowFacade` lives in `src/core/window-facade.ts` — add `registerClickable` here
- `describeState()` is called by `state-service.ts` which aggregates — extend the return type
- `createButtonBar` is in `src/core/modal.ts` or `src/ui/` — needs to accept a `WindowFacade` reference to call `registerClickable`
- Blessed node positions (`atop`, `aleft`) are dynamic — only valid after screen render. Read them lazily (in `describeState()`) not eagerly (at registration time)
- `window.click` translating row/col to pixel coords requires calibration data — call `calibrate.sh` or have the API return coords that the shell script converts
- Alternatively: `window.click` fires blessed programmatic click (`node.emit("click")`) which is headless and doesn't need pixel coords at all

---

## 7. Success Metrics

- `autoresearch.sh` scores **15/15 on 3 consecutive runs**
- `grep 'sleep' autoresearch.sh` returns **zero matches**
- `wibwob state` shows `clickables` for figlet banner with correct positions
- `wibwob window 1 click --label "[F] Font"` opens the font picker headlessly
- All `autoresearch.checks.sh` checks pass (no python, no hardcoded ports, @desc on all scripts)

---

## 8. Open Questions

- Does `window.click` fire a blessed programmatic click (headless) or an AppleScript mouse event (requires Ghostty)? Programmatic is more COAT-aligned but may miss some blessed mouse event paths.
- Should `clickables` in `describeState()` include the window-relative pixel coords (row × cell_h) or just cell row/col? Cell coords are cleaner; pixel coords are useful for raw AppleScript.
- Does `createButtonBar` currently have access to the host/window reference needed to call `registerClickable`? May need to thread it through.
