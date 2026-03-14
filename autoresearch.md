# Autoresearch — Solid Foundations

## Objective
Refactor the WibWob-DOS core TypeScript codebase (`src/`) for better organisation,
stronger types, faster boot, complete SDK, and single-responsibility functions.
Every change must pass `bun run typecheck` with no functional regressions.

## Primary Metric
**typecheck_s** — wall-clock seconds for `bun run typecheck` (lower is better).
This is a proxy for codebase health: smaller files with cleaner imports resolve
faster. Measured via `time bun run typecheck`.

## Secondary Metrics (tracked, not driving keep/discard)
- `max_file_lines` — line count of the largest .ts file in src/
- `any_count` — occurrences of `as any` in src/core/
- `sdk_gaps` — modules with direct src/core/ or src/services/ imports
  (bypassing microapp-sdk.ts)
- `file_count` — number of .ts files in src/ (expected to increase as god files split)

## Measurement Commands
```bash
# Primary metric
time bun run typecheck 2>&1

# Secondary metrics
wc -l src/core/*.ts src/services/*.ts src/windows/*.ts | sort -rn | head -1  # max_file_lines
grep -rn "as any" src/core/ | wc -l                                          # any_count
grep -rn "from.*\.\./\.\./src/" modules/ | grep -v microapp-sdk | wc -l      # sdk_gaps
find src -name "*.ts" | wc -l                                                 # file_count
```

## Priority Order
1. God file decomposition (biggest structural wins)
2. SDK completeness (biggest agent-experience wins)
3. Type hardening (biggest correctness wins)
4. Boot performance (lazy loading)
5. Design system components (fills gaps)
6. Function decomposition (ongoing discipline)

## Files in Scope
All files under `src/core/`, `src/services/`, `src/windows/`.
Module files (`modules/*/index.ts`) touched only to fix import paths.

## God Files (targets for splitting)
| File | Lines | Split target |
|------|-------|-------------|
| `src/core/ui-parts.ts` | 2395 | src/core/ui/ directory |
| `src/core/app-controller.ts` | 2244 | Extract window openers, theme, workspace, keybindings |
| `src/core/command-catalog.ts` | 1307 | Could split by domain |
| `src/core/overlay-manager.ts` | 937 | Extract each overlay type |
| `src/core/ui-parts-forms.ts` | 881 | Could merge with ui/ directory |
| `src/windows/browser-windows.ts` | 2082 | Split file manager / doc reader / md viewer |
| `src/windows/music-player-window.ts` | 1224 | Extract viz modes, audio analysis |
| `src/services/wibwob-agent-session.ts` | 1063 | Extract tool handlers |
| `src/services/chrome-browser-service.ts` | 1029 | Extract extractors |
| `src/services/control-api.ts` | 795 | Extract route handlers |

## What Has Been Tried
(Updated after each keep)

## Constraints
- Must pass `bun run typecheck`
- No functional regressions
- Backward compatible imports (re-export from old paths)
- One logical change per commit
