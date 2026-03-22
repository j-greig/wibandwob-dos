# chore/sdk-hardening-and-src-audit

Branch: `chore/sdk-hardening-and-src-audit`
Issues: #135 (blessed violation census), #136 (SDK silent failure hardening)

---

## From issue #136 — SDK: harden against silent failure modes

Three changes to eliminate the most common silent failures in microapp development.
All three surfaced repeatedly across subagent build runs.

- [ ] `theme().footer` defaults to `theme().header` when undefined
      File: `src/services/microapp-sdk.ts`
      Currently every microapp writes `t.footer ?? t.header` defensively.
      Fix it once in the SDK, the pattern disappears everywhere.

- [ ] `focusOrCreate` warns when it intercepts a command
      File: `src/services/microapp-loader.ts`
      Omitting `direct: true` was the highest-pain issue — commands return
      `{ok:true}` but silently do nothing. Emit a dev-visible warning:
      `[wibwob] command "start" intercepted by focusOrCreate — did you mean direct: true?`

- [ ] `createWindow` warns if required hooks aren't registered
      File: `src/services/microapp-loader.ts` or `src/sdk/microapp-host.ts`
      After the action callback returns, check `describeState`, `captureText`,
      `onCleanup`, `onRestyle` were all registered. Log a warning if any missing.

---

## From issue #135 — blessed violation cleanup

Pre-existing blessed imports now have eslint-disable comments (landed in cleanup branch).
New violations are blocked by the pre-commit hook. Remaining work:

- [ ] Human review: classify each active microapp as keep / merge / archive / delete
      (do this before SDK refactor — don't refactor apps that should be removed)
      Active apps with blessed imports (post-cleanup branch):
      asciicker, demo-ansi-lab, demo-dashboards-v2, demo-e026-demo,
      demo-forms-playground, demo-glitchbox, demo-layout-stress-test,
      demo-patchbay-lab, figlet-banner, journal, layout-probe,
      llm-orch-studio, monster-cam, pi-sessions, runtime-inspector,
      sdk-showcase, slap-editor, spore-clock, symbient-twitter,
      terminal, theattyr, wibwobworld, wiretext, world-chatroom

- [ ] For survivors: remove eslint-disable + migrate to SDK primitives
      Extract shared patterns to SDK only when repeated in >=2 apps

- [ ] Re-run scanner after each pass, update count
      Scanner: `.pi/skills/autoresearch-microapp-migration/scripts/find-blessed-violations.sh`

---

## src/ README audit

Pre-refactor README.md files exist in src/ subdirs. Some describe structures
that may or may not match the current codebase. Audit and either delete,
update, or extract a feature from the notes.

- [ ] `src/adapters/README.md`
      Dir is empty — only contains the README itself. Describes TUI/API/CLI
      adapter pattern. Either delete or populate. Likely pre-refactor vision
      that never landed. → VERDICT NEEDED

- [ ] `src/application/README.md`
      Dir has content (rate-limit-service, runtime-command-service, etc).
      README describes "shared semantic verbs and use-case orchestration."
      May be accurate. → CHECK if README matches reality, update if not

- [ ] `src/cli/README.md`
      Long, detailed, looks current. Describes wibwob CLI, piping, instance
      targeting, agent workflows. Probably accurate — was likely maintained
      alongside the CLI. → QUICK VERIFY then keep

- [ ] `src/domain/README.md`
      Dir has content (command-definition, instance-descriptor, runtime-inspection).
      README describes "pure runtime models." Looks accurate but brief.
      → QUICK VERIFY

- [ ] `src/runtime/README.md`
      Dir has one file (runtime-node.ts). README says "stateful host runtime."
      Also says "do not duplicate src/core immediately." Possibly stale guidance
      from a migration that stalled. → CHECK if runtime-node.ts is actually used
      or if this dir is a stalled refactor

---

## Already done (from cleanup branch, can tick off against #135)

- [x] eslint rule banning blessed imports in microapps/**/*.ts
- [x] Glob widened from index.ts to microapps/**/*.ts
- [x] Pre-existing violations grandfathered with eslint-disable (27 files)
- [x] New violations blocked by pre-commit hook
- [x] 13 test microapps deleted (habit-tracker, word-counter, ascii-rain,
      sys-monitor, step-seq, pomodoro, md-preview, kanban, color-palette,
      click-counter, chat-sim, ascii-studio, dice-roller)
