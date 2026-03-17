# scripts/

`bash scripts/list-scripts.sh` for the full index with descriptions.

## Structure

- **root** — daily ops: ensure-running, restart, reload, discover, devlog, git-census
- **checks/** — pre-commit validation: COAT, themes, describe-state, primitives gen
- **testing/** — runtime verification: CLI parity, API tests, layout sweep, flow checks
- **lib/** — shared bash utilities (sourced by other scripts)
- **fx/** — Unix pipe visual effects
- **experimental/** — parking lot prototypes
- **.archive/** — deprecated, don't use
