# README Improvement Prompt

Use this prompt with an LLM (Claude, GPT-4, etc.) to transform `docs/readme-stub.md` into a world-class developer README for WibWob-DOS.

---

You are improving the root `README.md` for the WibWob-DOS repository.

Goal: transform the existing stub README into a production-grade developer README that is concise, technically rigorous, and aligned with shipped work from E001–E008.

Hard constraints:
- Keep the symbient framing accurate: coinhabitation, not "assistant tooling."
- Do not invent features beyond E001–E008 status.
- Reflect current reality:
  - E001 done: unified command registry + parity tests.
  - E002 done: browser/state export, figlet/image modes, MCP browser tools.
  - E003 done: dark pastel theme surface.
  - E004 not started (stub/hardening plan).
  - E005 not started (theme runtime wiring gaps).
  - E006 in progress (Scramble TUI presence).
  - E007 infrastructure largely implemented (room config/orchestrator/auth/layout/IPC safety).
  - E008 in progress (PartyKit multiplayer; Python bridge path active; cursor overlay stretch).
- Tone: direct, engineering-first, no marketing fluff.

Deliver a complete README with these sections (in this order):

1. Title + one-line value proposition.
2. Badges row.
3. "What WibWob-DOS Is" (symbient model, short).
4. "Why It's Different" (bullet list of unusual architecture/UX constraints).
5. Screenshots/GIF section with placeholders and alt text.
6. Quick Start (build/run/API).
7. Architecture:
   - one high-level ASCII diagram
   - one mermaid diagram for runtime surfaces (C++ app, IPC, Python API, optional PartyKit bridge)
8. Repository map (important directories only).
9. Feature status summary by epic E001–E008 (table: epic, outcome, key shipped artifacts, status).
10. Key developer commands:
    - build
    - run
    - API smoke
    - contract tests
    - multi-instance launch
    - (optional) room orchestrator / PartyKit local dev commands if available
11. API + MCP reference pointers:
    - where to find endpoints/tools in repo
    - state schema location
12. Testing and quality gates:
    - parity philosophy
    - AC → Test traceability expectation
13. Contributing workflow:
    - issue-first
    - branch-per-issue
    - planning brief sync requirements
14. Roadmap snapshot:
    - near-term from E004/E005/E006/E008
    - clearly mark "planned" vs "in progress"
15. License / credits placeholders if license file is absent.

Formatting requirements:
- Use clear Markdown headings.
- Keep paragraphs short.
- Use tables only where they improve scan speed.
- Add copy-paste-ready command blocks.
- Include explicit links to in-repo files (relative paths).
- Include a compact "Known Gaps" section with E005/E008 caveats.
- Avoid unsupported claims like "production-ready multiplayer" if still in-progress.

Badge guidance:
- Add placeholders for build/tests/license/status with conventional shields.io format.
- If exact CI workflow names are unknown, use TODO comments in markdown and safe placeholders.

Screenshot guidance:
- Use existing `screenshots/` assets if discoverable; otherwise provide clearly marked placeholders
  with expected filenames and capture notes.

Architecture guidance:
- Mention command registry as single source.
- Mention ANSI rendering guardrail (parse to cell grid, never raw ANSI into draw buffer).
- Mention Python as bridge/mirror, C++ as state authority.

Output requirements:
- Return only final README markdown.
- No commentary.
- No TODO prose outside intentional markdown TODO markers.
