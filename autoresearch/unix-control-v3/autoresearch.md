# Unix Control v3 — Autoresearch Brief

Two tracks: infrastructure hardening and creative tooling.
Primary metric: completion count across 10 backlog items.
Score each 0 or 1. Graduate when 7+ done.

## Scoring Rubric

| # | Item | Test method | Score |
|---|------|-------------|-------|
| A1 | Full Zod schema coverage | >80% of arg-accepting api:true commands have params | 0/1 |
| A2 | Unix socket transport | CLI connects via socket when available | 0/1 |
| A3 | Virtual filesystem spike | read-only FUSE mount serves /wibwob/state | 0/1 |
| A4 | _apiCall guard full coverage | all interactive-fallback commands guarded | 0/1 |
| B1 | breed.py exists and works | breed two text files, output is valid | 0/1 |
| B2 | Window-as-pixel mosaic script | script opens grid of tiny windows | 0/1 |
| B3 | Per-window chromeless mode | window.set_chrome --mode none works | 0/1 |
| B4 | Screenshot region crop | wibwob screenshot --region works | 0/1 |
| B5 | ascii-fx as commands | fx.bloom etc registered in catalog | 0/1 |
| B7 | JGSBREEDER pipeline | script breeds two jgs pieces end-to-end | 0/1 |

## Graduation

Primary metric >= 7. B1 (breed.py) is highest priority — unlocks B7.
A3 (FUSE) is spike-only — counts if read-only mount works at all.
