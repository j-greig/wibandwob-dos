## ✅ DONE — skill index doc (100/100, 5 runs)
Generator at `scripts/gen-skills-doc.py`, output at `docs/skills.md`.
Run `python3 scripts/gen-skills-doc.py` to regenerate.

## Future benchmark extensions (if a new autoresearch loop is started here)
- `overlap` dimension: penalise trigger phrases shared across > 2 skills (routing ambiguity) — verified 0 overlap in current output
- `stale_flag` dimension: verify skills unused > 14d have ⚠️ in their entry — generator already emits this
- `body_accuracy` dimension: verify role label words appear in the actual SKILL.md body
