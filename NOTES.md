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

Name the anti-pattern. Agent finds all instances itself. No prior knowledge of which files are affected.

**shadowed exports** — local definitions that duplicate something already exported
```
Find every type or function defined locally in modules-private/ that has an identical or structurally equivalent export somewhere in src/. Read src/core/ui-parts.ts and src/services/module-loader.ts to know what's available. For each local duplicate: import the canonical version, delete the local one, fix call sites. bun run typecheck clean. commit. report.
```

**copy-paste utilities** — same function body in multiple files
```
Find every function defined in 2 or more files with an identical or near-identical body. For each group: pick the best home, export it there, import it everywhere else, delete the copies. bun run typecheck clean. commit. report.
```

**inline what should be a helper** — repeated multi-line patterns with no shared name
```
Find every place 3 or more consecutive statements do the same conceptual thing across multiple files (e.g. setting top/left/width/height, building the same object shape, running the same validation). For each pattern with 2+ sites: extract a named helper, wire it up everywhere. bun run typecheck clean. commit. report.
```

**stale contracts** — scripts or docs referencing fields that may not exist
```
Get the live API shapes: curl http://127.0.0.1:8099/health and /state and /commands/list. Then grep scripts/, tests/, .agents/, and .pi/skills/ for field names and response shapes. For every reference to a field that isn't in the live response: fix it. bun run typecheck clean. commit. report.
```

**inlined patterns that should be primitives** — behaviour in consumers that belongs in the shared layer
```
Read AGENTS.md. Then read every file under modules-private/. For any logic that implements something the host should provide — layout, theming, state reading, command registration — check if it belongs in src/core/ or src/services/ instead. If the same logic appears in 2+ microapps: extract it to the right owner, expose via host.ui or host API, delete from consumers. bun run typecheck clean. commit. report.
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
