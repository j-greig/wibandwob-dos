# Plan: Port arrange.py → desktop.arrange command

## Source
`~/Repos/wibandwob-dos-tvision/tools/arrange.py` — 7 named layout presets

## Decision: TypeScript

Presets are pure math functions. TS wins because:
- COAT: `desktop.arrange` in command-catalog → API, CLI, agent, menu all get it
- `wibwob cmd desktop.arrange --preset magazine --hero 3` is discoverable
- Bun-first — no Python dependency
- Shell math (awk floats for φ, 16:9) is ugly; TS is clean
- Presets file stays self-contained — no blessed/SDK knowledge needed

## Files

```
src/core/arrange-presets.ts    ← pure functions, no imports except types
src/core/command-catalog.ts    ← add desktop.arrange
src/core/app-controller.ts     ← handler: read state, apply preset, batch
```

## arrange-presets.ts shape

```typescript
export type WindowRect = { id: number; left: number; top: number; width: number; height: number };
export type ArrangeInput = { id: number; [key: string]: unknown }[];

export const PRESETS = ["golden","magazine","cinema","triptych","diagonal","spotlight","asymmetric"] as const;
export type Preset = typeof PRESETS[number];

export function arrange(preset: Preset, windows: ArrangeInput, dw: number, dh: number, heroId?: number): WindowRect[]
```

## CLI shape

```bash
wibwob cmd desktop.arrange --preset golden
wibwob cmd desktop.arrange --preset magazine --hero 3
wibwob cmd desktop.arrange --preset cinema --hero 7
```

## API shape

```bash
curl -X POST /commands/run -d '{"id":"desktop.arrange","args":{"preset":"cinema","hero":7}}'
```

## Preset mapping from Python

| Preset | Logic summary |
|--------|--------------|
| golden | Hero 61.8% left, rest stacked right |
| magazine | Feature 65%×65% top-left, sidebar right, footer bottom |
| cinema | Hero 16:9 centred, others fill 4 margins (top/bottom/left/right) |
| triptych | 3 equal columns, overflow as footer row |
| diagonal | Windows grow larger along diagonal bottom-right |
| spotlight | Hero 60% centred, others orbit edges |
| asymmetric | Alternating 70/30 and 30/70 rows (Swiss grid) |

## Stories

- [ ] S-A1: `src/core/arrange-presets.ts` — 7 pure preset functions, direct port from Python
- [ ] S-A2: `desktop.arrange` command in catalog + handler in app-controller
- [ ] S-A3: Wire via `/windows/batch` — handler calls `arrange()`, passes result to batch
- [ ] S-A4: `wibwob cmd desktop.arrange --preset <name>` works end-to-end
- [ ] S-A5: Menu entry under Window menu: "Arrange: Golden", "Arrange: Cinema" etc (optional, can be submenu)
- [ ] S-A6: Stretch — `desktop.arrange` as a ghostty-control script alias for the common presets

## Done criteria

- [ ] All 7 presets produce correct layouts on a 126×69 screen with 3+ windows
- [ ] `wibwob cmd desktop.arrange --preset cinema` visually matches arrange.py cinema output
- [ ] Unknown preset returns `{ ok: false, error: "unknown preset", available: [...] }`
