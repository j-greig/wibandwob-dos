# Devlog — Mon 17 Mar 2026

## Self-reflections this session

### Agents default to curl instead of `wibwob` CLI
AGENTS.md presented CLI and API as equals. All child doc examples use curl.
Fixed: CLI is now front-and-centre, API is a footnote. Child docs still need updating.

### Branch/worktree sprawl was invisible until it hurt
100 branches, 18 worktrees, 14GB. No single command showed the problem.
Built: git-census.sh, planning-close.sh, list-docs.sh, devlog.sh, repo-hygiene skill.

### Directory names are progressive disclosure
`.agents/` tells you nothing. Agent-facing scripts in `scripts/` are invisible to agents looking in `.agents/`.
Idea: rename to something self-describing. Explore during restructure.

### Multi-agent delegation works for data-heavy audits
Planning session scanned 243 files, found 3 dupe IDs and 18 stale items I'd have missed.
Pattern: delegate the scan, keep the judgment.

### Devlog entries should be self-reflection, not changelog
First entries were "06:26 — Phase 4 done." That's a commit message. Git records what happened.
Devlog records: pain → why it keeps happening → what would prevent it.
