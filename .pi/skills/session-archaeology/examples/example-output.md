# Example Output: WibWob-DOS Confusion Audit

This is real output from running the session archaeology pipeline on
645 Claude Code sessions from the wibandwob-dos project.

## Step 1: confusion-scan.py

```
$ python3 confusion-scan.py -Users-james-Repos-wibandwob-dos \
    --subsystems examples/subsystems-wibwobdos.json --top 7

Sessions scanned: 645

Rank  Subsystem                    Score   Conf   Corr  Mentions
-----------------------------------------------------------------
1     terminal-pty                    99     63     12       439
2     window-system                   86     77      3       206
3     state-and-api                   77     35     14       120
4     multiplayer                     44     35      3        90
5     scramble                        40     25      5       190
6     agent-and-llm                   30      9      7        46
7     workspace                       29      5      8        68

Session hotspots:
  score=  78 conf= 75 corr=  3  2026-02-18 4edfa7b0 (main)
  score=  71 conf= 71 corr=  0  2026-02-17 62851dd8 (main)
  score=  22 conf= 19 corr=  1  2026-02-17 1e0f3dc4 (main)
  score=  21 conf=  9 corr=  4  2026-02-22 bbc31c39 (main)
  score=  15 conf= 15 corr=  0  2026-02-15 fec5000c (main)
```

## Interpretation

Score = confusion_signals + 3x human_corrections. Corrections weighted 3x
because they mean the agent failed to self-correct AND a human had to
intervene.

Key insight: workspace has the LOWEST confusion (5) but HIGHEST correction
ratio (8 corrections / 5 confusions = 1.6). This means agents rarely
realise they're wrong about workspace — the human has to tell them. That's
the most dangerous subsystem: silent failure.

Contrast with window-system: 77 confusions but only 3 corrections. Agents
know they're confused and try to self-correct. Less dangerous per-incident
but high volume.

## Step 2: deep-analyse.py (excerpt)

```
$ python3 confusion-scan.py <slug> --json | \
    python3 deep-analyse.py --project <slug> --top 3

Analysing 3 sessions...
  [1/3] 4edfa7b0 (score=78)... Done (2341 chars)
  [2/3] 62851dd8 (score=71)... Done (1893 chars)
  [3/3] 1e0f3dc4 (score=22)... Done (1456 chars)
  Running cross-session synthesis... Done
```

The LLM analysis catches things regex misses:
- Agent in session 4edfa7b0 tried 5 variations of the same IPC fix before
  finding the actual root cause (field name mismatch in api_get_state)
- Agent in session 62851dd8 had a wrong mental model of multi-instance
  state sharing, assuming PartyKit canonical state was fresh when it was
  stale from a previous session
- Agent in session 1e0f3dc4 never understood why self-prompts routed to
  the wrong terminal — it tried workarounds instead of diagnosing the
  routing mechanism

## Step 3: qmd search for follow-up

```
$ qmd search "stale state api_get_state" -c wwdos-sessions -n 3

qmd://wwdos-sessions/2026-02-18-4edfa7b0.md #2d0076
  ...api_get_state emits "width"/"height" but create_window reads "w"/"h"...

qmd://wwdos-sessions/2026-02-15-fec5000c.md #ad95b5
  ...stale PartyKit canonical state from infinite-window-loop session...
```
