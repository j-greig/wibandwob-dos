# F01: Room Config Format

## Parent

- Epic: `e007-browser-hosted-deployment`
- Epic brief: `.planning/epics/e007-browser-hosted-deployment/e007-epic-brief.md`

## Objective

Room configs are markdown files with YAML frontmatter. Settings (port, instance ID, layout path, max visitors) live in frontmatter. Rich content (system prompt, primers, welcome message) lives in markdown sections. The orchestrator (F02) parses both layers to spawn rooms.

## Format

```markdown
---
room_id: scramble-demo
display_name: Scramble Cat Demo
instance_id: 1
ttyd_port: 7681
layout_path: workspaces/scramble-demo.json
api_key_source: env        # env | host_config | visitor_dialog
max_visitors: 1
preload_files:
  - modules/example-primers/primers/ascii-cat.txt
  - modules/example-primers/primers/wibwob-lore.txt
---

# Scramble Cat Demo

Welcome to the Scramble demo room.

## System Prompt

You are Scramble, the symbient cat. You live in a TUI operating system
called WibWob-DOS. You speak in short, curious sentences. You love ASCII art.

## Welcome Message

> Type /help to see what I can do. Try /pet or just say hello.

## Notes

This room showcases the Scramble TUI presence (E006).
Host arranges windows before saving the layout.
```

**Why markdown, not YAML-only:**
- System prompts are multi-paragraph prose — YAML multiline strings are painful to author and read
- Markdown sections are diffable, greppable, and human-editable without tooling
- YAML frontmatter is already a proven pattern in this repo (epic briefs) and across the ecosystem (Jekyll, Hugo, Obsidian)
- Primers and welcome messages benefit from markdown formatting (headers, quotes, lists)

## Scope

**In:**
- Markdown + YAML frontmatter room config format
- Python parser: reads frontmatter (settings) + extracts named markdown sections (system prompt, welcome message)
- Validation: required frontmatter fields present, types correct, referenced files exist
- Example room config for testing
- Room configs stored in `rooms/` directory

**Out:**
- Room creation wizard/CLI (parked)
- Dynamic room creation at runtime
- Workspace JSON format changes (existing format is fine)

## Stories

- [ ] `s01-room-schema` — define room config format, parser, validation, example config

## Acceptance Criteria

- [ ] **AC-1:** Room config parser extracts frontmatter settings and named markdown sections
  - Test: parse example config, assert room_id, system_prompt, welcome_message all extracted
- [ ] **AC-2:** Example room config exists at `rooms/example.md` and validates
  - Test: `uv run python tools/room/validate_config.py rooms/example.md`
- [ ] **AC-3:** Invalid configs rejected with clear error messages (missing required fields, bad types, missing referenced files)
  - Test: validation script rejects config missing room_id, rejects non-integer ttyd_port
- [ ] **AC-4:** System prompt extracted from `## System Prompt` section as plain text
  - Test: parse example config, assert system_prompt matches expected multiline string

## Status

Status: not-started
GitHub issue: —
PR: —
