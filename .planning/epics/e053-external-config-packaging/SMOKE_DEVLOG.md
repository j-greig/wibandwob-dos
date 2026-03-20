## 20260318-210532 — docker-vps-smoke
- report: /Users/james/Repos/wibandwob-dos/scratch/captures/docker-vps-smoke-20260318-210532/report.md
- jsonl: /Users/james/Repos/wibandwob-dos/scratch/captures/docker-vps-smoke-20260318-210532/checks.jsonl
- pass: 24, fail: 4
- note: initial full smoke run; exposed duplicate-instance CLI ambiguity and restart/persistence rough edges

## 20260318-211345 — docker-vps-smoke
- report: /Users/james/Repos/wibandwob-dos/scratch/captures/docker-vps-smoke-20260318-211345/report.md
- jsonl: /Users/james/Repos/wibandwob-dos/scratch/captures/docker-vps-smoke-20260318-211345/checks.jsonl
- pass: 28, fail: 2
- note: figlet font inventory check included (known VPS gotcha)

## 20260318-211545 — docker-vps-smoke
- report: /Users/james/Repos/wibandwob-dos/scratch/captures/docker-vps-smoke-20260318-211545/report.md
- jsonl: /Users/james/Repos/wibandwob-dos/scratch/captures/docker-vps-smoke-20260318-211545/checks.jsonl
- pass: 28, fail: 2
- note: pipefail + instance-id targeting improvements applied
## 20260318-213521 — docker-vps-smoke
- report: /Users/james/Repos/wibandwob-dos/scratch/captures/docker-vps-smoke-20260318-213521/report.md
- jsonl: /Users/james/Repos/wibandwob-dos/scratch/captures/docker-vps-smoke-20260318-213521/checks.jsonl
- pass: 33, fail: 0
- critical_fail: 0, informational_fail: 0
- note: figlet font inventory check included (known VPS gotcha)

## 20260318-213835 — docker-vps-smoke
- report: /Users/james/Repos/wibandwob-dos/scratch/captures/docker-vps-smoke-20260318-213835/report.md
- jsonl: /Users/james/Repos/wibandwob-dos/scratch/captures/docker-vps-smoke-20260318-213835/checks.jsonl
- pass: 33, fail: 0
- critical_fail: 0, informational_fail: 0
- note: figlet font inventory check included (known VPS gotcha)

## 20260318-221034 — docker-vps-smoke
- report: /Users/james/Repos/wibandwob-dos/scratch/captures/docker-vps-smoke-20260318-221034/report.md
- jsonl: /Users/james/Repos/wibandwob-dos/scratch/captures/docker-vps-smoke-20260318-221034/checks.jsonl
- pass: 33, fail: 0
- critical_fail: 0, informational_fail: 0
- note: figlet font inventory check included (known VPS gotcha)
- hardening: dynamic local ports (ssh+tunnel), api-ready failure taxonomy, one-shot tmux remediation
- hardening: CLI duplicate-instance dedupe improved (canonical identity key)

## 20260318-224339 — fly-external-smoke
- report: /Users/james/Repos/wibandwob-dos/scratch/captures/fly-smoke-20260318-224339/report.md
- jsonl: /Users/james/Repos/wibandwob-dos/scratch/captures/fly-smoke-20260318-224339/checks.jsonl
- pass: 7, fail: 0
- checks: health/help/commands/runtime-inspection/screenshot-text/screenshot-ansi + cold-start timing sample
- cold-start sample: request1=0.124s, request2=0.172s

