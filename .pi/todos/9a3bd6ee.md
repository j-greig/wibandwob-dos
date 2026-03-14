{
  "id": "9a3bd6ee",
  "title": "2. Agent-friendly microapp dev loop (025 follow-on) — no overselling hot reload",
  "tags": [
    "refactor",
    "dx"
  ],
  "status": "open",
  "created_at": "2026-03-14T20:45:20.935Z"
}

Continue `.planning/refactor-docs/025-agent-friendly-microapp-dev-follow-on.md`. Improve the watch/reload/restart dev loop for microapp authors. Key constraint: don't oversell hot reload — the safe path is restart+reopen, not arbitrary stateful hot-swap.
