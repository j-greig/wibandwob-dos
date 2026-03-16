> **E042 Solid Foundations** — Slice 9 of 10
> ← Previous: [`e42-S08` Handle API Components](../e42-S08/autoresearch.md)
> → Next: [`e42-S10` File-Manager Migration](../e42-S10/autoresearch.md)
> Planning: `.planning/epics/e042-solid-foundations/e042-slices-7-10.md`

# Autoresearch: E042-S09 — Stability Annotations

## Objective

Tag every SDK export with `@public`, `@beta`, or `@internal` JSDoc so developers
and agents know what's safe to depend on. Update docs to show stability tier per
component.

## Metrics

- **Primary**: `unannotated_exports` (count, lower is better) — SDK exports in
  microapp-sdk.ts without a `@public`/`@beta`/`@internal` tag. Target: 0.
- **Secondary**:
  - `public_count` — exports tagged `@public`
  - `beta_count` — exports tagged `@beta`
  - `internal_count` — exports tagged `@internal`
  - `typecheck_seconds` — regression watch

## How to Run

`./autoresearch.sh` — outputs `METRIC name=number` lines.

## Files in Scope

| File | Change |
|------|--------|
| `src/services/microapp-sdk.ts` | Add JSDoc stability tags to all exports (~350 lines) |
| `docs/sdk-primitives.md` | Add stability tier column |
| `PHILOSOPHY.md` | Update §4 status from 🟡 to ✅ |

## Stability Tiers

| Tier | Tag | Meaning | What gets it |
|------|-----|---------|-------------|
| Stable | `@public` | Breaking changes = major version | MicroappHost, createWindow, describeState, captureText, theme types, Handle API helpers |
| Beta | `@beta` | Functional, contract may change | Newer Handle components, canvas/zine types |
| Internal | `@internal` | Host-only, not for microapps | LayoutPart API, layout engine re-exports |

## Off Limits

- Changing any export signatures
- Adding or removing exports
- Modifying component behaviour

## Constraints

- `bun run health` must pass
- Pure documentation/annotation pass — no functional changes

## What's Been Tried

_Nothing yet — depends on S08._
