# F6 Plumb — Comprehensive Cross-App Testing

## Objective

Stress-test `wibwob plumb --from <id> --to <id>` across every writable
destination and diverse source types. Prove plumb works for the full
matrix, not just figlet↔figlet.

## Primary Metric

`plumb_score` — sum of pass/fail behaviour checks (0–100).

Higher is better. Each check is binary.

### Writable destinations (via fallback chain)

| App | Command | Fallback |
|-----|---------|----------|
| figlet-banner | microapp.wibwob.figlet.write | canonical |
| terminal | microapp.wibwob.terminal.write | canonical |
| journal | microapp.wibwob.journal.create | create fallback |
| chatroom | microapp.wibwob.chatroom.send | send fallback |

### Readable sources (any window with captureText)

| App | Type | Notes |
|-----|------|-------|
| figlet-banner | text display | ASCII art output |
| contour-studio | generative | ASCII terrain |
| runtime-inspector | dashboard | system state text |
| poetry-clock | generative | time-based poetry |
| heartbeat | animation | ASCII pulse |

### Scoring Breakdown

| Feature | Points | Checks |
|---------|--------|--------|
| Figlet as dest | 15 | contour→figlet (5), inspector→figlet (5), figlet→figlet (5) |
| Terminal as dest | 15 | figlet→terminal (5), contour→terminal (5), text received (5) |
| Journal as dest | 15 | figlet→journal creates entry (5), contour→journal (5), entry count increases (5) |
| Chatroom as dest | 10 | command exists for send (5), chatroom.send reachable (5) |
| Error cases | 15 | plumb to plasma (read-only dest) fails (5), plumb from missing window (5), plumb to missing window (5) |
| Read-only sources work | 15 | contour readable (5), inspector readable (5), poetry-clock readable (5) |
| CLI & typecheck | 15 | help shows plumb (5), typecheck (5), no new endpoints (5) |

## Constraints

- Clear desktop before each run
- Each source/dest pair tested independently
- No new API endpoints
- `bun run typecheck` must pass
