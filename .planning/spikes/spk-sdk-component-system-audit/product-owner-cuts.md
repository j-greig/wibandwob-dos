# Product Owner Cuts - Naming & Surface Coherence

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

## Remaining cuts — all done ✅

1. ✅ Mark `createLayout*` exports as legacy — `@deprecated` JSDoc added to all 6 aliases in `ui-parts.ts`; preferred/legacy table in `sdk-reference.md` complete.
2. ✅ Advanced/internal SDK fence — `@public` / `@beta` / `@internal` tags on all exports; naming policy note in sdk-reference.
3. ✅ Examples use preferred names only — verified in docs audit (S7).

## Anti-patterns blocked

- Introducing new alias names without migration notes.
- Publishing docs examples with mixed preferred/legacy naming.
- Growing component count without deleting overlap.
