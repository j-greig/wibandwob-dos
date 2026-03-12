# Chore: Restructure .agents/ for audience signposting

## What this is

The `.agents/` directory mixes shell-maintainer docs with module-author
docs in a flat structure. New agents building modules read irrelevant
shell internals before finding what they need. This chore proposes a
restructure that makes the right doc findable from the filepath alone.

## The proposal

Split `.agents/` into `module-dev/` and `shell-dev/`. Reorder AGENTS.md
so module authoring comes first. Fix the dead link, deduplicate content,
surface persistence docs, add tiered examples guide.

See `v2-design-notes.md` for full rationale and reading paths.
See `v2-proposed-docs.png` for the visual diagram.

## Status

PROPOSAL — nothing has been moved or created yet.

## Files

```
README.md                            ← you are here
v2-design-notes.md                   ← the proposal (read this)
process-note-planning-hygiene.md     ← how we organised this directory (reusable pattern)
diagrams/
  v2-proposed-docs.png               ← visual diagram of proposed structure
  v2-proposed-docs.mmd               ← mermaid source
  claude-exploration.png             ← how Claude navigated the current docs
  codex-exploration.png              ← how Codex navigated the current docs
  *.mmd                              ← mermaid sources for above
evidence/
  01-claude-devlog.md                ← Claude's cold exploration of the repo
  02-codex-devlog.md                 ← Codex's cold exploration of the repo
  03-comparison.md                   ← side-by-side findings
  04-exploration-trees-ascii.md      ← ASCII tree versions of the diagrams
```
