{
  "id": "0c98ccce",
  "title": "describeState coverage checker script",
  "tags": [
    "test",
    "state",
    "P0-P1"
  ],
  "status": "closed",
  "created_at": "2026-03-04T10:06:17.705Z"
}

DONE. Runtime coverage checker at scripts/check-describe-state.ts.\n\nCovers 12 window types openable via control API:\n- editor, figlet, art, companion, primer-browser, file-manager, primer-gallery,\n  music-player, monster-cam, palette, inspector, workspace\n\nFor each: opens via API, inspects /state, asserts non-empty appType matches expected,\nchecks details object is populated. Cleans up test windows afterward.\n\nRequires app running on port 8099. Usage: bun run scripts/check-describe-state.ts\n\nExcludes primer-viewer (needs a real primer path), backrooms-tv (needs model),\nchrome-browser (needs external service), wibwob-agent (expensive to spin up).\nThose can be added as the smoke harness matures."
