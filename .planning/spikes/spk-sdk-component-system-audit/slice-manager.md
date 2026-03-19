# Slice Manager — SDK Component System Audit

Updated: 2026-03-19

Purpose: single actionable queue for the microapp triad.

## Operating model

For each slice:
1. **microapp-product-owner** defines scope + keep/cut intent.
2. **microapp-developer** ships smallest safe code change.
3. **microapp-doc-refiner** updates canonical docs only.
4. Verify with binary evidence.

---

## Active queue

### S1 — Runtime control manifest (reliability) ✅ done
- **Owner intent:** eliminate instance ambiguity and stale targeting.
- **Files (actual):** `src/services/control-api.ts`, `src/cli/wibwob.ts`.
- **Acceptance:** one canonical runtime identity source used by CLI.
- **Evidence:** `wibwob instances` now returns one canonical entry + `canonical:true`; manifest at `~/.wibwob/runtime/control-manifest.json`.

### S2 — Reload invalidator (reliability) ✅ done
- **Owner intent:** prevent mixed reload/restart states after host edits.
- **Files (actual):** `src/core/app-controller.ts`.
- **Acceptance:** `microapps.reload` warns/errors when restart-required files changed.
- **Evidence:** after `touch src/services/microapp-sdk.ts`, `wibwob cmd microapps.reload` returns `{ requiresRestart: true, blockedFiles:[...] }`.

### S3 — Crash bundle command (ops/debug) ✅ done
- **Owner intent:** one command to collect crash evidence quickly.
- **Files (actual):** `src/cli/wibwob.ts`.
- **Acceptance:** bundle includes health/instances/state/tmux tail/log tail.
- **Evidence:** `wibwob crash-bundle --out scratch/reports/crash-bundle-smoke` created expected artefacts.

### S4 — SDK legacy alias table + deprecation clarity
- **Owner intent:** third-party dev sees one preferred naming path.
- **Files (expected):** sdk-reference + microapp-sdk comments.
- **Acceptance:** preferred names explicit; legacy aliases clearly marked.
- **Evidence:** doc diff + no contradictory examples.

### S5 — Generated docs block prototype
- **Owner intent:** reduce SDK docs drift.
- **Files (expected):** small script + generated section in planning/docs.
- **Acceptance:** component inventory generated from SDK exports.
- **Evidence:** generation command + regenerated output diff.

---

## Done this sprint (already shipped)

- Layout Stress Test crash hardening + naming cleanup (`-pi` removed)
- Motion helper additions (`tweenPingPong`, `tweenSequence`)
- `toEvenCellWidth` helper for drawille/contrib safety
- SDK showcase split into smaller chunks (`index.ts` + `demos.ts`)
- Docs crispness pass (naming policy, legacy alias guidance, advanced-surface fence)

