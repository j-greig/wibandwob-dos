# E026 Closeout & E025 Handoff

Last updated: 2026-03-09

## E026 Closeout Checklist

Three items remain before E026 can close:

### F04: Inline styles coverage + clipboard copy
**What:** Verify all inline markdown styles render correctly in MarkdownView. Add `y` keybind to copy code blocks to clipboard.
**Why:** Rendering works per S01, but coverage audit ensures no edge cases. Clipboard copy is the obvious missing interaction for code blocks.
**Effort:** 30min audit + one keybind implementation (~1hr total)
**Acceptance:**
- [ ] Audit: bold, italic, strikethrough, inline code, links all render with correct blessed tags
- [ ] `y` on focused code block copies content to system clipboard
- [ ] Visual feedback on copy (flash or status message)

### F09: Extract layoutPanels + grid canvas
**What:** Extract `layoutPanels` function and grid canvas rendering from `sy2-chronicles` into `src/core/panel-layout.ts` and `src/core/grid-canvas.ts`.
**Why:** Critical unlock for E025. PanelGrid IS these two primitives — E025 cannot start without them in core SDK.
**Effort:** 2-3hr extraction + tests
**Acceptance:**
- [ ] `src/core/panel-layout.ts` exports `layoutPanels(panels, constraints) → Rect[]`
- [ ] `src/core/grid-canvas.ts` exports grid rendering utilities
- [ ] Both have unit tests
- [ ] sy2-chronicles refactored to import from core (not duplicate)
- [ ] Typecheck passes

### SDK border primitive: createBorderedPanel
**What:** Extract `createPanel` from `microapps/e026-demo/index.ts` into `src/core/ui-parts.ts` as `createBorderedPanel`.
**Why:** Reusable bordered panel with single/double/bold/thin styles. Already proven in demo, just needs SDK extraction.
**Effort:** 1hr extraction + style enum
**Acceptance:**
- [ ] `src/core/ui-parts.ts` exports `createBorderedPanel(opts: { style: 'single'|'double'|'bold'|'thin', ... })`
- [ ] e026-demo refactored to use SDK version
- [ ] Typecheck passes

---

## E026 → E025 Dependency Map

E025 **cannot start S01** until these are in core:

| E026 Item | E025 Needs | File | Status |
|-----------|-----------|------|--------|
| F09 layoutPanels | PanelGrid reflow logic | `src/core/panel-layout.ts` | ❌ not extracted |
| F09 grid canvas | Panel rendering surface | `src/core/grid-canvas.ts` | ❌ not extracted |
| SDK border primitive | Panel chrome options | `src/core/ui-parts.ts` | ❌ not extracted |

**Concrete APIs E025 S01 will call:**
```typescript
// From panel-layout.ts
layoutPanels(panels: PanelDef[], container: Rect, opts?: LayoutOpts): Rect[]

// From grid-canvas.ts
createGridCanvas(screen: blessed.Screen, opts: GridOpts): GridCanvas
GridCanvas.render(panels: Panel[], layout: Rect[]): void

// From ui-parts.ts
createBorderedPanel(opts: BorderedPanelOpts): blessed.Box
```

Until these exist with tests, E025 S01 would have to reimplement them — wasting the extraction work and creating duplicate code.

---

## E001 Crossover — Agent Confusion Patterns

These 5 patterns from today's session should become E001 specs. Feed into E001 S02 when that epic starts.

1. **host.runCommand namespacing** — Spec should define: global commands use `host.runGlobalCommand()`, module-internal commands use `host.runCommand()`. Silent failure on mismatch is the confusion source.

2. **blessed tags:false literal braces** — Spec should warn: `tags:false` (blessed default) renders `{grey-fg}` as literal text. Always set `tags:true` when using blessed color syntax.

3. **createButtonBar numeric Rect** — Spec should state: `layout()` expects `{top: number, left: number, ...}`, not CSS strings. `calc()` silently ignored — blessed has no CSS calc support.

4. **TreeWidget focus trap** — Spec should document: once a blessed list/tree has focus, parent key handlers go deaf. Wire Tab/Escape on BOTH `tree.widget` AND `win.body` for focus cycling.

5. **ANSI in setContent line-width** — Spec should warn: ANSI escape codes in `setContent()` confuse blessed's line-width calculation. Use `wrap:false` + `style.fg` for custom borders, not ANSI in content.

---

## Worktree Cleanup Note

No e026 worktree exists — work done in main repo. Stale worktrees to remove (from PARKED.md): e007, e023, origin-claude-possible-ts-refactor, planning-infra, premerge.
