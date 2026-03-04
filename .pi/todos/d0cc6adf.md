{
  "id": "d0cc6adf",
  "title": "Decouple state sync from disk persistence",
  "tags": [
    "architecture",
    "state",
    "priority-b"
  ],
  "status": "closed",
  "created_at": "2026-03-04T09:41:36.722Z"
}

syncState() in app-controller.ts calls updateStatusLine() which calls state.sync(), then syncState() calls state.persistAndNotify(). This rebuilds state twice and persists to disk on every drag/resize/typing event.\n\nFix: split cheap live sync (sync() for routine UI mutation) from expensive persistence (persistAndNotify() for explicit checkpoints like workspace save, theme change, mode change).\n\nFiles: src/core/app-controller.ts, src/services/state-service.ts
