{
  "id": "322dbfbe",
  "title": "4. Broader host → microapp migration (beyond proof microapps)",
  "tags": [
    "refactor",
    "architecture"
  ],
  "status": "open",
  "created_at": "2026-03-14T20:45:20.942Z"
}

Migrate host-owned built-ins from `src/windows/` to proper microapps under `microapps/`.

Full mapping, classification, and migration order:
`X-CODEX-REFACTOR/host-to-microapp-migration-map.md`

12 candidates ranked by complexity. Migration pattern is COAT-compliant:
scaffold → extract → SDK-only imports → manifest commands → verify parity → delete old file.

Command parity checklist included per migration.
