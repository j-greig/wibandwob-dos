---
session: 2026-03-21
branch: claude/microapps-devlog-hwTZP
apps: ascii-rain · word-counter · habit-tracker
---

# Microapp Trio — Build Devlog

Three microapps from simple → complex. Each committed after visual validation with `scripts/validate-microapp.sh`.

---

## App 1 — `ascii-rain` (simple)

**What it is:** Matrix-style falling-character animation. Five charsets (katakana, binary, alpha, symbols, block glyphs). Space pause/resume, r cycle charset, +/- speed (1–8fps).

**Architecture:** `createTimer` at ≤8fps → `createTextViewer.update()` per tick. Drop state is a plain array of `{col, row, speed, length, chars[]}` objects — no grid allocation per frame, just index into the pre-built column array.

**Key pattern:** `canvas.element` (the `BoxElement` inside `createTextViewer`) is the focus target and key-binding surface. This was not obvious — `createTextViewer` returns `{ element, update, destroy, getContent }` and `element` is a raw blessed node you can call `.key()` on.

**Pain points:**
- `canvas.element` needs to be in focus for key bindings to fire, but `createTextViewer` doesn't take an `onFocus` callback. Had to use `win.setFocusTarget(canvas.element)` + `win.focus()`. Fine once you see the pattern in `generative-art/index.ts:96`.
- Width/height from `canvas.element.width` returns a number or string depending on how the window was sized. Guarded with `(canvas.element.width as number) || 70` — coercion is blunt but works. No documented type contract in SDK for dimension access.
- `createTimer` doesn't return a cancel handle — you manage a `Set<ReturnType<typeof setInterval>>` yourself and call `clearTimers(timers)` on cleanup. Slightly clunky (`timers` set is boilerplate on every animated app) but explicit.

**Commit:** `45e9e7c` — validated 2555 chars captureText.

---

## App 2 — `word-counter` (medium)

**What it is:** Live text analysis. Textarea top 40%, stats viewer bottom 60%. Tracks: words, chars, chars-no-space, lines, sentences, paragraphs, unique words, avg word length, longest word, reading time (238wpm). Tab toggles focus between panes. Ctrl-L clears.

**Architecture:** `blessed.textarea` for input + `createTextViewer` for stats display. Refresh is triggered via `inputBox.on("keypress", () => setImmediate(refresh))` — the `setImmediate` defers one tick so the textarea has processed the keypress before we read `getValue()`.

**Key pattern:** `setImmediate(refresh)` to read textarea state after the event. Direct `on("keypress", refresh)` reads stale value.

**Pain points:**
- **`blessed.textarea` focus is modal**: when `inputOnFocus: true`, the textarea captures all keys including Escape, Tab, arrow keys. This hijacks the blessed focus system and prevents you from using normal `list.key()` patterns. Tab was bound with `inputBox.key(["tab"], ...)` which works, but the experience is slightly janky — the user must explicitly press Tab to leave the textarea. There is no clean "textarea with normal focus" mode.
- **Height expressed as `"40%"`**: `createTextViewer` accepts `top` and `bottom` as numbers but I passed `top: "40%"` (a string percentage). Blessed accepts this but TypeScript complained. Used `as any` cast on the options — the type definition in `composition-helpers.ts` is `number | string` for some fields but not all. Inconsistency.
- **`multiInstance: true` in manifest**: this means multiple windows can open simultaneously. Without it, re-running `open` does nothing. Needed because you might want two counters open at once. Had to discover this by reading `kanban/microapp.json` — not surfaced in the quick-start section of `SDK-MICROAPP-DEV.md`.
- **`blessed.textarea` vs `blessed.textbox`**: `textarea` is multi-line (what I wanted), `textbox` is single-line. The naming is not intuitive. `createInputLine` from the SDK wraps textbox (single-line). For a multi-line input there's no SDK helper — you drop down to raw blessed.

**Commit:** `6ceb2d9` — validated 103 chars captureText.

---

## App 3 — `habit-tracker` (complex)

**What it is:** Daily habit tracker. Left 40%: `blessed.list` of habits with completion marker (`✓`/`○`), emoji, name, fire streak badge. Right 60%: `createTextViewer` showing detail panel (today status, current streak, best streak, 30-day rate bar, 21-day calendar `■/□`). `h` key flips to 28-day matrix history view. JSON persistence via `safeWriteFile`/`safeReadJSON`. Workspace snapshot registered.

**Architecture:** Split into functional helpers: `analyze()` for stats, `currentStreak()` / `longestStreak()` / `completionRate()` scan the `completions` record. `buildDetail()` and `buildHistory()` return formatted strings for the viewer. State lives in a `HabitData` object, persisted on every mutation.

**Key pattern:** `blessed.list` inside a `blessed.box` with `parent: box` (same as kanban). Key bindings on the list element. `(list as any).setItems([...])` for refresh — the `blessed.Widgets.ListElement` type doesn't expose `setItems` cleanly in the TS types.

**Pain points:**
- **`(list as any).setItems()`**: `blessed.list` has `setItems()` at runtime but `blessed.Widgets.ListElement` typed as `blessed.Widgets.BoxElement` doesn't declare it. This is a recurring pattern in kanban too. The blessed TS types are incomplete. Every list-touching app needs the `as any` cast. Annoying, not fixable without patching `@types/blessed`.
- **`(list as any).selected`**: same issue — `selected` property exists at runtime but not in the type. `kanban/index.ts:133` uses the same workaround. SDK could wrap this in a `createSelectableList` helper that returns a typed interface.
- **Emoji rendering in `validate-microapp.sh` text capture**: `captureText` showed `?` instead of `🏃` etc. This is a terminal/encoding issue in the validation script's text extraction, not a real bug. The TUI renders emoji fine. But it creates false doubt during validation — you have to mentally discount the `?` characters.
- **`safeReadJSON` returns `undefined` not a typed default**: `safeReadJSON<HabitData>()` returns `HabitData | undefined`. You always need to handle the undefined case. Fine design, just verbose — every persistence-using app writes a `loadData()` wrapper with a fallback. SDK could offer `safeReadJSONWithDefault<T>(path, default): T`.
- **`registerSnapshot` restore signature**: `restore: (_snap, payload)` — the `_snap` arg is the previous snapshot. The `payload` is... also the snapshot? The two-arg signature in the type definition is confusing. Looking at `kanban/index.ts:192`, `payload` is passed to `host.runCommand("open", payload)` and the actual restore is done by re-running the open command. This means snapshot restore is essentially "re-open with state" not "restore into existing window". Took a moment to understand.
- **`host.promptValue` blocks focus**: when prompting for a new habit name (key `a`), `host.promptValue` opens a modal that captures focus. After the callback fires and the modal closes, focus does NOT automatically return to the list. Had to accept this — the user presses Tab or clicks. There's no `onDismiss` callback to re-focus.
- **No `createSplitView` used**: I initially tried `createSplitView` to get the left/right layout, but the API requires `first` and `second` pane references that are returned from the helper, not `parent: box` style. The `createListPanel` helper didn't fit cleanly because I needed raw `blessed.list` for vi-style key navigation (`vi: true`). So I fell back to explicit `blessed.box` + `blessed.list` + `createTextViewer` with manual `left/width` percentages. Not painful, just means more boilerplate.

**Commit:** `224ad90` — validated 133 chars captureText.

---

## Cross-Cutting Pain Points

**Server wasn't running at start.** `ensure-running.sh` timed out because `marked` package was missing — `markdown-service.ts` imports it but it wasn't in `node_modules`. Fixed with `bun add marked --ignore-scripts`. The `--ignore-scripts` was necessary because `node-pty` fails its install script in this environment. This is a latent env fragility that would bite anyone working fresh.

**No TypeScript pre-check.** There's no `bun tsc --noEmit` step in the validate script or dev loop. Type errors surface only at runtime (via Bun's loader) when the microapp opens. Errors show in the tmux pane, not in the validation output. I had to watch `tmux capture-pane` to verify clean load. A `bun tsc --noEmit microapps/<name>/index.ts` step in `validate-microapp.sh` would surface errors earlier.

**`blessed.Widgets.*` types are lagging reality.** Patterns that work at runtime (`setItems`, `selected`, `style.border`) aren't in the type definitions. Every microapp that touches a list ends up with `(list as any).` casts. Strongly suggest a thin `createManagedList(parent, opts)` SDK helper that returns a typed interface hiding the casts internally.

**`createTextViewer` top/bottom as percentages.** Passing `top: "40%"` works at runtime but TypeScript complains. The `ViewerOpts` type in `composition-helpers.ts` should accept `number | string` for positional args to match blessed's actual API.

**Emoji in terminal**: all three apps use emoji in UI text (🔥 streak badges, ■/□ calendar). These render correctly in a real terminal session. In the text screenshot API and `validate-microapp.sh` extraction, emoji appear as `?`. Not a bug, but creates friction during agentic validation — need to consciously interpret `?` as "emoji was here."
