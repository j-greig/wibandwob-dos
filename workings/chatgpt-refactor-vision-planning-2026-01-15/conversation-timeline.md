# Conversation Timeline (Ordered)

1. Started with terminal practicality: Turbo Vision/tvision apps in `tmux` are viable with TERM/key/mouse caveats.
2. Shifted to repo understanding: high-level grok of `wibandwob-dos` architecture (Turbo Vision UI + FastAPI/MCP control plane).
3. Discussed integrating with `wibandwob-backrooms-tv`: recommended sidecar orchestration over C++ embedding.
4. Explored "how hard" a full C++ TUI port of Backrooms-TV would be (medium-hard to hard, depending on parity).
5. Main refactor problem introduced: API/MCP parity drift vs menu commands.
6. Proposed fix: C++ command/capability registry as single source of truth; API/MCP capability-driven tool generation.
7. Menu consolidation goal: separate everyday features from experimental/lab features.
8. Expanded into future capability design: layout DSL, multi-agent desktop, timeline/replay, semantic windows, constraints/policy.
9. Added feature canvas: state export as logging/reboot/clone + markdown/ANSI browser micro-app spec.
10. Architecture review pass: refactor now (before feature growth), not rewrite; ports/adapters layering.
11. Open-source/canon repo direction: branch/PR workflow, contributor docs, skill files.
12. Proposed and reviewed multiple canonical repo tree variants.
13. Produced upgraded master prompts (v1 -> v2 -> v3) to drive full architecture/refactor work via coding agents.
14. Added explicit support goals: no-repo-install runtime (container/self-host), hosted instances, optional web viewer.
15. Added multi-agent + vault concepts inspired by HedgyOS-like patterns.
16. Discussed ingesting Turbo Pascal/Turbo Vision docs into curated Markdown for skills (not raw OCR dump).
17. Generated PR acceptance checklist + CI/test/hook guidance.
18. Generated ranked deep-research topics aligned to symbient goals.
19. User selected: phase-zero sequence + manifesto + Obsidian/local-first research thread.
20. Course-corrected research scope: local-first only required; local-first memory substrate focus only.
21. Deep synthesis delivered manually: Obsidian + Logseq + Zettelkasten + local-first + encryption models -> WibWob vault/oslog implications.
22. Added actionable prompt set: 4 execution prompts + meta-prompt for generating future prompts.
23. Produced thread summaries: structured summary, single packed paragraph, and final 20-word headline.
