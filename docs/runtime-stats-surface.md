# Runtime stats surface

## TL;DR

Start WibWob-DOS with `--stats` to show a small shell badge with live render,
memory, and agent activity numbers. Use `GET /runtime/stats` when you want the
same data as structured JSON for evidence, smoke notes, or benchmark capture.

## How to turn it on

CLI:

```bash
bun run start --stats
```

Example alternate instance:

```bash
CONTROL_API_PORT=8100 SCRATCH_DIR=scratch/a1b WIBWOB_INSTANCE_LABEL=a1b bun run start --stats
```

## What the shell badge means

Example badge:

```text
0fps 0ms 225M AG off
12fps 83ms 233M AG 4m/1t
9fps 111ms 240M AG stream 6m
```

Fields:

- `fps` — shell-level render frames per second from `src/core/render-monitor.ts`
- `ms` — rolling average frame time in milliseconds for the same shell render loop
- `M` — resident memory size in megabytes (`process.memoryUsage().rss`)
- `AG off` — no active Wib&Wob Agent session in the app
- `AG 4m/1t` — agent session present, with 4 transcript messages and 1 tool-run block recorded
- `AG stream 6m` — agent session is currently streaming and has 6 transcript messages so far

## Structured endpoint

```bash
curl -sf http://127.0.0.1:8099/runtime/stats | python3 -m json.tool
```

Shape:

```json
{
  "ok": true,
  "stats": {
    "render": {
      "fps": 0,
      "avgFrameMs": 0,
      "totalFrames": 0
    },
    "rssMb": 225,
    "heapUsedMb": 67,
    "agent": {
      "active": false,
      "streaming": false,
      "messageCount": 0,
      "toolRunCount": 0,
      "status": "Ready."
    }
  }
}
```

## Current blind spots

- The badge is intentionally tiny. It is an operator hint, not a full profiler.
- Idle scenes can legitimately show `0fps` if nothing is re-rendering.
- Service-local metrics such as Monster Cam worker FPS are not yet folded into
  the shell badge.
- Recursive terminal smoke can currently degrade before a meaningful nested run
  begins if the terminal module is not healthy in the current environment.

## Recursive smoke results

After fixing the terminal module (spawn-helper permissions, onInput wiring):

- outer instance on port 8102, nested instance boots on port 8103 inside a
  terminal window
- both /health and /runtime/stats respond at both depth levels
- stats badge visible in both outer and nested menu bars
- agent message counts change correctly through the API at both levels
- keyboard input from the human does not reach the terminal widget (blessed
  focus path issue, pre-existing and out of scope for S08)
- API-driven input via /windows/input works for automation

Evidence: `scratch/evidence/e033-s08-recursive-smoke.md`
