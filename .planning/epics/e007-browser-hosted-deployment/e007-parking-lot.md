# E007 Parking Lot

Items deferred from MVP. Revisit after core room serving works.

## Parked

| Item | Original feature | Why parked | Revisit when |
|------|-----------------|------------|--------------|
| Twitter OAuth | F3 (original brief) | Kills MVP velocity, not needed for local/demo rooms | Multi-user public deployment |
| State persistence | F5 (original brief) | Chat history + desktop state serialisation across disconnects | After rooms serve reliably |
| Rate limiting | Open question | 20 msg/visitor/hour — needs visitor identity first | After auth layer ships |
| Multi-visitor model | Open question | Shared cursor is ttyd default, unclear if feature or bug | After single-visitor works |
| Room creation wizard | Open question | CLI wizard adds 2+ days, hand-authored YAML is fine for V1 | After YAML config proves out |
| X11-style auth | Design discussion | Full X authority model is overkill for socket-local IPC | If network transport needed |

## Rules

1. Every item links back to its origin (epic brief, issue, or discussion).
2. Items stay parked until explicitly promoted via `/backlog` or new feature dir.
3. Do not mention parked items in MVP acceptance criteria.
