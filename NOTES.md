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

Vibe-first. Describe the feeling of the problem, not the exact technical issue. Paste one of these when something feels off but you can't name it precisely.

```
This codebase feels copy-pasty. Hunt for anything that appears to have been written twice — same logic, same shape, same idea — in more than one place. Every duplicate you find: give it one home, wire it up everywhere else, delete the copies. Typecheck clean. Commit. Tell me what you found.
```

```
Things feel bolted-on rather than composed. Read the architectural docs first to understand how the pieces are supposed to fit together, then find everywhere the code bypasses that structure — goes around the seams, hardcodes things that should be config, reimplements something that already exists. Fix each one to go through the right path. Typecheck clean. Commit.
```

```
The shared layer feels underused. Read whatever files define the shared primitives and utilities in this codebase, then look at the consumers. Find everywhere a consumer is doing work the shared layer could be doing for it. Extract upward, simplify downward. Typecheck clean. Commit.
```

```
The docs and the code feel out of sync. Get the ground truth from the live running system, then read the docs, scripts, and tests. Find everywhere they describe or assert something that no longer matches reality. Fix the lies. Commit.
```

```
Some things feel invisible to the outside world. Find every meaningful piece of state or behaviour in this app that a caller, agent, or test cannot observe or trigger through the external interface. Add what's missing. Commit.
```

```
Some functions feel like they've eaten too much. Find anything that's grown into a wall of code doing several different jobs. Name the jobs, pull them apart into focused pieces, make the original just coordinate them. Typecheck clean. Commit.
```

```
There are probably magic values scattered everywhere. Find hardcoded numbers, strings, and thresholds that appear more than once or clearly belong to a named idea. Give them names and a single home. Typecheck clean. Commit.
```

```
Some features probably got added without thinking about the rest of the codebase. Find anything that solves a problem in isolation when a more general solution would have served the whole system. Generalise it. Commit.
```

```
The tests and scripts probably make assumptions that are no longer true. Find every place a test or script asserts a specific value, field, or behaviour. Verify each assumption still holds against the live system. Fix what doesn't. Commit.
```

```
New modules probably reinvented things the older modules already solved. Read the oldest and most stable parts of the codebase to understand what patterns were established. Then read the newest parts. Find the gaps where new code ignored those patterns. Close them. Typecheck clean. Commit.
```

## DEV TERMS

**canary**
- a tiny, obvious test signal used to prove whether a system change actually propagated
- in this repo: usually a minimal microapp, text string, or state field whose only job is to make reload/smoke behaviour easy to detect

**smoke canary**
- a deliberately simple text or UI marker used in smoke tests so success/failure is visible in `/state`, screenshots, and `tmux capture-pane`
- value: avoids relying on subtle visual differences like colour alone

**runtime reload**
- unload and reload one module inside a running WibWob-DOS instance without restarting the whole app
- value: proves lifecycle ownership, cleanup, and reopen behaviour even if true source hot-reload is still being hardened

**hot reload**
- the stronger claim: edit code, reload the module, and see the new behaviour appear live in the running app without a full restart
- value: the ideal agentic workflow, but stricter than plain runtime reload and needs stronger proof

**brownfield proof**
- a validation step performed against an existing, non-trivial app surface already living in the codebase
- in this repo: Poetry Clock or Patchbay Lab are good brownfield reload proofs

**greenfield proof**
- a validation step performed against a tiny new surface created specifically to prove a seam in isolation
- in this repo: `runtime.reload-canary` is a greenfield reload proof

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
