---
id: spk-agentic-tui-runtime-roadmap-module-runtime-reload
title: Module Runtime Reload Build
status: in-progress
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

- [ ] Introduce a runtime owner for loaded module instances
- [ ] Track module id, source path, version/revision token, load status, and
      last error
- [ ] Track runtime-owned module resources:
      commands, windows, cleanup hooks, subscriptions, timers if applicable
- [ ] Define unload semantics that clean owned resources without restarting the
      app
- [ ] Define reload semantics as teardown + reopen for v1
- [ ] Preserve enough module metadata to explain reload failures in `/state`
- [ ] Add `GET /modules/list`
- [ ] Add `POST /modules/reload`
- [ ] Add `POST /modules/unload`
- [ ] Surface module runtime summary through `/state`
- [ ] Add one command path for module reload in the registry
- [ ] Prove reload against `modules/patchbay-lab`
- [ ] Verify no duplicate commands after reloading Patchbay Lab
- [ ] Verify helper windows owned by Patchbay Lab are cleaned up on unload
- [ ] Capture reload friction in the spike docs
- [ ] `bun run typecheck`
- [ ] restart
- [ ] smoke

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
