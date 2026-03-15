# E042-B06 Next Frontier — Ideas

## From B01–B05 Audit (deferred items)

- scaffold-microapp.sh manifest format fix (B01 leftover)
- file-manager migration to microapp (B03 — 1622 lines, major effort)
- Hero app smoke tests via control API (B05 — needs running instance)
- Hyperfine boot time benchmarks (B05)
- Fix flaky integration tests: theme-cycle strict screenshot comparison (B05)
- platform-commands.ts, append-log.ts, audio-process.ts wrappers (B04 — deemed too specialized)

## Architecture (from TODO-b1ddb4ff audit)

- **Event bus**: No formal event system. State-service has subscribe/listener push model,
  but rest of app uses direct calls and blessed events. A typed CommandBus would clean up
  the dispatch path but current approach works. Not blocking anything.
- **Atomic writes**: safe-fs uses writeFileSync directly. Should be tmp+rename for crash
  safety. Small lift — add to safe-fs.ts.
- **Structured logging**: No logger. All console.error. A pino-style structured logger
  with [tag] prefix would help debugging. Medium effort.
- These are all separate-epic scale. Don't let them derail B06's god file focus.

## God Files (B06 active focus)

- `ui-parts.ts` (2379 lines) — decomposing now into chrome/scroll/panels/patterns
- `app-controller.ts` (2334 lines) — composition root, harder to split safely
- `file-manager-window.ts` (1623 lines) — single window, componentize UI
- `command-catalog.ts` (1219 lines) — data file, acceptable size for a catalog
- `music-player-window.ts` (1224 lines) — viz functions could extract
- `wibwob-agent-session.ts` (1065 lines) — agent session, could extract tool wiring

## DRY

- Duplicate patterns across microapps (common setup boilerplate)
- Config/constants scattered vs centralised
- Theme token usage consistency

## Documentation

- Stale references in .agents/ specs
- .planning/ status fields vs reality
- AGENTS.md accuracy (audit found all scripts present ✅)
- docs/ completeness — SDK docs match actual exports ✅
