# Local-first vaults, encrypted instances & local memory substrate (local-first only)

---

# Phase B — Logseq Architecture Deep Dive

## 1. Core Structural Difference: Block Model vs File Model

Obsidian:

* File-first
* Markdown file is atomic unit
* Graph derived from links between files

Logseq:

* Block-first
* Each bullet/block is atomic
* Blocks have unique IDs
* Files are containers, not atomic units

This is a huge architectural difference.

### Logseq Block Example

```markdown
- This is a block
  id:: 63f01b7e-1234
  - Child block
```

Blocks:

* Can be referenced independently
* Can be transcluded
* Can be queried
* Form a graph independent of file structure

Logseq therefore behaves more like:

* A lightweight graph database projected onto Markdown

Whereas Obsidian behaves like:

* A file graph index layered over plain files

---

## 2. Journaling Model

Logseq strongly emphasizes:

```
/journals/2026_02_15.md
```

Daily journaling is primary interface.

This aligns strongly with your symbient OS idea.

The journal becomes:

* Timeline
* Thought stream
* Task interface
* Knowledge entry point

This pattern is extremely aligned with:

* oslog.md
* Append-only state log
* Temporal cognition

---

## 3. Graph Layer Mechanics

Logseq:

* Parses Markdown into block tree
* Assigns IDs
* Builds graph relationships
* Stores graph metadata in local database (SQLite)

Important:

Graph database is:

* Derived
* Rebuildable
* Not canonical

Again, pattern repeated:
Derived graph, canonical Markdown.

---

## 4. Local-First Guarantees

Logseq:

* Fully local
* Files are primary
* Optional sync layer
* No mandatory central authority

This is critical.

For WibWob-DOS:

Instance vault must be:

* Fully functional offline
* Fully intelligible without engine
* Self-contained

---

# Phase C — Zettelkasten & Append-Only Philosophy

This is deeper than app architecture.

It’s about cognitive growth patterns.

## Core Ideas

1. Atomic notes
2. Permanent IDs
3. Links over hierarchy
4. Organic growth
5. No “final” structure
6. Accretion over time

Zettelkasten is append-only by philosophy.

You don’t rewrite history.
You add new thoughts.

This maps beautifully to:

* Event log
* Journal
* Snapshot layering
* Identity continuity

---

## Permanent Addressability

Zettelkasten uses:

* Timestamp-based IDs
* Stable note references

This suggests for WibWob:

* Events must have stable seq IDs
* Conversations should have stable IDs
* Windows might need stable identity across snapshots

Stability enables:

* Long-term links
* Agent references
* Cross-file cohesion

---

# Phase D — Ink & Switch Local-First Principles

Ink & Switch (Local-First Software movement) defines:

### 1. Data lives on your device

### 2. Works offline

### 3. Fast local reads/writes

### 4. No forced cloud

### 5. Sync is optional

### 6. Conflict resolution is user-visible

This aligns exactly with:

Your dislike of dependency
Your OS-as-habitat model

---

## Conflict Resolution Models

Ink & Switch research emphasizes:

* CRDTs for eventual consistency
* Clear merge semantics
* Human-resolvable conflicts

For WibWob:

Even if single-instance now,
Future hosted + multi-agent means:

* Potential concurrent edits to vault files
* Potential concurrent oslog updates

Design decision:

Single-writer rule (simplest)
OR
Multi-writer with append-only segments (safer)

Append-only segments reduce merge conflict risk dramatically.

---

# Phase E — Encrypted Vault Models

We examine:

## Option 1: Full Vault Encryption (filesystem level)

Example:

* LUKS
* FileVault
* eCryptfs

Pros:

* Transparent to app
* Strong isolation

Cons:

* OS-dependent
* Harder container portability

---

## Option 2: Application-Level Encryption

Vault files encrypted individually.

Pros:

* Cross-platform
* Controlled by engine
* Instance-specific keys

Cons:

* Harder human readability
* Obsidian compatibility lost unless decrypted

---

## Option 3: Envelope Model (Recommended)

* Vault remains plaintext on disk
* Entire instance directory encrypted at container layer
* oslog optionally signed (not encrypted)

This preserves:

* Human inspectability
* Git compatibility
* Long-term durability

If encryption required:

* Encrypt instance container volume
* Not individual Markdown files

---

# Phase F — WibWob-DOS Synthesis (Local-first only)

Now we unify.

---

# Vault-as-Memory-Substrate Model

```
instance/
  vault/
    journal/
    conversations/
    artifacts/
    reflections/
  oslog.md
  events/
    2026-02.ndjson
  snapshots/
    2026-02-15T06-42.json
  instance.json
```

Principles:

* Vault is human-legible
* events/ is append-only NDJSON
* snapshots/ deterministic JSON
* oslog.md is symbient-facing summary

---

# oslog.md Canonical Spec (v1 Concept)

## Frontmatter

```yaml
---
format: wibwob-oslog@1
instance_id: alpha-001
engine_version: vNext-0.3
event_seq: 1842
latest_snapshot: snapshots/2026-02-15T06-42.json
hash_chain: blake3
---
```

## Sections

* Actors
* Windows
* Active Conversations
* Recent Events (NDJSON block)
* Reflections

---

# Append-Only Event Pattern

Rules:

* One event per line
* Monotonic seq
* Actor attribution required
* No event deletion
* Corrections = new events

This aligns with:

* Zettelkasten accretion
* Event sourcing
* Local-first durability

---

# Instance Isolation Model

Each instance:

* Own directory
* Own vault
* Own event stream
* Own snapshot set
* Own encryption boundary
* Own actor registry

No cross-instance mutation without explicit bridge adapter.

---

# Multi-Agent Co-Authoring Rules

1. All agent actions must emit events.
2. Markdown edits by agents:

   * Must be appended or section-bounded.
3. Human edits:

   * Treated as first-class events.
4. Conflict resolution:

   * Append-only preferred over in-place modification.
5. Each actor has identity in event log.

---

# Contracts / Schema Additions (Local-first only)

Add:

```
contracts/
  oslog/
    v1.schema.json
  events/
    v1.schema.json
  instance/
    v1.schema.json
```

oslog schema defines:

* Required frontmatter keys
* Allowed section anchors
* Allowed canonical block types

events schema defines:

* seq
* ts
* actor_id
* command
* args
* result (optional)
* hash_prev (optional)

---

# Critical Insight

From Obsidian + Logseq + Zettelkasten + Local-First:

The most important design decision is:

> Do not collapse vault into engine state.

Vault is:

* Durable cognition
* Narrative continuity
* Long-term identity

Engine is:

* Operational memory
* Transient execution state

That separation must remain sacred.

---

We have now completed:

* Obsidian deep architecture [`workings/chatgpt-refactor-vision-planning-2026-01-15/local-first-research-phase-a.md`]
* Logseq deep architecture (this document)
* Zettelkasten philosophy
* Local-first principles
* Encryption patterns
* Synthesis for WibWob

Local-first-only scope.
No embedding or retrieval requirements.
Pure substrate design.
