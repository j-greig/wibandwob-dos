# WibWob-DOS Refactor Planning Bundle (2026-01-15)
Source thread: https://chatgpt.com/g/g-p-6813e6501d2c8191a661debb1e0f5a25-wib-wob-dev/c/69914d1d-e5ec-838e-8037-017813083eda

## Headline
Refactor WibWob-DOS into a contract-driven, append-only, local-first, multi-agent Turbo Vision OS with vault memory, containerized runtime, and optional web observability.

## Purpose
This folder is the normalized extraction of the long thread: architecture direction, prompts, quality gates, and research notes.

## Onboarding (choose one path)
### Path A: start implementation now (10 minutes)
1. `workings/chatgpt-refactor-vision-planning-2026-01-15/thread-memory-refresh.md`
2. `workings/chatgpt-refactor-vision-planning-2026-01-15/spec-state-log-vault-browser.md`
3. `workings/chatgpt-refactor-vision-planning-2026-01-15/prompts/refactor-prompt-2026-02-15.md`
4. `workings/chatgpt-refactor-vision-planning-2026-01-15/pr-acceptance-and-quality-gates.md`

### Path B: reconstruct full conversation flow
1. `workings/chatgpt-refactor-vision-planning-2026-01-15/conversation-timeline.md`
2. `workings/chatgpt-refactor-vision-planning-2026-01-15/thread-memory-refresh.md`
3. `workings/chatgpt-refactor-vision-planning-2026-01-15/prompts/refactor-prompt-2026-02-15.md`
4. `workings/chatgpt-refactor-vision-planning-2026-01-15/prompts/execution-prompts.md`

### Path C: deep research-first
1. `workings/chatgpt-refactor-vision-planning-2026-01-15/deep-research-report-turbo-vision-turbo-pascal.md`
2. `workings/chatgpt-refactor-vision-planning-2026-01-15/local-first-research-phase-a.md`
3. `workings/chatgpt-refactor-vision-planning-2026-01-15/local-first-research-phases-b-f.md`

## Bundle index
### Core context
- `workings/chatgpt-refactor-vision-planning-2026-01-15/thread-memory-refresh.md`: packed paragraph + headline.
- `workings/chatgpt-refactor-vision-planning-2026-01-15/conversation-timeline.md`: chronological map.
- `workings/chatgpt-refactor-vision-planning-2026-01-15/spec-state-log-vault-browser.md`: implementation-level spec extract.
- `workings/chatgpt-refactor-vision-planning-2026-01-15/proposed-tree-structure.md`: canonical repo tree proposal.

### Prompt pack
- `workings/chatgpt-refactor-vision-planning-2026-01-15/prompts/refactor-prompt-2026-02-15.md`: canonical refactor prompt.
- `workings/chatgpt-refactor-vision-planning-2026-01-15/prompts/execution-prompts.md`: 4 operational prompts + meta-prompt.

### Engineering gates
- `workings/chatgpt-refactor-vision-planning-2026-01-15/pr-acceptance-and-quality-gates.md`: PR checklist, tests, CI/hook strategy.

### Research extracts
- `workings/chatgpt-refactor-vision-planning-2026-01-15/deep-research-report-turbo-vision-turbo-pascal.md`: TVision/Turbo Pascal synthesis.
- `workings/chatgpt-refactor-vision-planning-2026-01-15/local-first-research-phase-a.md`: local-first Phase A (Obsidian).
- `workings/chatgpt-refactor-vision-planning-2026-01-15/local-first-research-phases-b-f.md`: local-first Phases B-F.
- `workings/chatgpt-refactor-vision-planning-2026-01-15/research-prompts-ranked.md`: ranked deep-research backlog.

### Audit/meta
- `workings/chatgpt-refactor-vision-planning-2026-01-15/coverage-audit.md`: overlap/omission audit.
- `workings/chatgpt-refactor-vision-planning-2026-01-15/known-gaps.md`: requested-but-not-fully-emitted artifacts.
- `workings/readme-research.md`: related README/philosophy research outside this bundle.

## Notes
- Local-first research is intentionally split: read `local-first-research-phase-a.md` then `local-first-research-phases-b-f.md`.
- Final local-first scope was local-first only.
- No `/thinking/` directory exists in this checkout; all extracted artifacts are under `workings/`.
