---
id: spk-agentic-tui-runtime-roadmap-module-runtime-reload
title: Module Runtime Reload Build
status: done
created: 2026-03-08
depends_on: [spk-agentic-tui-runtime-roadmap, spk-agentic-tui-runtime-roadmap-patchbay-lab-build]
---

# Module Runtime Reload Build

## Goal

Build the first runtime-owned module reload path for WibWob-DOS so one module
can be unloaded and reloaded in a running app without restarting the whole
desktop.

## Scope

This story covers the smallest useful `P2` slice:

- runtime-owned module tracking
- unload and reload semantics
- control API endpoints for module inspection and reload
- teardown + reopen as the default v1 reload behavior
- Patchbay Lab as the first reload proof

TouchLab stays sequenced after this story. It depends on these runtime seams
being boring and reliable first.

## Acceptance Checklist

- [x] Introduce a runtime owner for loaded module instances
- [x] Track module id, source path, version/revision token, load status, and
      last error
- [x] Track runtime-owned module resources:
      commands, windows, cleanup hooks, subscriptions, timers if applicable
- [x] Define unload semantics that clean owned resources without restarting the
      app
- [x] Define reload semantics as teardown + reopen for v1
- [x] Preserve enough module metadata to explain reload failures in `/state`
- [x] Add `GET /modules/list`
- [x] Add `POST /modules/reload`
- [x] Add `POST /modules/unload`
- [x] Surface module runtime summary through `/state`
- [x] Add one command path for module reload in the registry
- [x] Prove reload against `modules/patchbay-lab`
- [x] Verify no duplicate commands after reloading Patchbay Lab
- [x] Verify helper windows owned by Patchbay Lab are cleaned up on unload
- [x] Capture reload friction in the spike docs
- [x] `bun run typecheck`
- [x] restart
- [x] smoke

## Non-goals

- [ ] No preserved-state reload in this story
- [ ] No file watching in this story
- [ ] No connection graph in this story
- [ ] No agent memory runtime in this story
- [ ] No TouchLab implementation in this story

## Runtime Rules

- one runtime owner for module lifecycle
- one reload path for v1: teardown + reopen
- module-visible commands must be runtime-cleaned on unload
- runtime state must be API-visible
- failures must be inspectable without reading logs first

## Reload friction captured

- v1 reopen semantics only restore the module's main entry surface when the
  module had open windows; helper windows are intentionally cleaned and not
  reconstructed
- module-owned resources are currently inferred from command id prefix,
  `microappId`, and registered snapshot id; that is good enough for v1 but
  still a convention-based runtime model rather than a richer ownership graph
- the current runtime state is truthful and API-visible, but reload failure
  ergonomics are still state/log oriented rather than event-stream oriented
- source-edit hot reload is now proven via the `runtime.reload-canary` smoke
  path, but only after hardening the loader to import from a transpiled shadow
  copy of the module directory; Bun's direct `.ts` import path was too stale to
  trust as the reload mechanism
- runtime code-path changes still require a full app restart before the new
  reload machinery itself is active; module edits do not

## Open Questions To Resolve In Code

- [ ] Where the runtime owner should live: `module-loader.ts` extension or
      dedicated `module-runtime-service.ts`
- [ ] Whether reload reopens only windows created by the module or also the
      last-known entry surface
- [ ] How module revision should be represented for local dev reloads

## Exit Condition

An edit to Patchbay Lab can be followed by a module reload command and the app
returns with one clean instance, one clean command set, and one truthful
runtime state record.
