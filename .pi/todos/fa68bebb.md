{
  "id": "fa68bebb",
  "title": "Editor cleanup 2b: extract editor coordinator from app-controller",
  "tags": [
    "architecture",
    "editor",
    "P1"
  ],
  "status": "open",
  "created_at": "2026-03-04T10:15:30.045Z"
}

Extract ~225 lines of editor open/save/save-as/dirty/render behavior from app-controller.ts into src/core/editor-coordinator.ts.\n\nDepends on TODO-5a96af81 (rename/split) landing first.\n\nFiles: src/core/app-controller.ts, new src/core/editor-coordinator.ts\nAcceptance: save/write/dirty/render logic has one coherent owner. Controller delegates to coordinator."
