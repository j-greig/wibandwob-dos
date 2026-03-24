---
id: e056
title: TUI Skin System
status: in-progress
branch: epic/e056-tui-skin
created: 2026-03-24
---

# E056 — TUI Skin System

Give users control over the **structural** rendering of window chrome — border
style and drop shadows — independent of colour themes.

A **TuiSkin** is orthogonal to a ThemeVariant: a dark theme can have any border
style. The skin is persisted in `DATA_ROOT/settings.json` (default `~/.wibwob/`)
and optionally overridden per workspace.

## Merge stack (lowest → highest priority)

```
DEFAULT_SKIN → theme().skin → settings.json skin → workspace skin
```

## TuiSkin shape

```ts
{
  borderStyle: "line" | "bg" | "none";  // see Border styles below
  borderChar: string;                    // fill char for "bg" mode, default "░"
  shadowEnabled: boolean;               // window drop shadows on/off
}
```

### Border styles

| value | visual | notes |
|-------|--------|-------|
| `"line"` | Unicode box chars `┌─┐│└┘` | default — blessed native |
| `"bg"` | single fill char (e.g. `░` `▓` `·` `█`) | blessed bg mode, borderChar configurable |
| `"none"` | frameless | no border drawn, body fills frame |

> **Blessed limitation**: Per-corner/per-side character overrides (`╔╗╚╝` rounded `╭╮╰╯`)
> require manual border drawing and are deferred to a future story.

## Stories

### ✅ S1 · Skin type + window-manager
- `TuiSkin`, `DEFAULT_SKIN`, `BorderStyle` in `src/core/types.ts`
- `skin?: Partial<TuiSkin>` in `ThemeTokens` — themes can declare a preferred skin
- `WindowManager.setSkinProvider()` — injected by AppController
- `createFrame()` uses effective skin for border and shadow at creation time
- `restyleAll()` applies live skin changes to all open windows
- `settings-service.ts` loads `DATA_ROOT/settings.json` at startup

### ✅ S2 · Settings persistence
- `src/core/settings-service.ts` — `loadSettings()`, `getSettingsSkin()`, `patchSkin()`
- File: `DATA_ROOT/settings.json` → `{ "skin": { ... } }`
- Loaded at app startup; written on every `skin.set` / `skin.cycle` call

### ✅ S3 · Workspace override + COAT surface
- `skin?: Partial<TuiSkin>` in `WorkspaceFile` (version 2, backward-compat)
- `GET /skin` → effective merged skin JSON
- `POST /skin/set` → live restyle + persist
- `skin.set` command (args: borderStyle, borderChar, shadowEnabled)
- `skin.cycle` command — cycles `line → bg → none → line`
- `DesktopState.skin` → effective skin visible in `/state`

## COAT verification

```bash
curl -s localhost:8099/skin | jq .
curl -s -X POST localhost:8099/skin/set \
  -H 'Content-Type: application/json' \
  -d '{"borderStyle":"bg","borderChar":"░"}' | jq .
curl -s localhost:8099/state | jq .skin
```

## Future stories (not in this epic)

- Manual border drawing: `"heavy"` (╔╗╚╝) and `"rounded"` (╭╮╰╯) presets
- Skin picker TUI panel (visual cycling with live preview, like the theme picker)
- Per-window skin override (store `skin?` on `WindowSnapshot`)
- Shareable skin files: `.wibwob/skins/<name>.json`
