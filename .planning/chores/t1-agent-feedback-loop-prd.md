# PRD: Agent Feedback Loop — T1 Stories

> The system currently gives agents wrong signals, silent failures, and missing
> information at every level. These 4 stories close that loop.

**Branch:** `chore/w13-reflections`  
**Source:** `.planning/chores/w12-w13-ranked-actions.md` Tier 1  
**Stories:** 4, ordered by dependency  
**Effort:** S / S / M / M  

---

## S1 — Command fuzzy matching (underscore → hyphen)

**Problem:** `terrain_lab.open` returns "Unknown command". The correct form is
`terrain-lab.open`. Agents guess wrong and get a hard failure with no hint.

**Root cause:** `run()` does an exact lookup. `LEGACY_COMMAND_ALIASES` handles
some kebab aliases but only for a fixed hand-maintained list.

**Fix:** In `CommandRegistry.run()`, before the lookup, normalise the input id:
1. `id.replace(/_/g, '-')` — covers the most common case
2. If still not found, check `LEGACY_COMMAND_ALIASES[normalised]`
3. If still not found, scan all command IDs for a close match and include it in the error: `Unknown command: terrain_lab.open — did you mean: terrain-lab.open?`

**Scope guard:** Step 3 is substring/underscore-hyphen only — no Levenshtein. Keep it in a separate story if needed.

**File:** `src/core/command-registry.ts` — `run()` method, ~5 lines

### AC
- [ ] `wibwob cmd terrain_lab.open` succeeds (resolves to `terrain-lab.open`)
- [ ] `wibwob cmd microapp.wibwob.figlet_open` resolves to `microapp.wibwob.figlet.open` (if it exists)
- [ ] Unknown command with a close hyphen/underscore match returns suggestion in error message
- [ ] Unknown command with no close match returns existing "Unknown command: X" error unchanged
- [ ] `bun run typecheck` passes

---

## S2 — `wibwob commands` surfaces arg schemas

**Problem:** `wibwob commands` shows description strings only. Agents guess
arg names and get `ok:true` with nothing happening (e.g. `--windowId` instead
of `--id`). The Zod schemas already exist and `zodToJsonSchema` is already
called in `CommandRegistry.list()` — the data is computed but not rendered
by the CLI.

**Root cause:** `wibwob commands` CLI output doesn't include the `params` field
that `list()` already returns.

**Fix:**
1. Verify `params` field is in `list()` output for commands with Zod schemas (already is — line 210-212 `command-registry.ts`)
2. `wibwob commands` CLI: render `params` when present — compact one-liner per arg: `  --id (number, required)`
3. `wibwob commands -q` (quiet) keeps current ID-only output unchanged

**Files:**
- `src/cli/wibwob.ts` — commands display formatter, ~15 lines
- No changes to `command-registry.ts` (data already there)

### AC
- [ ] `wibwob commands` shows arg schema for `window.close`: `--id (number)`
- [ ] `wibwob commands` shows arg schema for `ghostty.shader.set`: `--name (string)`
- [ ] `wibwob commands -q` output unchanged (IDs only)
- [ ] Commands without params show no args section (no empty `Args:` noise)
- [ ] `bun run typecheck` passes

---

## S3 — CLI health gate: warn on 1×1 screen instance

**Problem:** When multiple WibWob instances run (one headless zombie, one real TUI),
`wibwob cmd X` silently targets the zombie. Commands return `ok:true`.
Nothing happens on screen. Agent burns 6+ attempts before noticing.

**Root cause:** Socket discovery picks the first valid socket, ignoring screen size.
A 1×1 screen = headless/zombie = commands go nowhere visible.

**Fix:**
1. `wibwob ls` already returns `screen: { width, height }` per instance
2. Before dispatching any command, check target instance screen size
3. If `width <= 1 || height <= 1`: print warning `⚠️  Target instance screen is 1×1 — may be headless. Use -i <label> to target a specific instance.` then proceed (warn, don't block)
4. If `width <= 1` AND `--strict` flag: return error, don't dispatch
5. When multiple instances exist and one has real dimensions, prefer it in auto-discovery

**Scope guard:** Step 5 is "prefer real screen" in auto-discovery only — does not
break explicit `-i <label>` targeting.

**Files:**
- `src/cli/wibwob.ts` — instance selection / dispatch, ~20 lines
- `wibwob` CLI instance discovery logic

### AC
- [ ] With a 1×1 headless instance as default: `wibwob cmd X` prints warning before dispatching
- [ ] With `--strict`: `wibwob cmd X` returns error, does not dispatch
- [ ] With real TUI running alongside zombie: auto-discovery prefers real-screen instance
- [ ] Explicit `-i <label>` targeting bypasses the gate entirely
- [ ] `bun run typecheck` passes

---

## S4 — SDK patterns doc

**Problem:** 8 patterns from the MAPP 1-10 audit are undocumented. Every new
microapp developer hits them and burns sessions. They exist as W12 devlog entries
but not as canonical reference.

**Root cause:** `SDK-MICROAPP-DEV.md` covers scaffolding and lifecycle but not
component model nuances or performance gotchas.

**Fix:** Add a `## Patterns & Gotchas` section to `SDK-MICROAPP-DEV.md` covering:

1. **Two component models** — LayoutPart (needs `createStack`, has `.layout(rect)`) vs CompositionHelpers (self-parent, use for new work). Import path is the same; behaviour is completely different.
2. **Three timer mechanisms** — `setInterval` (raw, no lifecycle), `createTimer+Set` (lifecycle-managed, clears all), `createAnimationClock` (subscribe/play/pause/destroy, preferred for animation). When to use each.
3. **`createCanvas` timing** — call `getSize()` after attach, not during construction. Use `applyContribRect()` wrapper to emit `resize` after layout.
4. **ANSI in grid cells = performance cliff** — `paintText` with ANSI codes at 30fps caused 87% CPU. Use plain chars; apply colour via theme, not inline ANSI.
5. **`createButton({ focusable: false })`** — buttons used as indicators steal focus and break parent keyboard shortcuts. Not yet an SDK option — use raw blessed element or document the workaround.
6. **Focus management** — `createInputLine` is modal (inputOnFocus). `win.onInput` is the plumb/write API path, NOT keyboard input. Tab/Shift-Tab are reliable; 1-5 number keys are not.
7. **Destroy order** — destroy children before parents to avoid orphan errors.
8. **`host.promptValue()`** — exists, works, zero docs. Takes focus for modal text input.

**Scope guard:** This is a patterns section addition only — not a full SDK reference rewrite.

**File:** `SDK-MICROAPP-DEV.md` — new `## Patterns & Gotchas` section, ~120 lines

### AC
- [ ] Section exists in `SDK-MICROAPP-DEV.md` under `## Patterns & Gotchas`
- [ ] All 8 patterns above have entries with: what it is, the footgun, the correct pattern
- [ ] Each pattern has a code snippet (≤10 lines)
- [ ] `bash scripts/doc-sync.sh` passes (no stale gen outputs)
- [ ] Reviewed by reading as a new microapp developer — could they understand it in 5 mins?

---

## Dependency order

```
S1 (fuzzy match) — standalone, no deps
    ↓ optional: better error messages in S3 lean on S1
S2 (arg schemas) — standalone, data already computed
    ↓ arg schemas in error messages for S3
S3 (health gate) — leans on S1 (better suggestions) + S2 (better errors)
S4 (SDK doc) — no code deps, can ship any time
```

S1 + S2 can be done in parallel. S3 after both. S4 any time.

---

## Out of scope (separate stories if needed)

- Levenshtein fuzzy matching beyond underscore/hyphen normalisation
- Full SDK API reference (separate epic)
- `createButton({ focusable: false })` SDK option (needs SDK design)
- Batch op failure reasons (Tier 2, separate story)
