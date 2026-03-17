---
name: ww-primitives
description: Maintain the generated WibWob-DOS primitives index for shared reusable exports. Use when adding or updating shared building blocks that should be imported from src/core/primitives.ts.
---

# WibWob Primitives

`src/core/primitives.ts` is the generated single import surface for reusable shared building blocks. It exists so microapps and agents can discover common pieces from one place instead of chasing individual source files.

Use this import path in microapps:

```ts
import { createScrollbar, theme, createPreRenderedPlayer } from "../../src/core/primitives.js";
```

## Rules

- Never hand-edit `src/core/primitives.ts`.
- Tag exports at the definition site, then regenerate the index.
- Do not batch-tag old files casually; add `@primitive` when the export is intentionally being established as shared API.
- Only tag shared building blocks. Do not tag window-specific logic, one-off helpers, or app wiring.

## What Counts As A Primitive

- Shared UI primitives
- Shared theme primitives
- Shared sizing and measurement primitives
- Shared animation/runtime helpers
- Types that belong to those shared building blocks

Not primitives:

- Window-local behavior
- Controller orchestration
- Service internals that are not intended as reusable API

## How To Add One

1. Add `/** @primitive */` immediately above the exported definition.
2. Keep the tag on the actual export definition site: `export function`, `export const`, `export class`, `export interface`, or `export type`.
3. Regenerate the index:

```bash
bun run gen-primitives
```

4. Typecheck:

```bash
bun run typecheck
```

## Generator

The generator lives at `scripts/gen-primitives.ts`. It scans `src/` for exports tagged with `@primitive` and emits grouped re-exports into `src/core/primitives.ts`.
