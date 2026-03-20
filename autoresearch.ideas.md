
## Skill index doc (like gstack's docs/skills.md)
- Skill bloat is a real problem — skills accumulate, LLM router picks wrong ones, stale skills mislead
- gstack has a single `docs/skills.md` that maps every skill to a role, phase, and "does NOT" boundary
- We need an equivalent: one scannable doc listing every `.pi/skills/` entry with trigger phrases, does/does-not, and last-used date
- Could be generated from skill frontmatter + usage-last-seen.json
- Makes the consolidation decisions from the spike (`autoresearch` + `autoresearch-create` merge, chiptune family merge etc.) visible and auditable
- Reference: https://raw.githubusercontent.com/garrytan/gstack/refs/heads/main/docs/skills.md
