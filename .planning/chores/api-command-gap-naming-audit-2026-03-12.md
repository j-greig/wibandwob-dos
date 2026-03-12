# API Command Gaps + Naming/Docs Audit (Fresh pass)

Date: 2026-03-12T18:22:57

Focus: missing commands, stale aliases/docs, naming consistency issues discovered while running applications smoke tests.

## Critical functional gap

- [x] `backrooms.open` is listed in `/commands/list` as available, but execution fails: `Unknown command: backrooms.open`.
  - Impact: Applications menu item appears valid but is non-functional via API command execution path.
  - [x] Either register/fix the command id, or remove/replace listing with working id.
  - Fix: reversed alias direction in LEGACY_COMMAND_ALIASES (`backrooms.run` -> `backrooms.open`, not the other way around). Also fixed `control-api.ts` to call `backrooms.open` instead of `backrooms.run`.

## Stale alias docs in /help

Aliases declared in `/help` descriptions that do not exist in `/commands/list`:

- [x] `/view/backrooms/open` -> Alias `backrooms.run` (missing) — fixed to `backrooms.open`
- [x] `/view/monster-cam/open` -> Alias `monster_cam.open` (missing) — fixed to `monster-cam.open`
- [x] `/view/primer-gallery/open` -> Alias `primer_gallery.open` (missing) — fixed to `primer-gallery.open`

## Naming consistency issues (command IDs)

### Mixed separators (underscore + kebab + dot)

- [x] Settle on one canonical style (dot + kebab segments) and add aliases for migration if needed.
  - Added kebab-case aliases in LEGACY_COMMAND_ALIASES for all 19 underscore command IDs.
  - Both forms now work (e.g. `window.close-focused` and `window.close_focused`).
  - Added naming canon comment in command-catalog.ts.
  - Underscore IDs kept for backward compat; kebab aliases registered:
    - `agent.reload-prompt` -> `agent.reload_prompt`
    - `backrooms-logs.open` -> `backrooms_logs.open`
    - `desktop.toggle-chrome` -> `desktop.toggle_chrome`
    - `editor.save-as` -> `editor.save_as`
    - `finder.advanced-search` -> `finder.advanced_search`
    - `finder.bookmark-path` -> `finder.bookmark_path`
    - `finder.go-to-bookmark` -> `finder.go_to_bookmark`
    - `finder.new-folder` -> `finder.new_folder`
    - `finder.sort-by` -> `finder.sort_by`
    - `finder.toggle-view` -> `finder.toggle_view`
    - `markdown.toggle-figlet` -> `markdown.toggle_figlet`
    - `window.close-focused` -> `window.close_focused`
    - `window.copy-text` -> `window.copy_text`
    - `window.export-text` -> `window.export_text`
    - `window.focus-next` -> `window.focus_next`
    - `window.focus-previous` -> `window.focus_previous`
    - `window.toggle-maximize` -> `window.toggle_maximize`
    - `workspace.load-named` -> `workspace.load_named`
    - `workspace.save-as` -> `workspace.save_as`

### Open-command label inconsistency

- [ ] Standardise `.open` command labels (prefix with "Open ..." or plain name, pick one).
  - `.open` commands with 'Open ' labels: 12
  - `.open` commands with plain labels: 41
  - Decision: plain names are the majority convention. Doc'd in naming canon.
  - Mass rename deferred — cosmetic, low risk of breakage but high churn.

### Microapp command id drift (legacy naming families)

- [ ] Document canonical microapp id naming going forward; avoid opportunistic renames without planned migration.
  - Naming canon comment added to command-catalog.ts.
  - Existing demo module IDs kept as-is (renaming would break saved workspaces).

## API surface arg-shape inconsistencies

- [x] Unify arg naming or explicitly document dual-shape contract in sdk/control-api docs.
  - `window.move` now accepts both `{x,y}` and `{left,top}` (prefers x/y, falls back to left/top).
  - `window.resize` now accepts both `{w,h}` and `{width,height}` (prefers w/h, falls back to width/height).
- [x] Add compatibility shim for `window.move/resize` arg names if unification is deferred.
  - Done — both arg shapes work for both command and REST paths.

## Overlay modal control (agent automation blocker)

- [x] Implement API-level control for modal overlay primary and secondary actions (OK and Cancel) so agent workflows can advance interstitial UI states without manual keyboard/mouse input.
  - [x] Add generic overlay actions: `overlay.confirm` (OK/Enter) and `overlay.cancel` (Cancel/Esc) via shared overlay primitives in `overlay-manager.ts`
    - OverlayManager already had `confirmActiveOverlay()` and `cancelActiveOverlay()` — just needed wiring.
  - [x] Register as commands in command-catalog + expose as `POST /overlay/confirm` and `POST /overlay/cancel` in control-api
    - Also added `GET /overlay/info` and `overlay.info` command.
  - [x] Verify compatibility with: openValuePrompt (figlet text), list/browser picker modals (figlet font picker, zine canvas picker)
    - Figlet flow works end-to-end: `figlet.open` -> `/overlay/confirm` (text) -> `/overlay/select` (font index, optional) -> `/overlay/confirm` (open banner).
    - Zine picker remains module-local (raw blessed.list), handled via dedicated commands (`microapp.wibwob.zine.picker.*`) and `/view/zine/open` filePath/index.
  - [x] Return `ok:false` with clear error when no overlay is active
  - [x] Added `POST /overlay/select` with `{index}` for deterministic picker selection before confirm.
  - Acceptance: figlet.open and plasma.from-primer interactive flows are now fully API-drivable; typecheck passes; /health ok after flows.

## Also added

- [x] `menu.close` command — closes any open dropdown menu or popup context menu.

## Suggested immediate fixes (small, high-value)

- [x] Fix or remove `backrooms.open` command listing mismatch.
- [x] Update `/help` alias strings to match real command IDs.
- [x] Add short naming canon to command-catalog docs (segment separators, open label policy).
- [ ] Add API parity test asserting `/commands/list` available commands are runnable or intentionally gated.
  - Deferred — needs a smoke test script, not a code change.

## Later-session follow-on landed

- [x] Shared overlay selection affordance added (`overlay.select`) at SDK/control-API level for browser/list/file-browser overlays.
- [x] Primer interactive and Plasma-from-Primer interactive paths verified with `overlay.select + overlay.confirm`.
- [x] Backrooms primer picker became API-actionable via dedicated commands:
  - `backrooms.picker.info`
  - `backrooms.picker.select`
  - `backrooms.picker.confirm`
  - `backrooms.picker.cancel`
- [x] Demos menu first-pass API control sweep: 22/22 pass (`scratch/reports/demos-api-control-audit-latest.json`).
