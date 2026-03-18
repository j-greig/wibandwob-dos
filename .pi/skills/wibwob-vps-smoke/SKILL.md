---
name: wibwob-vps-smoke
description: >
  Legacy compatibility shim for older prompts that still call Docker/VPS smoke directly.
  Canonical smoke skill is now wibwob-hosting-smoke.
---

# WibWob VPS Smoke Skill (Legacy Shim)

> **Deprecated:** This skill is kept temporarily for backward compatibility.
> Use **`.pi/skills/wibwob-hosting-smoke`** for all new work.

## Canonical replacement

- New canonical skill: `.pi/skills/wibwob-hosting-smoke`
- Canonical runner:

```bash
bash .pi/skills/wibwob-hosting-smoke/scripts/run-smoke.sh docker-vps
```

## Shim behavior

This legacy skill now only delegates:

- `scripts/run-smoke.sh` → hosting smoke runner (`docker-vps` adapter)
- `scripts/summarize-latest-smoke.py` → hosting smoke summarizer

## Migration guidance

1. Update prompts/runbooks to call `wibwob-hosting-smoke`.
2. Keep this shim only to avoid breaking old references.
3. Do not add new logic here.

## Artifact policy

- Primary smoke artifacts belong in `scratch/captures/*`.
- Do **not** add new transient artifacts under `.pi/skills/wibwob-vps-smoke/outpts`.
- Curated long-lived evidence belongs under hosting-smoke references.

See also:
- `.pi/skills/wibwob-vps-smoke/README.nmd`
- `.pi/skills/wibwob-hosting-smoke/SKILL.md`
