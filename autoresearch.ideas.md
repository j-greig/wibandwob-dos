## Generator quality (no score gain, but maintainability)
- EXTRA_TRIGGERS hardcoding is a smell — img-to-ascii and joan-stark have sparse frontmatter
- Fix: read skill body text (beyond frontmatter) as a trigger source when description yields < 3
- Would make generator fully self-maintaining for any future sparse-description skills

## Benchmark extension ideas (if score ceiling needs raising)
- Add `overlap` dimension: penalise trigger phrases shared across > 2 skills (routing ambiguity)
- Add `body_accuracy` dimension: verify role label words appear in the actual SKILL.md body
- Add `stale_flag` dimension: skills unused > 14 days must have ⚠️ in their entry
