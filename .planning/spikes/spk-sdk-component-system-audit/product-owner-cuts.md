# Product Owner Cuts — Naming & Surface Coherence

## Intent

Naming is design. Third-party developers should see one clear happy path, not parallel vocabularies.

## Decisions

| Surface | Decision | Status |
|---|---|---|
| `createStatusBar` vs `createLayoutStatusBar` | prefer `createStatusBar`; keep `createLayoutStatusBar` as legacy alias | implemented in host.ui docs/types ordering |
| `createButtonBar` vs `createLayoutButtonBar` | prefer `createButtonBar`; keep `createLayoutButtonBar` as legacy alias | implemented in host.ui docs/types ordering |
| Layout stress naming | remove `(Pi)` and `-pi` suffix from app/id/command | implemented |
| SDK showcase composition | split monolith into shell + demos catalogue | implemented (`index.ts` + `demos.ts`) |
| Motion helper discoverability | elevate `tweenPingPong` + `tweenSequence` in docs/showcase | implemented |

## Remaining cuts

1. Mark `createLayout*` exports in SDK reference as legacy in one dedicated section.
2. Reduce advanced/internal export cognitive load in SDK docs (clear “not for most authors” fence).
3. Ensure all examples in docs use preferred names only.

## Anti-patterns blocked

- Introducing new alias names without migration notes.
- Publishing docs examples with mixed preferred/legacy naming.
- Growing component count without deleting overlap.
