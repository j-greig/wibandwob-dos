# Autoresearch Ideas — Solid Foundations

## High-Value Refactors
- Split ui-parts.ts into src/core/ui/ directory (each primitive its own file)
  with barrel re-export — biggest single file, most architectural win
- Extract window opener functions from app-controller into src/core/window-openers/
  by domain (editor, browser, art, generative) — cuts app-controller in half
- Lazy dynamic import() for window factories — only load code for window types
  that actually get opened in a session
- Extract control-api route handlers into src/api/ directory with per-resource
  modules (windows.ts, commands.ts, state.ts, overlay.ts)

## Type System
- Branded WindowId type (number & { __brand: "WindowId" }) to prevent mixing
  with arbitrary numbers
- Discriminated union for WindowRecord where each WindowKind variant carries
  its own state shape — eliminates as-any casts in window code
- Strict event typing with a WindowEvent discriminated union per event kind
- Zod schemas for API request/response — validates at boundary, generates types

## SDK Gaps (from devlog friction points)
- createPanel() — blessed scroll-correct panel with fixed:true children,
  themed title bar, border, resize grip. Every microapp reinvents this.
- createTextInput() — debounced, single-fire text input that avoids blessed
  double-keypress bug. Every text input in the app has this problem.
- Tag-aware text wrapping — wrapText() that preserves {color-fg}...{/color-fg}
  tags across line breaks instead of splitting mid-tag
- createSelectableList() — keyboard-navigable, mouse-clickable scrollable list
  with typed selection events
- Hot module reload — close windows of appType, re-import(), reopen. Currently
  requires manual restart or window cycle.

## Boot Performance
- Profile import graph with --trace-resolution to find heavy eager imports
- Defer blessed screen creation until after essential service init
- Module scanning at startup could be cached (manifest hash → skip re-scan)
- Service init waterfall — which services can init in parallel?

## Design System Completeness
- Tabbed container with lazy content mounting
- Split pane with draggable divider
- Data table with sortable columns and fixed header
- Toast notifications at screen edge
- Form controls: checkbox, radio, dropdown, stepper
- Breadcrumb navigation for nested views
- Progress bar (determinate and indeterminate)
- Skeleton loading states (already have skeleton-renderer, expand to SDK)

## Code Quality
- Functions over 50 lines should be audited for extraction opportunities
- Window files that mix model/view/controller into one closure should separate
  state management from rendering
- Services should not import from windows/ — one-way dependency only
- Config constants scattered across files should consolidate into config.ts
