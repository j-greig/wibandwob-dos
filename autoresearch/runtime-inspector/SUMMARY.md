# Runtime Inspector — Autoresearch Summary

## TL;DR

22 experiments took the Runtime Inspector from a plain text dump (3.8/10) to a
full hacker dashboard (10/10) in a single afternoon. The biggest wins were the
two-column grid layout, reactive figlet banner, system health bar, and full-width
windows table. Design steered by Tufte (data-ink ratio), Swiss modernism (grid,
whitespace), and The Designers Republic (bold, geometric). Every change was
typecheck-gated and hot-reloaded without restarting the app.

## Scorecard

```
 #  Score  Delta   What
 ── ─────  ──────  ─────────────────────────────────────────────────────
  1   3.8     —    Baseline: plain text dump, no structure
  2   5.8  +52.6%  Box-drawing sections, sparklines, progress bars
  3   6.4  +68.4%  Figlet INSPECT banner, spinning refresh indicator
  4   6.6  +73.7%  Key-value column separator │
  5   6.6    —     Tufte cleanup: sparklines out of overview, into Stats
  6   6.8  +78.9%  Taller window (58 rows), leaner header, dotted footer
  7   7.2  +89.5%  Tab underline indicator ▀, delta arrows ▲▼
  8   7.4  +94.7%  Human-readable uptime (1h 17m), focused window ▸
  9   7.6 +100.0%  Two-column layout: Identity + Desktop side by side
 10   8.0 +110.5%  Full 2x2 grid: Health + Agent side by side
 11   8.2 +115.8%  Two-column layout on ALL tabs
 12   8.4 +121.1%  Dynamic memory bar ceiling, namespace summary
 13   8.6 +126.3%  Status pulse in footer (nominal/agent active/high mem)
 14   9.0 +136.8%  Compact windows table + UI one-liner in Overview
 15   9.0    —     Renamed panel to WIB&WOB AGENT
 16   9.0    —     Multi-condition pulse, Stats tab memory ceiling
 17   9.2 +142.1%  Reactive figlet banner: INSPECT / ACTIVE / ALERT
 18   9.4 +147.4%  System health bar: composite progress bar + percentage
 19   9.6 +152.6%  Full-width double-line windows table (118 cols)
 20   9.6    —     Commands tab namespace histogram
 21   9.8 +157.9%  Double-line border ╔═╗, health label GOOD/FAIR/WARN
 22  10.0 +163.2%  Mnemonic quick-jump keys o/u/w/c/s
```

## Axes Breakdown (final)

```
 Axis            Start   End   Key Moment
 ──────────────  ─────   ───   ─────────────────────────────────
 Layout             4     10   Two-column grid (#9), full-width table (#19)
 Readability        5     10   Column separator (#4), health bar (#18)
 Structure          4     10   Box-drawing (#2), double-line hierarchy (#21)
 Interactivity      3     10   Delta arrows (#7), jump keys (#22)
 Character          3     10   Figlet banner (#3), reactive banner (#17)
```

## Design Principles That Worked

  1. Two-column grids use the full window width instead of stacking everything
  2. Four levels of visual hierarchy via box-drawing weight:
     double-line > single-line > dotted > plain text
  3. Reactive elements (banner word, health bar, delta arrows) make static
     dashboards feel alive
  4. Composite scores (system health %) give instant assessment without
     reading individual metrics
  5. Mnemonic keybindings (first letter of tab name) are the cheapest
     interactivity win
  6. Full-width tables for data, half-width panels for metadata
  7. Sparklines belong in dedicated views, not crammed into key-value lines
  8. Dynamic bar ceilings auto-scale to prevent misleading overflow

## Files

  microapps/runtime-inspector/index.ts    685 lines (was ~180 at baseline)
  autoresearch/runtime-inspector/
    autoresearch.md                       rubric + what's been tried
    autoresearch.sh                       benchmark script
    autoresearch.checks.sh                typecheck gate
    autoresearch.ideas.md                 remaining ideas backlog
    autoresearch.jsonl                    raw experiment data
    SUMMARY.md                            this file
