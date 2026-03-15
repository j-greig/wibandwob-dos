# E033 devlog — Blessed Architecture Calm

## What this epic did

Took the unblessed spike findings and turned them into concrete architecture
improvements without migrating away from Blessed. The headline: Blessed shell,
cleaner internal grammar.

## Stories completed

S01 Render scheduler — explicit invalidation seam separating render, sync,
and persist intent. Injected into WindowManager and EditorCoordinator.

S02 Monster Cam model — local model/update/render pilot. Explicit
MonsterCamModel, MonsterCamMsg, single render path.

S03 Microapp host cleanup — reduced direct src/core imports from modules,
migrated representative modules to SDK-only imports.

S04 Shell chrome extraction — moved wallpaper, status bar, and top chrome
from the 800-line app-controller into src/core/shell-chrome.ts.

S05 API contract audit — retired 4 legacy duplicate routes, added missing
endpoint descriptions, fixed /windows/batch field names to use canonical
left/top/width/height, aligned agent tool batch fields.

S07 Dense-scene benchmark — 12 windows open including 8+ animated surfaces,
measured 32fps at 28ms avg frame, 411MB RSS. Well under 200ms target.

S08 Runtime telemetry — --stats CLI flag shows shell-level badge, GET
/runtime/stats endpoint returns structured JSON. Terminal module fixed:
spawn-helper permissions, writeInput wiring through onInput. Recursive
nested WibWob-DOS instance verified.

S10 Developer docs — docs/building-custom-microapps.md covering manifest,
entry point, host API, lifecycle hooks, animation (timers + embedded live
player), direct commands, SDK imports, common mistakes, verification
checklist. Scaffold script fixed and tested end to end.

S11 Composable animated surfaces — createEmbeddedLivePlayer convenience
in animation-service, AnimatedSurfaceTarget type, touchlab-mvp migrated.

S12 ASCII composition scaffolding — ascii-composition.ts with
composeAsciiLayers and renderAsciiTextBlock, vocabulary doc.

S06 Unicode and S09 macOS launcher deferred as non-essential.

## Cross-cutting work

ESLint SDK boundary rule — flat config, one rule, no-restricted-imports
scoped to microapps/**. Zero violations after sweep.

Nomenclature sweep — renamed appTypes (farjs-file-manager to file-manager,
chrome-browser to web-reader), command IDs (underscores to hyphens), agent
tools (tui_open_chrome_browser to tui_open_web_reader). Fixed glitchbox
doubled command path and sy2-chronicles duplicate registration. Reorganised
SDK exports into labelled sections.

a2 branch merge — integrated all work from the parallel worktree. Resolved
10 merge conflicts, fixed 3 post-merge test failures, ported dream-forecast
module.

## Bug fixes along the way

- Terminal spawn-helper missing execute permission (node-pty prebuilds)
- Terminal writeInput not wired through microapp SDK onInput path
- Dream forecast renderRadar grid out-of-bounds crash
- Touchlab composite() undefined after S12 refactor
- Scaffold script backtick escaping in heredoc

## What we chose not to do

- Migrate away from Blessed (the whole point)
- Solve every Unicode rendering bug (S06 deferred)
- Build a macOS-style launcher (S09 deferred)
- Add a plugin registry or package manager
- Production profiling suite

## Evidence files

- scratch/evidence/e033-s07-dense-scene-benchmark.md
- scratch/evidence/e033-s08-a1b-runtime-smoke.md
- scratch/evidence/e033-nomenclature-review.md
