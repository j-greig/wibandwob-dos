# Spec Extract: State Log, Vault, Browser

## Core invariants (from thread)
- C++ engine is authoritative for state.
- Menu, IPC, API, and MCP all execute the same command surface.
- Commands/capabilities are registry-driven and schema-defined.
- Events are append-only and actor-attributed.
- Snapshots are deterministic and replay/importable.
- Vault is durable human-readable substrate; engine is replaceable.
- Graph/index layers are derived, not canonical.

## State export as logging/reboot/clone
Minimum schema direction discussed:

```json
{
  "version": "1",
  "timestamp": "2026-02-15T04:12:00Z",
  "canvas": { "w": 120, "h": 36 },
  "pattern_mode": "continuous",
  "windows": [
    {
      "id": "w1",
      "type": "text_editor",
      "title": "Notes",
      "rect": { "x": 2, "y": 1, "w": 60, "h": 18 },
      "z": 3,
      "focused": true,
      "props": {}
    }
  ]
}
```

Suggested APIs discussed:
- `get_state`
- `save_workspace` / `open_workspace`
- `export_state(path, format=json|ndjson)`
- `import_state(path, mode=replace|merge)`
- optional `state_diff(a,b)` and replay endpoints later

## oslog.md as symbient micro-OS log
Model agreed in thread:
- Single Markdown file is valid as a projection layer.
- Frontmatter for identity/pointers.
- Machine blocks in fenced JSON/YAML/NDJSON.
- Human reflection section retained.
- Append-friendly, parseable, human-readable.

Suggested shape:

````markdown
---
type: symbient_state_log
format: wibwob-oslog@1
instance_id: alpha-001
created: 2026-02-15T06:30:00Z
engine_version: vNext-0.3
snapshot_latest: snapshots/2026-02-15T06:42:10Z.json
event_seq: 1842
hash_chain: blake3
---

## Actors
```yaml actor_registry@1
human:
  id: james
agents:
  - id: wob
  - id: wib
```

## Events
```ndjson events@1
{"seq":1842,"ts":"2026-02-15T06:42:10Z","actor":"system","cmd":"snapshot.export"}
```

## Reflections
Narrative continuity and unresolved threads.
````

Important boundary from thread:
- oslog should not be sole operational source of truth.
- authoritative runtime state stays in engine + snapshot/event contracts.

## Vault model (local-first scope)
Directory shape discussed:

```text
instance/
  vault/
    journal/
    conversations/
    artifacts/
    reflections/
  oslog.md
  events/
  snapshots/
  instance.json
```

Key rules:
- Local-first, offline-first, tool-independent readability.
- Append-only event discipline.
- Multi-agent writes are attributed.
- Prefer minimal file format complexity.

## Markdown/ANSI browser micro-app
Intent:
- Retro browser window: HTML -> readable markdown/TUI text.
- Optional key image conversion to ANSI/Unicode art blocks.
- Link navigation + history + find + mode toggles.

Proposed window props:
- `url`
- `history[]`, `history_index`
- `scroll_y`
- `render_mode` (plain/figlet variants)
- `image_mode` (none/key/all)
- `cache_policy`

Proposed command/API set:
- `browser.open`
- `browser.back`
- `browser.forward`
- `browser.refresh`
- `browser.find`
- `browser.set_mode`

Render bundle concept:
- markdown/tui text
- numbered links
- optional ANSI image blocks near content points

## Hosted/self-hosted future compatibility
Architecture direction in thread:
- same core for both hosted instances and local one-command runtime.
- containerized runtime as no-repo-install path.
- optional web viewer as observer first, co-control later.
