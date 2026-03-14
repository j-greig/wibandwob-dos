## Agent Runtime Efficiency Benchmark Follow-On

Status: parked
GitHub issue: —
PR: —

## Why This Exists

The refactor preserved text-first capture, CLI/API parity, and the terminal
microapp path. A later tooling pass should measure whether running an agent in:

1. a normal host terminal (for example Ghostty)
2. the WibWob terminal microapp

has meaningful runtime cost differences.

The goal is not premature optimisation. The goal is to make later decisions
with real measurements instead of intuition.

## Benchmark Matrix

Agents:

- Pi agent
- Claude Code agent

Environments:

- Ghostty / normal host terminal
- WibWob terminal microapp

## Metrics

Collect at minimum:

- RSS and, where available, PSS
- idle memory after startup settles
- peak memory during a representative coding task
- CPU while streaming/tool-calling
- startup latency to first ready prompt
- end-to-end command latency for a small fixed task

## Suggested Method

1. define one stable no-op/low-noise task and one representative real task
2. run each task in each matrix cell at least 3 times
3. capture process metrics at:
   - idle
   - active peak
   - post-task settle
4. write results to a machine-readable artifact plus a short interpretation note

## Tooling Ideas

- `ps`, `top`, `htop`, or `psrecord`
- process-tree capture so host shell overhead is visible
- text-first task logs plus optional PNG/visual evidence only if layout matters

## Activation Conditions

Start this after:

- the refactor is considered stable
- the terminal microapp path is reliable enough for repeated runs
- agent startup/task flows are reproducible
