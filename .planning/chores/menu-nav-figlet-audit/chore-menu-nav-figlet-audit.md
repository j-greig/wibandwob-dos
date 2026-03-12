---
id: chore-menu-nav-figlet-audit
title: Menu toggle, nav cleanup, responsive figlet, SDK audit
status: done
branch: chore/menu-nav-file-audit
---

# Menu toggle, nav cleanup, responsive figlet, SDK audit

Fixes, polish, and prep work for consolidating file/text/figlet surfaces.

## Checklist

- [x] BUG 1: Menu toggle on keyboard shortcut
- [x] BUG 2: Status bar declutter
- [x] BUG 3a: Unbind Alt-A and Alt-D keyboard shortcuts
- [x] BUG 3b: Remove all six menu hint labels from bottom nav
- [x] CHORE 4: Responsive figlet in Hello World
- [x] CHORE 5: Extract SDK primitives for responsive figlet
- [x] CHORE 6: SDK audit skill idea (moved to agents-docs-signposting chore)

## BUG 1: Menu toggle on keyboard shortcut

Pressing Alt-W twice should toggle the menu closed. Previously it stayed
open because openMenu() always called closeMenus() first (clearing
openMenuLabel) then immediately reopened.

FIX: Added toggleMenu(label) to MenuOverlayManager. Keyboard shortcuts
now call toggleMenu instead of openMenu. Click handler already had toggle
logic and is unchanged.

Files changed:
  src/core/menu-overlay-manager.ts  (new toggleMenu method)
  src/core/app-controller.ts        (bindGlobalKeys uses toggleMenu)


## BUG 2 + 3a + 3b: Status bar and keyboard shortcuts

Bottom status bar was cluttered with six menu hint labels that duplicate
the clickable top menu bar:
  Alt-F File  Alt-E Edit  Alt-V View  Alt-W Window  Alt-A Applications  Alt-D Demos

REMOVED: All six labels from the status bar. Also removed Alt-A and Alt-D
keyboard bindings entirely (Applications and Demos menus are click-only now).

KEPT in status bar: Tab Next  Shift-Tab Prev  Ctrl-S Save  Ctrl-Q Quit
KEPT as shortcuts: Alt-F, Alt-E, Alt-V, Alt-W (menus), Alt-T (theme toggle),
Alt-Shift-Arrows (resize).

Files changed:
  src/core/shell-chrome.ts     (updateStatusLine stripped labels)
  src/core/app-controller.ts   (removed M-a and M-d key bindings)


## CHORE 4: Responsive figlet in Hello World

Hello World now re-renders its banner on resize with a font cascade:
  larry3d (wide) -> slant -> small -> smslant -> digital -> CAPS (narrow)

Uses tryFiglet with width checking (figlet -w flag, reject if overflows).
Wired to win.body.on("resize") -- should migrate to win.onResize() when
SDK primitive is ready.

Files changed:
  modules/hello-world/index.ts  (full rewrite, responsive)


## CHORE 5: Extract SDK primitives for responsive figlet

Six candidates identified for SDK extraction:

### 5a. tryFiglet(text, font, width) -> string | null
Width-aware figlet that returns null if output overflows. Already exists
as a private function in markdown-service.ts. Export it from the SDK.

### 5b. responsiveFiglet(text, width, cascade?) -> string
Pick the best font from a cascade for a given width. Falls through to
plain CAPS. Currently only in hello-world/index.ts.

### 5c. FontCascade type + DEFAULT_FONT_CASCADE constant
Type: Array<{ font: string; minWidth: number }>
Default cascade: larry3d -> slant -> small -> smslant -> digital -> CAPS.
Standardises the vocabulary so modules share a common cascade definition.

### 5d. FONT_TIERS metadata
Lookup of known fonts with approximate height and tier classification
(XL/L/M/S/XS). figlet-service.ts has font_metadata with height/width
but does not expose it as a tier system. Useful for modules that want to
pick fonts by size category rather than by name.

### 5e. createResponsiveFigletDisplay() UI primitive
Like createFigletDisplay() but takes a cascade and auto-rerenders at the
right font on layout(). Currently createFigletDisplay takes a renderText
callback but the callback does not receive the current width. Two options:
  Option A: Add width param to renderText callback signature
  Option B: New primitive that wraps createFigletDisplay with cascade logic

### 5f. Consolidate raw spawnSync("figlet") calls in modules
Three modules roll their own spawnSync("figlet"...) when the SDK already
exports renderFiglet:
  modules/hello-world/index.ts        (has tryFiglet, should use SDK)
  modules/wibwob-poetry-clock/index.ts (has renderFigletTime, should use SDK)
  modules/dashboard-xxl/index.ts      (has figlet(), should use SDK)

Also: hello-world uses body.on("resize") instead of win.onResize(). Should
migrate to the SDK hook once the primitive is ready.


## CHORE 6: SDK audit skill (deferred)

We keep doing the same audit pattern: "which modules use X SDK component,
how is it wired, what are the gaps." This is a repeatable agent task.

Shape: .agents/skills/sdk-audit/SKILL.md
Trigger: "audit SDK usage of X", "which modules use X"
Steps: grep modules + SDK exports + ui-parts impl, extract usage table.

DEFERRED until we have done 2-3 more manual audits and the pattern is
truly stable. The file-open-save and text-code-engines audits in this
branch are the first two data points.


## Audit documents (in scratch/, not committed)

Three audit docs created during this chore for reference:
  scratch/audit-file-open-save.txt          -- all apps with file open/save
  scratch/audit-text-code-engines.txt       -- all text/md/code surfaces + engines
  scratch/audit-figlet-markdown-rendering.txt -- figlet stack, font tiers, responsive gaps
