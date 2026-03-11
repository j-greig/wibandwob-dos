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

## ARCHITECTURE TERMS

**imperative vs declarative**
- imperative: you call `.setContent("hello")` on the blessed widget directly from a timer, a key handler, a service callback — all in different places
- declarative: you update a state object, one render function reads that state and calls `.setContent()` as a result
- imperative is fine until three things try to update the same widget and you lose track of what it shows and why

**direct mutation**
- when code reaches directly into a widget and changes it: `myBox.content = "..."` or `myList.select(2)`
- the widget property becomes the only record of what changed — no one else knows
- the opposite: own the state yourself, let a render function apply it to the widget

**composition root**
- the single file that knows about everything: creates all the services, creates all the collaborators, wires them together, passes them to each other
- `app-controller.ts` is ours
- the problem is not that it exists — it should. the problem is when it also starts doing actual work instead of just wiring
- "giant-controller drift" is what happens when it keeps absorbing logic because it's the easiest place to add things

**seam**
- a place where two pieces of code touch through a clear interface rather than by reaching into each other
- good seams can be cut cleanly — you can change one side without breaking the other
- `microapp-sdk.ts` is a seam: modules talk to the shell only through that interface, not by importing internals

**Elm Architecture / TEA**
- a loop: Model (state record) → Msg (what happened) → update (pure fn: old state + msg → new state) → view (state → what to draw) → back to Model
- WibWob-DOS already has the spirit of this: StateService is a Model, commands are almost Msgs
- the gap is that the loop isn't closed consistently — some paths update state correctly, others skip it and mutate widgets directly
- see: https://guide.elm-lang.org/architecture/

**discriminated union / Msg type**
- a TypeScript type listing exactly what can happen in a subsystem:
  `type EditorMsg = { type: "keypress", key: string } | { type: "save" } | { type: "close" }`
- instead of three separate callbacks each mutating things, one update function handles all cases
- makes it impossible to forget a case; the compiler will tell you

**reducer**
- the update function: `(state, msg) => newState`
- takes current state + one thing that happened, returns next state
- no side effects inside it — side effects (saving to disk, timers, spawning processes) happen separately after it runs

**effect**
- anything that talks to the outside world: file read, timer, network call, spawning ffmpeg
- the Elm term draws a clear line between pure state changes (in → out) and things with consequences
- the point is to name effects explicitly rather than having them appear randomly inside callbacks

**event-handler soup**
- a key handler mutates a widget, a timer also mutates it, a service callback also mutates it, none know about each other
- debugging means chasing all three sources
- the fix: a single update path that all three feed into

**render invalidation**
- marking that something changed and a re-render is needed, without immediately calling `screen.render()`
- like queuing "this is dirty" and flushing at the right moment
- the alternative — calling `screen.render()` from 40 different places — works but makes timing unpredictable and wastes CPU

**East Asian Width (EAW)**
- a Unicode property that says how wide a character renders in a monospaced terminal
- values that matter: W (wide, 2 cols — CJK, Hangul, trigrams ☰), N (narrow, 1 col — ASCII, box drawing, braille), A (ambiguous — terminal decides; blocks ▒▓█ and misc symbols are usually 1 col in Western terminals)
- blessed has a `charWidth()` function that checks this but its lookup table is from 2015 and misses emoji entirely

**surrogate pairs**
- JavaScript strings are UTF-16, so any codepoint above U+FFFF (the Basic Multilingual Plane) gets split into two 16-bit values called a surrogate pair
- a high surrogate (U+D800-DBFF) followed by a low surrogate (U+DC00-DFFF)
- emoji like 😀 (U+1F600) are surrogate pairs: `"😀".length === 2` even though it's one visible character
- CJK like 漢 (U+6F22) is NOT a surrogate pair: it's in the BMP so `"漢".length === 1`
- blessed treats surrogate pairs specially in parseContent — it already knows their `.length` is 2, so it skips the regex-inserted spacer for them. BMP wide chars (CJK, trigrams) need the regex spacer because their `.length` is 1 but their visual width is 2
- this is why fixing emoji (surrogates) and fixing CJK/trigrams (BMP wide) are actually two different code paths in blessed

**charWidth / strWidth**
- blessed's two width-measuring functions in `lib/unicode.js`
- `charWidth(codepoint)` returns 0, 1, or 2 for one character
- `strWidth(string)` sums charWidth across a string
- we monkey-patch both with `string-width` v8 which handles emoji, ZWJ, skin tones, flags, keycaps, variation selectors
- the patch lives in `src/core/unicode-patch.ts`, called once before `blessed.screen()` creation

**chars.all regex**
- blessed regex in `unicode.chars.all` that matches every character considered "wide"
- used by `parseContent()` to insert `\x03` spacer cells after wide characters
- MUST agree with `charWidth()` — if charWidth says 2 but the regex doesn't match, parseContent won't insert a spacer, and screen.draw() will eat a real neighbouring character
- we patch this regex too, adding emoji surrogate pair ranges and BMP ranges blessed missed (☰ trigrams, dingbats, misc symbols)

**spacer cell / \x03**
- when blessed encounters a double-width character, parseContent inserts a `\x03` byte after it
- this is a placeholder that screen.draw() "eats" — it advances past it without outputting anything
- the terminal renders the wide char across two columns; the spacer reserves the second column in blessed's internal buffer
- if the spacer is missing, draw() eats the real next character instead

**smartCSR / differential rendering**
- blessed's screen.draw() compares old buffer vs new buffer cell by cell, only outputting changes
- `smartCSR: true` (our default) enables this optimisation
- the problem: when a window containing double-width chars moves, the old position has stale cells that draw() doesn't know are part of a wide char — it fails to clear the second column, leaving ghost artifacts
- fix: call `screen.alloc()` before render to reset the comparison buffer, forcing a full repaint
- this is cheap (zeroes an array) and we do it on every render when `fullUnicode` is on

**fullUnicode**
- blessed screen option that enables the double-width character handling path
- without it, all wide chars get replaced with `??` and surrogates with `?`
- with it, blessed uses `charWidth()` + `chars.all` regex + spacer insertion + the eat-next-cell logic in draw()
- we always enable it: `blessed.screen({ fullUnicode: true })`

**ghost artifacts / stale cells**
- wide chars that persist on screen after a window moves or closes
- root cause: blessed's differential render doesn't know a cell was the second half of a wide char
- the reblessed fork (kenan238/reblessed) tried to fix this by checking string length instead of charWidth — works for surrogate pair emoji but not BMP wide chars
- nobody has fully solved this in any blessed fork; our `screen.alloc()` approach is the most complete workaround

**ownership boundary**
- a rule about who is allowed to change what
- preferred split in this codebase: services own logic and state, windows own layout and render, controller wires them together
- when a window is also doing domain logic, or a service is calling render, the boundary is broken

## PROMPTING

Vibe-first. Describe the feeling of the problem, not the exact technical issue. Paste one of these when something feels off but you can't name it precisely. The first four prompts target Elm-style architectural smells specifically.

```
The render calls feel scattered. Find every place screen.render() or direct widget mutation happens outside of a clear render function. Map who is calling it and why. Propose one rule for when rendering is allowed to happen and from where. Apply it to one subsystem as proof. Typecheck clean. Commit.
```

```
State is living in the wrong place. Find widgets whose properties are the only record of something meaningful — content, selection, dirty flag, playback position, whatever. Pull that state into an explicit record. Let the widget be updated from it rather than being the source of truth. Typecheck clean. Commit.
```

```
Something is doing too many jobs at once. Find one complex window or service that owns its own timers, mutates its own widgets, handles its own key events, and manages its own state — all in one blob. Give each job a name. Extract the state into a local model. Write one render function that reads from it. Everything else feeds into that. Typecheck clean. Commit.
```

```
The composition root is doing actual work. Read app-controller.ts top to bottom. Mark every line that is wiring (good) vs every line that is policy or behavior (bad). Extract the policy and behavior into focused collaborators. Leave app-controller.ts as the place that creates things and connects them, not the place that runs them. Typecheck clean. Commit.
```



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

## SCAFFOLD PROMPTS

Token-efficient patterns for requesting extensible features. Name the trigger, the dispatch pattern, the first case, and the API. Skip rationale.

```
[SURFACE]: [trigger] dispatches to [target] by [dispatch key] map. [First type] -> [command] via [API]. Scaffold for [future types] later.
```

Example:
```
ZINE: double-click dispatches to editor by sourceType map. Text -> editor.open via runGlobalCommand. Scaffold for figlet later.
```

Rules:
- Name exact trigger and target
- Name the pattern not the implementation (dispatch map, not switch statement)
- Name the API so the agent does not have to discover it
- Say what the FIRST case is and that others come LATER
- Skip rationale, skip alternatives, skip please

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
