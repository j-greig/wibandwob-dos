# Blessed usage violations census (microapps)

## TL;DR (read this first)

- Use this script to find SDK-first violations in microapps:
  - `bash .pi/skills/autoresearch-microapp-migration/scripts/find-blessed-violations.sh --lines`
- Current snapshot:
  - **40** flagged files total (includes `.disabled`)
  - **30** flagged active files (excludes `.disabled`)
- Next highest-leverage step:
  1) **Human-review microapps for deletion/merge candidates** before refactoring,
  2) then SDK-ize only survivors.

## Quick rerun

Rerun script (authoritative source):
```bash
bash .pi/skills/autoresearch-microapp-migration/scripts/find-blessed-violations.sh --lines
```

File-list rerun:
```bash
bash .pi/skills/autoresearch-microapp-migration/scripts/find-blessed-violations.sh
```

## Why this exists

Progressive disclosure for future-you on another machine:
- **L1**: TL;DR + one command
- **L2**: counts + active list
- **L3**: full list including `.disabled`

## Snapshot (current)

- Total flagged files (including .disabled): **40**
- Active microapps flagged (excluding .disabled): **30**

### Active flagged files
```text
microapps/asciicker/index.ts
microapps/contour-studio/index.ts
microapps/demo-ansi-lab/index.ts
microapps/demo-dashboards-v2/index.ts
microapps/demo-e026-demo/index.ts
microapps/demo-forms-playground/index.ts
microapps/demo-glitchbox/index.ts
microapps/demo-layout-stress-test-pi/index.ts
microapps/demo-patchbay-lab/index.ts
microapps/figlet-banner/index.ts
microapps/journal/index-v1.ts
microapps/journal/index.ts
microapps/layout-probe/index.ts
microapps/llm-orch-studio/index.ts
microapps/monster-cam/index.ts
microapps/pi-sessions/index.ts
microapps/runtime-inspector/index.ts
microapps/sdk-showcase/index.ts
microapps/slap-editor/editor-engine.ts
microapps/slap-editor/index.ts
microapps/spore-clock/index.ts
microapps/symbient-twitter/index.ts
microapps/terminal/index.ts
microapps/terrarium-life/index.ts
microapps/terrarium/index.ts
microapps/theattyr/index.ts
microapps/wibwobworld/index.ts
microapps/wiretext/index.ts
microapps/world-chatroom/index.ts
microapps/zine/zine-widgets.ts
```

### Including .disabled
```text
microapps/.disabled/dashboard-xxl/index.ts
microapps/.disabled/dashboard/index.ts
microapps/.disabled/dashboard/index_v0.ts
microapps/.disabled/demo-ansi-lab/index.ts
microapps/.disabled/demo-flex-bands-demo-pi/index.ts
microapps/.disabled/demo-flex-workbench-demo-pi/index.ts
microapps/.disabled/demo-flex-wrap-demo-pi/index.ts
microapps/.disabled/demo-forms-playground/index.ts
microapps/.disabled/demo-responsive-panels-demo-pi/index.ts
microapps/.disabled/demo-symbient-twitter/index.ts
microapps/asciicker/index.ts
microapps/contour-studio/index.ts
microapps/demo-ansi-lab/index.ts
microapps/demo-dashboards-v2/index.ts
microapps/demo-e026-demo/index.ts
microapps/demo-forms-playground/index.ts
microapps/demo-glitchbox/index.ts
microapps/demo-layout-stress-test-pi/index.ts
microapps/demo-patchbay-lab/index.ts
microapps/figlet-banner/index.ts
microapps/journal/index-v1.ts
microapps/journal/index.ts
microapps/layout-probe/index.ts
microapps/llm-orch-studio/index.ts
microapps/monster-cam/index.ts
microapps/pi-sessions/index.ts
microapps/runtime-inspector/index.ts
microapps/sdk-showcase/index.ts
microapps/slap-editor/editor-engine.ts
microapps/slap-editor/index.ts
microapps/spore-clock/index.ts
microapps/symbient-twitter/index.ts
microapps/terminal/index.ts
microapps/terrarium-life/index.ts
microapps/terrarium/index.ts
microapps/theattyr/index.ts
microapps/wibwobworld/index.ts
microapps/wiretext/index.ts
microapps/world-chatroom/index.ts
microapps/zine/zine-widgets.ts
```

## Next steps (ordered)

1. **Human review first (de-bloat gate)**
   - classify every microapp: keep / merge / archive / delete
   - objective: reduce surface area before SDK cleanup
2. **Prioritize active high-traffic demos**
   - migrate survivors to SDK-first patterns
3. **Extract repeated UI into SDK primitives**
   - only after 2+ real usages confirm the abstraction
4. **Update docs in same slice**
   - `.agents/guides/microapp/sdk-reference.md`
   - `docs/building-custom-microapps.md`
5. **Re-run this script + update this file**
   - keep counts visible for trend tracking

## Prompt template (improved)

```md
Run the microapp cleanup + SDK migration sweep.

Goals:
1) Human-review microapps first: mark keep/merge/archive/delete to reduce bloat.
2) For kept apps, enforce SDK-first patterns; raw blessed only for interop edge cases.
3) Extract shared primitives only when repeated patterns appear across >=2 apps.
4) Keep docs in sync with each SDK extraction.

Verification:
- run `find-blessed-violations.sh --lines`
- typecheck
- wibwob CLI open/state checks for touched apps
- update this spike file with new counts + changed file list

Output:
- commit in logical parcels (one app or one sdk/doc slice)
- include short TL;DR + detailed notes per commit
```
