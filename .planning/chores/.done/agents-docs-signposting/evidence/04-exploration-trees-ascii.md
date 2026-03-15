# Exploration Trees: Claude vs Codex

How each agent navigated from cold start to "I can build a microapp now".
Arrows show what led to what. Indentation = depth of follow-up.

---

## Claude's journey (11 files, breadth-first then assessed)

```
ls /  (orient)
│
└─► AGENTS.md  (agent constitution — where do I start?)
    │
    ├─► docs/building-custom-microapps.md  (AGENTS.md said "read this")
    │   │
    │   └─► .agents/microapp-sdk.md  (main guide said "SDK surface here")
    │       │
    │       └─► docs/microapp-authoring.md  ✗ DEAD LINK — file not found
    │
    ├─► microapps/  (ls — what examples exist?)
    │   │
    │   ├─► microapps/hello-world/microapp.json  (minimal manifest)
    │   ├─► microapps/hello-world/index.ts     (minimal code — responsive figlet)
    │   ├─► microapps/heartbeat/index.ts       (animated — timers, cleanup)
    │   └─► microapps/wibwob-poetry-clock/index.ts  (complex — AI, modes, contour)
    │
    ├─► scripts/scaffold-microapp.sh  (what does the generator actually produce?)
    │
    ├─► .agents/architecture.md  (linked at top of AGENTS.md — is this relevant?)
    │   └── verdict: NOT relevant for module work, detour
    │
    ├─► microapps/README.md  (module dir's own onboarding doc)
    │   └─► docs/microapp-authoring.md  ✗ DEAD LINK again
    │
    └─► src/services/microapp-sdk.ts  (the actual SDK barrel — what can I import?)

    ──── STOPPED, assessed, proposed restructure ────
```

Total depth: 3 levels max.
Strategy: followed the main breadcrumb trail, checked examples by
complexity tier, verified SDK source, caught the dead link twice,
stopped once confident the pattern was clear.

---

## Codex's journey (26 files, depth-first and forensic)

```
AGENTS.md  (root contract)
│
├─► .agents/  (ls — what's the doc surface?)
│
├─► docs/building-custom-microapps.md  (public authoring path)
│   │
│   └── noted: persistence too light, dream-forecast stale reference
│
├─► scripts/scaffold-microapp.sh  (real starter code)
│   │
│   └── noted: no onCleanup — contract mismatch with docs
│
├─► .agents/microapp-sdk.md  (deeper authoring contract)
│   │
│   ├─► docs/microapp-authoring.md  ✗ DEAD LINK
│   │
│   ├─► .agents/specs/window-system.md  (triggered by AGENTS.md pre-change table)
│   │   │
│   │   └── verdict: useful but too internal for first-stop microapp author
│   │
│   └─► .agents/specs/agent-session.md  (also triggered by pre-change table)
│       │
│       └── noted: module guidance buried inside agent-session filename
│
├─► microapps/hello-world/index.ts  (minimal example per docs)
│   │
│   ├── noted: no longer minimal — has responsive layout engine
│   └─► microapps/hello-world/microapp.json  (manifest still clean)
│
├─► microapps/glitchbox/index.ts  (animated reference per AGENTS.md)
│   │
│   └── verdict: too dense for first-stop teaching
│
├─► microapps/wibwob-poetry-clock/index.ts  (compact real app)
│   │
│   ├─► microapps/wibwob-poetry-clock/microapp.json  (persist:true example?)
│   │
│   └─► microapps/wibwob-poetry-clock/index.ts § snapshot  (persistence pattern)
│       │
│       └── found: serialize mode+voice, restore via open command
│
├─► microapps/e026-demo/index.ts  (broad SDK sampler)
│   │
│   └── verdict: excellent feature map, too much for onboarding
│
├─► .agents/architecture.md  (shell-internal — relevant to modules?)
│   │
│   └── verdict: mostly shell maintainer, not microapp author
│
├─► .agents/invariants.md  (hard rules — which constrain modules?)
│   │
│   └── noted: some rules matter (describeState, single owner, SDK path)
│         but mixed with shell-only rules
│
├─► src/services/microapp-sdk.ts  (actual export surface)
│   │
│   └── noted: far more exports than docs describe, drift risk
│
├─► src/services/microapp-loader.ts  (the REAL owner of MicroappHost)
│   │
│   ├── found: queueMicrotask registration, focusOrCreate wrapping
│   ├── found: registerSnapshot — the real persistence seam
│   │
│   └─► search: registerSnapshot across modules
│       │
│       ├─► microapps/wibwob-poetry-clock § snapshot  (clean example)
│       └─► microapps/wibwob-tidepool § snapshot  (different pattern — drift?)
│
├─► microapps/README.md  (module dir docs)
│   │
│   └─► docs/microapp-authoring.md  ✗ DEAD LINK (third hit)
│
└─► search: cross-references and stale links across all docs

    ──── STOPPED, assessed, proposed restructure ────
```

Total depth: 5 levels max.
Strategy: followed every breadcrumb to its source, read implementation
code to verify doc claims, chased persistence through loader to real
modules, audited cross-references for staleness, catalogued every
contract mismatch between docs/scaffold/code.

---

## Side-by-side shape

```
CLAUDE                              CODEX
──────                              ─────
broad, shallow                      narrow, deep
11 files                            26 files
3 levels max depth                  5 levels max depth
stopped at "pattern is clear"       stopped at "truth is verified"
found 6 friction points             found 10 friction points
missed persistence gap              chased persistence to source
missed scaffold/doc mismatch        caught onCleanup contract gap
caught UX issues (no fast path)     caught accuracy issues (stale refs)
proposed: move 2 dirs               proposed: 7 dirs, 15+ new files
implementable in 10 min             implementable in multiple sessions
```

Both agents started at the same point and followed the same first
three hops. They diverged at depth 3: Claude assessed and stopped,
Codex kept digging into implementation to verify claims.

Neither agent needed to be told where to start. AGENTS.md did that
job. The friction was in what happened AFTER the first breadcrumb —
which docs were relevant, which were detours, and whether the docs
matched reality.
