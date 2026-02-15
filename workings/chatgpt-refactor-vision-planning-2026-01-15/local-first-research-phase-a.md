# Local-first vaults, encrypted instances & local memory substrate (local-first only)

# Phase A — Obsidian Architecture Deep Dive

*(local-first only, purely local-first cognition substrate)*

---

## 1. Obsidian Architecture — Structural Overview

### Core Principle

Obsidian is:

> A filesystem-first, Markdown-native, index-augmented knowledge environment.

Important:
It does not own your data.
It indexes your data.

That distinction matters enormously for WibWob-DOS.

---

## 2. Vault Structure

A Vault is:

* A normal folder
* Containing:

  * Markdown files
  * Media assets
  * Optional `.obsidian/` config directory

Example:

```
vault/
  journal/
    2026-02-15.md
  notes/
    extended-mind.md
  projects/
    symbient-os.md
  .obsidian/
    workspace.json
    app.json
    plugins/
```

Key insight:

* The vault is durable because it is plain files.
* The app is disposable.
* The knowledge survives the tool.

For WibWob-DOS:

> The engine must be disposable.
> The vault must not be.

---

## 3. Markdown as Canonical Layer

Obsidian treats:

* Markdown files = source of truth
* Graph view = projection
* Backlinks = index artifact
* Workspace layout = ephemeral

This maps cleanly to:

Engine state = ephemeral
Vault Markdown = durable
Graph / UI = projection

Critical difference from traditional apps:

Obsidian does not serialize a big database.
It reads the filesystem on startup.

That gives:

* Portability
* Git compatibility
* Long-term durability
* Tool independence

---

## 4. Backlink & Graph Construction

Obsidian builds a graph from:

* `[[wikilinks]]`
* `#tags`
* Inline references

The graph is:

* Derived
* Not stored as canonical
* Rebuildable

This is extremely important.

For WibWob-DOS:

* Event graph must be derived from events.
* Actor graph must be derived from logs.
* Window relationships must be derived from state.

Do not store redundant canonical graph structures.

---

## 5. Plugin Architecture

Obsidian plugins:

* Run in a sandboxed Electron context
* Extend via defined API
* Cannot mutate underlying file arbitrarily without going through file API

Pattern:

Core engine minimal
Extensions layered
Vault remains plain

This is ideal for WibWob:

Engine core (C++)
Adapters (IPC/API/CLI/Web)
Extensions (sidecars)
Vault plain

---

## 6. Durability & Migration

Why Obsidian survives:

* Markdown standard
* Plain text
* Human-readable
* No forced schema migration
* Optional frontmatter

If Obsidian dies, vault still readable.

For WibWob:

If WibWob dies, vault must still be intelligible.

That is a hard design constraint.

---

## 7. Identity Continuity Over Years

This is subtle.

Obsidian vaults:

* Accrete structure organically
* Develop graph density
* Develop journaling rituals
* Become identity anchors

It’s not just storage.
It’s continuity.

For Symbient OS:

Vault + oslog must become:

* Long-term identity artifact
* Not just technical log

---

# Structural Lessons for WibWob-DOS

## Vault-as-Memory-Substrate Model (Local-first only)

```
instance/
  vault/
    journal/
    conversations/
    artifacts/
    reflections/
  oslog.md
  snapshots/
  events/
```

Rules:

* Vault files are human-editable.
* oslog.md is structured.
* events/ contains append-only NDJSON.
* snapshots/ contain deterministic JSON state.

Engine never writes directly into arbitrary files.
Engine writes:

* events
* snapshots
* structured updates

---

# oslog.md — Single File Spec Concept

Obsidian teaches us:

* Markdown must remain readable.
* Structure must be lightweight.
* Avoid over-nesting.

So oslog should:

* Use YAML frontmatter for identity
* Use NDJSON block for events
* Use Markdown for reflections
* Use explicit version tag

Minimal.

---

# Critical Design Constraint

Obsidian shows:

Do not over-formalize.

If your file format becomes:

* 70% machine-only
* unreadable by human

You lose the local-first cognitive advantage.

Balance matters.

---

# Immediate Architectural Adjustments to WibWob

From this phase alone:

1. Engine must treat vault as filesystem, not database.
2. oslog must be append-only.
3. Derived state must be rebuildable.
4. Graphs must be projections.
5. Extensions must not break vault portability.
6. Encryption should wrap vault, not change file format.
