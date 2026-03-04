{
  "id": "0c98ccce",
  "title": "describeState coverage checker script",
  "tags": [
    "test",
    "state",
    "P0-P1"
  ],
  "status": "open",
  "created_at": "2026-03-04T10:06:17.705Z"
}

Runtime coverage checker for describeState. This is the proof that the mandatory describeState contract (TODO-e61b1df3) is real — do BEFORE or alongside that todo.\n\nScript that:\n1. Launches or connects to running app via control API\n2. Opens each registered window type\n3. Inspects /state for each window\n4. Asserts non-empty appType and reasonable metadata shape\n5. Optionally triggers one mutable-state interaction and asserts /state changes\n\nFails when a window is missing semantic state.\n\nDifferent from the static parity checks in TODO-b525a06d — this is runtime verification.\n\nFiles: scripts/check-describe-state.ts\nAcceptance: script fails when a window type returns empty or fallback describeState."
