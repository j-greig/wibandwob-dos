# ZILLAS NOTES

## PROJECT LINGO
**content-aware apps**
- primers, text, figlet, animations, and later other content-aware apps should open from measured/recommended size instead of generic defaults
- value: stops random `72x20` window guesses, reduces clipping, makes opening content feel intentional and agent-friendly

**desktop geometry**
- canonical desktop size model for layout: width, height, usable app area, and cell aspect ratio
- value: gives one source of truth for placement and layout so windows, menus, resizing, and future arrangements stop fighting each other

**command surface**
- single set of user-visible commands projected into menus, palette, API, agent tools, and later MCP
- value: define once, expose everywhere; avoids repeating the same feature across UI, API, and agent layers

**core contracts**
- stable seams we try not to break during refactor: measurement, chrome sizing, desktop geometry, state, snapshots, commands, text rendering
- value: lets us simplify and move fast without reintroducing ambiguity or hidden duplicate systems

**shared geometry/layout primitives**
- reusable rules for tiling, cascading, snapping, centering, bounds clamping, and future gallery/exhibition arrangements
- value: layout becomes a reusable engine instead of one-off coordinate hacks sprinkled through the app

**terminal geometry**
- raw terminal dimensions in character cells, usually width x height, before any app-specific chrome or desktop layout rules
- value: keeps the difference clear between actual terminal space and the desktop/window space we derive from it

## PROMPTING

The template: name exactly what was just found, make it the seed pattern, sweep for more of the same. No preamble.

```
We just found [EXACT THING]. grep [CODEBASE SCOPE] for every other instance of the same pattern. Fix them the same way. bun run typecheck clean. commit. report what changed.
```

Examples from this session — paste verbatim:

**duplicate local types**
```
We just found Rect, UiPart, and StackChild redefined locally in modules-private/wibwobworld/index.ts despite being exported from src/core/ui-parts.ts. grep modules-private/*/index.ts for any other locally defined types that already exist as exports in src/core/ui-parts.ts or src/services/module-loader.ts. For each: add the import, delete the local definition. bun run typecheck clean. commit submodule, bump parent. report.
```

**duplicate utility functions**
```
We just found applyRect defined locally in modules-private/wibwobworld/index.ts and modules-private/wibwobworld-iso/index.ts despite being exported from src/core/ui-parts.ts. grep modules-private/ for any function body that duplicates something exported from src/core/ or src/services/. Import and delete. bun run typecheck clean. commit. report lines deleted.
```

**inline geometry that should use a helper**
```
We just found consecutive .top= .left= .width= .height= assignments in modules-private/world-chatroom/index.ts that should be applyRect() calls. grep -n "\.top = \|\.left = \|\.width = \|\.height = " modules-private/*/index.ts. For every 3+ consecutive hits on the same node: replace with applyRect(). bun run typecheck clean. commit. report.
```

**stale API field references in scripts and docs**
```
We just found scripts/smoke-test.sh asserting .status on the /health response — that field doesn't exist, the real field is .ok. curl http://127.0.0.1:8099/health and http://127.0.0.1:8099/state to get the actual live shapes. Then grep scripts/ tests/ .agents/ .pi/skills/ for any field name from those responses being referenced incorrectly. Fix scripts that parse wrong fields. Fix docs that show stale response shapes. commit. report.
```

## DEV TERMS

**smoke test**
- quick "does it launch and not crash" pass — open things, poke them, close them
- not about correctness, just about survival

**integration test**
- verify the seams between systems work — e.g. our contract tests hit the live control API and check responses
- proves the API talks to the state service talks to the window manager

**regression test**
- capture known-good state, compare after changes — text screenshots and workspace saves are regression baselines
- if something changes that shouldn't have, the diff tells you

**golden file test**
- save a known-good output (text screenshot, state JSON), fail if future output diverges
- the ANSI captures from /screenshot/text are golden file candidates

**fleet test**
- open every window kind, verify state contracts across all of them
- industry would call this a matrix test or compatibility matrix

**parity audit**
- verify every window kind has matching coverage across all surfaces: describeState, API, menus, workspace save/restore, context menus
- the "did we actually wire everything up" check

**regression capture**
- the fleet-test.sh flow: open all windows, cycle all themes, save PNG + ANSI + text + state JSON per theme
- produces the baselines that golden file tests compare against

**contract test**
- tests that verify a stable interface between two systems (e.g. API returns specific shape, state has required fields)
- ours run via bun test against the live control API

**viewport width (derived)**
- blessed may report combined multi-monitor width — derive real usable width from the rightmost window edge + 2
- NEVER use absolute column numbers for layout — use proportional fractions of derived viewport
