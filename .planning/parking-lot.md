# Planning Parking Lot

Deferred work that is intentionally out-of-scope for active execution slices.

## 2026-03-18

- **E053 / world-chat stopgap cleanup**
  - Scope parked: `src/services/world-chat-service.ts` path-guessing removal
  - Why deferred: pre-beta, non-critical to core runtime path/discovery migration
  - Resume trigger: world-chat promoted to beta-critical surface or e053-followup hardening pass
  - Desired end-state: no leaf path heuristics; world-chat consumes canonical runtime-injected instance paths
