---
title: "F056 — CGA Theme: classic DOS 16-colour palette"
status: not-started
branch: feat/e056-cga-theme
issue: ~
---

# F056 — CGA Theme

Add a `wibwob-cga` theme inspired by the canonical DOS CGA 16-colour BIOS palette —
same aesthetic as D-Flat MemoPad, Norton Commander, and the Norton Control Center
palette chooser. Sits alongside phosphor, dark-pastel, nord, etc.

## Reference

Screen 2 screenshot: classic D-Flat MemoPad + Norton Control Center palette panel.

**Classic DOS CGA 16-colour BIOS palette:**

| # | Name          | Hex       |
|---|---------------|-----------|
| 0 | Black         | `#000000` |
| 1 | Blue          | `#0000AA` |
| 2 | Green         | `#00AA00` |
| 3 | Cyan          | `#00AAAA` |
| 4 | Red           | `#AA0000` |
| 5 | Magenta       | `#AA00AA` |
| 6 | Brown         | `#AA5500` |
| 7 | Light Grey    | `#AAAAAA` |
| 8 | Dark Grey     | `#555555` |
| 9 | Light Blue    | `#5555FF` |
|10 | Light Green   | `#55FF55` |
|11 | Light Cyan    | `#55FFFF` |
|12 | Light Red     | `#FF5555` |
|13 | Light Magenta | `#FF55FF` |
|14 | Yellow        | `#FFFF55` |
|15 | Bright White  | `#FFFFFF` |

**Signature combos to preserve:**
- Desktop fill: Blue bg (`#0000AA`) + Light Cyan char (`#55FFFF`)  
- Window body: Light Grey bg (`#AAAAAA`) + Black fg (`#000000`)
- Title bar focused: Cyan bg (`#00AAAA`) + Black fg (`#000000`)
- Title bar unfocused: Blue bg (`#0000AA`) + Light Grey fg (`#AAAAAA`)
- Menu bar: Light Grey bg (`#AAAAAA`) + Black fg (`#000000`) with coloured mnemonic letters
- Selected/input: Blue bg (`#0000AA`) + Bright White fg (`#FFFFFF`)
- Header/footer: Cyan bg (`#00AAAA`) + Black fg (`#000000`)
- Error: Light Red (`#FF5555`)
- Warning: Yellow (`#FFFF55`)
- Close button: Light Red bg (`#FF5555`) + Black fg

## Stories

- [ ] `src/core/theme/cga.ts` — define `wibwob-cga` ThemeVariant using BIOS CGA colours
- [ ] `src/core/theme/resolver.ts` — register `wibwob-cga` in the theme registry
- [ ] Smoke test: cycle to CGA theme via API, screenshot confirms correct colours
- [ ] (optional) `microapps/cga-theme/theme.ts` — microapp-style variant for distribution

## Notes

- Keep pure CGA hex values — no softening or blending. It should look like a real DOS screen.
- `desktopFillChar`: consider `░` (CGA dithering texture) on `#0000AA` bg
- `windowShadow`: Dark Grey (`#555555`) on Black
- The Light Cyan + Blue + Light Grey trinity is the tell — if those three pop, it's right.
