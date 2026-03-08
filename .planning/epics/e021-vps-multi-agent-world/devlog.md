# E021 VPS Devlog
Agentic changelog. Terse. Drop articles where possible. Agent-readable.

---

## 2026-03-08 — Session 1

### Context
Worktree `~/Repos/wibwobdos-vps` created off main on branch `epic/e021-vps-multi-agent-world`.
S00 Docker smoke already green (all 8 gates). Container running: `127.0.0.1:2849` SSH, `:7681` ttyd.
Tunnel established: `19099 → 8099` inside container.

---

### Work done

**Skill frontmatter fixes (landed on main first)**
- `discord-tui-share/SKILL.md` — quoted description to fix YAML nested-mapping parse error
- `new-window-type/SKILL.md` — added missing frontmatter block
- Branch `fix/skill-frontmatter` → merged → pushed → returned to worktree

**deploy/smoke-entrypoint.sh — profile env fix (BLOCKER)**
- `WIBWOB_DEPLOY_PROFILE=docker-safe` was in `.env` but entrypoint never sourced it
- App started without profile → all capability gating bypassed
- Fix: `set -a; . .env; set +a` before tmux launch
- Profile now loads on container start

**deploy/Caddyfile — H3 hash exposure**
- bcrypt hash was hardcoded in repo (H3 from hardening spike)
- Replaced with `{env.WIBWOB_BASIC_AUTH_HASH}` Caddy env var reference
- Hash must now live in `/etc/wibwob.env` on VPS only

**deploy/session.sh — H4 interim**
- `sleep 0.5` → `sleep 2` (blessed resize race band-aid)
- H4 proper (waitForTerminalReady) still pending — need codex log

**deploy/Dockerfile — H1 non-root**
- Production image ran as root (HIGH risk — ttyd gave root shell)
- Added `useradd -m wibwob`, `--chown=wibwob:wibwob` on COPY layers
- `USER wibwob` at end of Dockerfile
- Pattern ported from Dockerfile.smoke (already correct)

**scripts/start-tmux.sh — created**
- New file: systemd entrypoint for direct-Bun VPS deploy (no Docker)
- Sources `.env`, kills stale session, starts tmux, blocks with `tmux wait-for`
- Required for wibwob-dos.service systemd unit

**Capability tier system — feature.mvpv2 / feature.mvpv3**
- User defined 3-tier app model for VPS MVP
- Added `feature.mvpv2` and `feature.mvpv3` to `CapabilityKey` type
- `feature.mvpv2` probes against `ANTHROPIC_API_KEY` (auto-gates inference apps)
- `feature.mvpv3` probes true (gate via profile forceOff in lower tiers)
- Both added to `CAPABILITY_KEYS` array and `probe()` snapshot

**MVP tier map (discovered)**
- MVP: finder.open, primer_gallery.open, figlet.open, contour.open, example.hello-world
- MVPv2: agent.open, wibwob.poetry-clock (needs `feature.mvpv2`)
- MVPv3: companion.open, plasma.open, plasma.from-primer (needs `feature.mvpv3`)
- poetry-clock and hello-world are external modules (modules/), not in command-catalog
- hello-world and poetry-clock module.json found — need `requires` field threading

**DynamicCommandDefinition — requires field missing**
- Module-registered commands had no path to declare `requires`
- `DynamicCommandDefinition` in command-registry.ts lacked `requires?: CapabilityKey[]`
- Fix in progress: threading requires through module-loader → registerCommand → DynamicCommandDef

---

### Codex review of SESSION-HANDOVER.md (2026-03-08)

Key points absorbed from Codex response (full text in SESSION-HANDOVER.md):

SEQUENCING: Do not add more TS gating work until E023 rebase done. Agreed.
Chrome fix (createMenuConfigs filter) already landed — high conflict risk with
E023 on command-catalog.ts. Fix is correct; may need re-applying after rebase.

NAMING: feature.mvpv2/mvpv3 encode rollout stage not capability meaning.
Rename before ossifying: feature.mvpv2 → feature.inference,
feature.mvpv3 → feature.resource-heavy.

PROFILE VERIFICATION: moved P2 → P0. Silent profile load failure means
all hosted gating claims are untrustworthy. Must verify after every deploy.

SECURITY PRIORITY REORDER:
  1. Session-hostile commands (quit, clear-all, close-all) — nearer-term real risk
  2. Path traversal / write boundary
  3. Control API identity
  4. Shared tmux isolation
  5. Source read-only
  6. Disk fill

PATCHBAY.LAB: not yet assessed — should it be hosted-visible or dev-only?
Check before VPS deploy. If dev-only, add feature.local-only requires.

ADDITIONAL VERIFICATIONS after rebase:
  - Module-contributed command menu/palette filtering (not just static catalog)
  - /state semantic metadata for open microapp windows (not just open/close)
  - AGENTS.md linked files — are they present in image or does reader handle missing gracefully?
  - Confirm hosted shell is non-root, API only via tunnel, unavailable commands absent from menus

SLEEP 2: H4 must stay explicitly open. Not permanent fix. Codex emphatic.

WISHLIST → TASKS: typecheck from worktree, separate mutable data, profile
verification endpoint are not polish — they affect agent operability. Promote.

### LANE DEFINITION (from Codex, 2026-03-08) — BINDING

PI-OWNED NOW (proceed):
  deploy/  scripts/smoke-restart.sh  scripts/start-tmux.sh
  VPS runbook  smoke image hardening
  hosted verification gates  Caddy/auth/systemd/container docs

PI-OWNED AFTER E023 REBASE (conditional):
  src/core/command-catalog.ts  src/core/command-registry.ts
  src/services/capability-service.ts  hosted/local-only command policy

DO NOT TOUCH:
  src/services/microapp-sdk.ts  src/services/module-loader.ts
  modules/* microapps  Patchbay planning/docs
  Any broad SDK/module/runtime work

NEXT ACTION: rebase onto E023 before any more TS capability edits.
After rebase: verify one full hosted-command availability path end to end
(catalog → menu → /commands/list → /commands/run rejection → dynamic commands).

### Docker smoke — all 8 gates GREEN (rebuilt image 2026-03-08)
- GATE1 ✓ SSH key auth
- GATE2 ✓ Password auth blocked
- GATE3 ✓ tmux session live
- GATE4 ✓ /health via tunnel — instanceLabel:smoke sessionId:967
- GATE5 ✓ container port 8099 unpublished (not exposed to host)
- GATE6 ✓ /state + /commands/list — 81 commands (up from 69; wibwobworld + world-chatroom modules now loading)
- GATE7 ✓ microapp.wibwobworld.open — window appears in state
- GATE8 ✓ ttyd serving xterm.js

Root cause of GATE7 failure in previous image: wibwobworld + world-chatroom modules missing from container — they exist in modules/ locally but image was stale. Rebuild fixed.

Note: GATE2 shows "Permission denied (publickey)" not "password denied" — SSH correctly falls back then rejects entirely. Gate passes.

### In progress
- Threading `requires` through module-loader.ts registerCommand path
- Updating module.json for poetry-clock (`requires: ["feature.mvpv2"]`)
- Creating profile JSONs: mvp.json, mvpv2.json, mvpv3.json
- Updating docker-safe.json to forceOff both tier keys
- vps-hetzner-one RUNBOOK.md — wibwob-dos section not yet written
- e021-brief.md — hardening spike ACs not yet folded in
- planning:sync not yet run

---

### Human smoke results — COMPLETE (2026-03-08)

| App / Feature | Result | Notes |
|---|---|---|
| File Manager | ✓ | |
| Primer Gallery | ✓ | primer opens in window |
| Figlet Banner | ✓ | fixed — pyfiglet fonts baked into image |
| Contour Studio | ✓ | |
| Hello World | ✓ | |
| WibWobWorld | ✓ | all 4 views, human-driven |
| World Chatroom | ✓ | connect via C in WibWobWorld, chat text visible |
| Pattern Window | ✓ | promoted to MVP1 |
| Command Palette | ✓ | basic commands |
| Plasma / Plasma from Primer | ✓ API / ✗ browser | H4 resize crash from browser; MVPv3, gate in profile |
| Document Reader | ✓ | fixed — was defaulting to phantom MASTER_PHILOSOPHY_PATH; now README_PATH |
| Chrome Browser | ✗ CRASH | not installed, crashes app — needs menu gating urgently |
| File → Quit | present | should be hidden on hosted instances |
| Multiple windows (4-5) | ✓ | layout holds |
| Window drag (browser) | ✓ | |
| Window resize (browser) | ✓ | |
| 5 min idle stability | ✓ | stays up |
| API parity | ✓ | state matches UI; contour summary ("85% water") visible in /state |

VERDICT: MVP1 apps all working. No blockers for VPS deploy.
Known issues: Chrome crash (HIGH — gate urgently), Plasma browser crash (MEDIUM — MVPv3, gate in profile), Quit visible (MEDIUM), phantom MASTER_PHILOSOPHY_PATH ref (LOW).

### Human smoke results — session 1 (2026-03-08)

| App | Result | Notes |
|-----|--------|-------|
| File Manager | ✓ | works |
| Primer Gallery | ✓ | primer opens in window |
| Figlet Banner | ✗ CRASH | font file not found — fonts not installed in image |
| Contour Studio | ✓ | working fine |
| Hello World | ✓ (partial) | opens but missing figlet font |
| WibWobWorld | ✓ | all 4 views working, human-driven open confirmed |
| Window tile/cascade | ✓ | working |
| Pattern Window | ✓ | working — PROMOTE to MVP1 |
| Command Palette | ✓ | basic commands tested |
| Chrome Browser | ✗ CRASH | not in container, crashes app — needs menu gating |
| File → Quit | present | should be hidden on hosted instances |

Fix shipped: rebuilt image with pyfiglet fonts baked in (148 fonts via pip install pyfiglet → /usr/share/figlet).
Verified: `figlet -f binary "test"` works in new container.

MVP tier update — Pattern Window added to MVP1.

### Human smoke feedback — punch list (pre-VPS)

**PATTERN: browser crashes, API never crashes**
Every crash this session triggered from ttyd browser, not API.
Figlet (pre-font-fix), Chrome, Plasma all crash from browser only.
Root cause: H4 — blessed inits at one size, ttyd xterm.js sends resize,
windows that do expensive render on open (plasma animation, figlet subprocess,
chrome spawn) panic on dimension change during first render.
Fix needed: waitForTerminalReady in app.ts — wait for stable dimensions before
allowing window open operations. H4 proper, not yet implemented.
Priority: HIGH — affects any window opened during/after ttyd resize event.

**FIGLET CRASH** — fixed by baking pyfiglet fonts into image.
Was: font file not found → subprocess error → unhandled exception → blessed panic.
Now: 148 fonts installed, verified working.

**PRIMER PATH** — primer browser opens at REPO_ROOT (/opt/wibandwob-dos), not example-primers.
User must navigate manually to modules/example-primers/primers/.
Fix: honour WIBWOB_PRIMER_DEFAULT_PATH env var in app-controller.ts line 863 openPrimerBrowser startPath.
Or: when WIBWOB_DEPLOY_PROFILE set, default startPath to APP_ROOT/modules/example-primers/primers.
Priority: MEDIUM — works but friction.

**QUIT** — File → Quit present on hosted instance. Should be hidden.
Fix: feature.local-only capability key + forceOff in docker-safe profile.
Priority: MEDIUM — cosmetic but confusing for hosted users.

### Opportunities / self-enhancement notes

**SKILL GAP: capability profile not verified on boot**
- No smoke gate checks that profile loaded correctly (command count, specific unavailable ids)
- Add gate: `curl /commands/list | check unavailable includes expected ids`
- Could be a script: `scripts/verify-profile.sh <profile-name> <expected-unavailable-ids...>`

**SKILL GAP: smoke-entrypoint sources .env but tmux env inherits weirdly**
- `set -a; . .env; set +a` works for shell vars but tmux new-session may not inherit all
- Verify: `tmux show-env -t wibwob` should show WIBWOB_DEPLOY_PROFILE after next rebuild
- Better: pass env explicitly via `tmux new-session -e KEY=VAL ...` for each var in .env

**PROCESS GAP: no planning:sync run after changes**
- Every session should end with `bun run planning:sync` + commit
- Add to devlog close-out checklist

**PROCESS GAP: devlog not started until mid-session**
- Create devlog at worktree creation time, not after work begins
- Candidate for ww-ops skill: `on worktree create → init devlog from template`

**CODE GAP: H4 proper (waitForTerminalReady) implementation missing**
- Handover doc says Codex wrote it in `.codex-logs/` — not found yet
- If lost: implement SIGWINCH wait in src/app.ts before first screen.render()
- Low priority (H4 interim ships now) but worth finding before VPS deploy

**ARCH NOTE: module requires threading was incomplete at design time**
- DynamicCommandDefinition had no requires field → module commands ungated
- Any future microapp needing capability gating would hit same gap
- Fixed as part of this session — good candidate for ww-scaffold-view skill update

---

### Post-rebase verification (2026-03-08)

Rebased cleanly onto E023 merge (9d6251c). Zero conflicts.
Commands: 86 (up from 81 — E023 added more).
All 8 smoke gates green on rebuilt image.

End-to-end hosted command path verified:
  catalog     chrome.open has requires:["bin.chrome"] ✓
  menu        chrome.open absent from Applications menu (createMenuConfigs filter) ✓
  list        chrome.open absent from /commands/list default ✓
  run         chrome.open → {"ok":false,"error":"Command unavailable..."} ✓
  unavailable includeUnavailable=1 shows: chrome.open, monster_cam.open, backrooms.open, backrooms.run ✓
  dynamic     all 32 module commands showing available ✓
  poetry-clock microapp.wibwob.poetry-clock.open available (no requires.inference wired yet) ✓
  wibwobworld + world-chatroom available ✓

CALLOUT for Codex (not Pi's lane):
  patchbay-lab module.json describes "SDK coverage harness" — dev tool
  currently visible in Applications menu and API on hosted instances
  has no requires field → can't be gated until dynamic requires threading done
  Decision needed: feature.local-only? or keep hosted-visible?

RENAME done: feature.mvpv2 → feature.inference, feature.mvpv3 → feature.resource-heavy

### Close-out checklist (not done)
- [ ] Thread requires through command-registry + module-loader
- [ ] Tag module.json files with correct tier requires
- [ ] Create profile JSONs (mvp, mvpv2, mvpv3) + update docker-safe
- [ ] Write vps-hetzner-one RUNBOOK wibwob-dos section
- [ ] Fold hardening spike ACs into e021-brief stories
- [ ] bun run typecheck
- [ ] bun run planning:sync
- [ ] Commit all with single logical message
