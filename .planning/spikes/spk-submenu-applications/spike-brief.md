---
id: spk-submenu-applications
title: Submenu support for Applications menu
status: in-progress
branch: spike/submenu-applications
---

# Submenu Support — Applications Menu

## Problem

The Applications menu is a flat list of ~20+ items. Prototypes, demos, and
creative tools are mixed in with core apps. The labelled separator we added
helps but doesn't scale. A proper submenu (like TurboVision/macOS) would let
us group apps cleanly.

## Design

### MenuItem changes

Add optional `children` to MenuItem:

    interface MenuItem {
      label: string;
      action: () => void;
      appTypes?: string[];
      separator?: true;
      children?: MenuItem[];    // NEW — makes this item a submenu parent
    }

Parent items render with a `▸` arrow suffix. Selecting or hovering opens a
child list to the right.

### Menu overlay changes (menu-overlay-manager.ts)

- Track `submenuList` and `submenuShadow` alongside the existing menu
- On select/right-arrow of a parent item: open child list at parent's
  right edge, same y position as the selected row
- On left-arrow or escape in submenu: close submenu, return to parent
- On select in submenu: close everything, fire action
- Mouse: hovering a parent item opens its submenu; hovering away closes it

### Applications menu structure

Favourites (top):
  Wib&Wob Chat        (favourite)
  Scramble Chat        (favourite)

Main apps (A-Z):
  Backrooms: Live TV
  Backrooms: Log Browser
  Contour Studio
  ... etc

Prototypes ▸          (submenu)
  E026 Demo
  Heartbeat
  Hello World
  Patchbay Lab
  Poetry Clock
  Tide Pool
  TouchLab
  TR-808
  WibWobWorld

### Keyboard

- Up/Down: navigate within current list
- Right/Enter on parent: open submenu
- Left/Escape in submenu: close submenu, back to parent
- Enter on leaf item: execute action, close all menus

### Risks

- Blessed list widget may not support precise row-level positioning for the
  submenu origin. May need manual coordinate math.
- Mouse hover detection on individual rows requires blessed list internals
  or a custom box-per-row approach.
- Keep it simple: one level of submenu only, no recursive nesting.

## ACs

- [ ] MenuItem type supports children
- [ ] Parent items render with ▸ arrow
- [ ] Submenu opens to the right on select/right-arrow
- [ ] Left/escape closes submenu
- [ ] Mouse click on parent opens submenu
- [ ] Applications menu has Prototypes submenu
- [ ] Flat apps A-Z sorted in main list
- [ ] Typecheck passes
