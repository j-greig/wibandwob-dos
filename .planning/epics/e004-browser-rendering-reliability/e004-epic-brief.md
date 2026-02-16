# E004: Browser Rendering Reliability and Quality Loop

## Objective

Harden browser rendering behavior for real-world pages and establish a repeatable quality loop (automated smoke + evidence) so regressions are caught early.

## Features

- [ ] **F1: Browser Render Policy and Mode Contract Hardening** (#50)
- [ ] **F2: Lazy Image Loading and Progressive Rendering** (#51)
- [ ] **F3: Automated Browser Smoke Harness (Known Sites)** (#52)

## Acceptance Criteria

- [ ] AC-1: Text visibility remains stable across modes on long image-heavy pages
- [ ] AC-2: Mode semantics are deterministic and test-enforced (`none`, `key-inline`, `all-inline`, `gallery`)
- [ ] AC-3: Known-site smoke harness validates browse/copy/screenshot workflows with artifacts
- [ ] AC-4: Browser regressions are detectable from one runnable command

## Status

Status: `not-started`
GitHub issue: #49
PR: —
