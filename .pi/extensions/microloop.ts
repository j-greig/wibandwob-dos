/**
 * microloop.ts
 *
 * Continual self-improvement + self-prompting loop for microapp dev hygiene work.
 *
 * Commands:
 *   /microloop start [goal]   Start loop (default goal if omitted)
 *   /microloop status         Show loop status
 *   /microloop stop           Stop loop
 *   /microloop tick           Trigger next loop prompt now
 *
 * Tool:
 *   signal_microloop_success  Stop the loop when objective is satisfied
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

type MicroloopState = {
  active: boolean;
  goal: string;
  goalTemplate?: string;
  iteration: number;
  maxIterations: number;
  lastPromptAt?: number;
};

const STATE_ENTRY = "microloop-state";
const DEFAULT_GOAL =
  "Improve microapp docs + workflow reliability with measurable gates, then tighten with fresh-eyes review.";
const DEFAULT_MAX_ITERATIONS = 12;
const TARGET_PLAYBOOK = [
  "microapps/demo-forms-playground",
  "microapps/sdk-showcase",
  "microapps/demo-e026-demo",
  "microapps/demo-layout-stress-test-pi",
  "microapps/demo-ansi-lab",
] as const;

export default function microloopExtension(pi: ExtensionAPI): void {
  let state: MicroloopState = {
    active: false,
    goal: DEFAULT_GOAL,
    iteration: 0,
    maxIterations: DEFAULT_MAX_ITERATIONS,
  };

  function persist(): void {
    pi.appendEntry(STATE_ENTRY, state);
  }

  function setState(next: MicroloopState, ctx: ExtensionContext): void {
    state = next;
    persist();
    updateWidget(ctx);
  }

  function updateWidget(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;
    if (!state.active) {
      ctx.ui.setWidget("microloop", undefined);
      return;
    }
    const line = `microloop active · iter ${state.iteration}/${state.maxIterations}`;
    ctx.ui.setWidget("microloop", [ctx.ui.theme.fg("accent", line)]);
  }

  async function restore(ctx: ExtensionContext): Promise<void> {
    const entries = ctx.sessionManager.getEntries();
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i] as { type?: string; customType?: string; data?: MicroloopState };
      if (e?.type === "custom" && e?.customType === STATE_ENTRY && e.data) {
        state = e.data;
        break;
      }
    }
    updateWidget(ctx);
  }

  function hasGoalPlaceholder(rawGoal: string): boolean {
    return (
      rawGoal.includes("{next logical slice") ||
      rawGoal.includes("{next logical slice/app") ||
      rawGoal.includes("microapps/{next logical slice")
    );
  }

  function resolveIterationGoal(rawGoal: string, nextIteration: number): string {
    const looksLikePlaceholder = hasGoalPlaceholder(rawGoal);

    if (!looksLikePlaceholder) return rawGoal;

    const index = Math.max(0, (nextIteration - 1) % TARGET_PLAYBOOK.length);
    return TARGET_PLAYBOOK[index] ?? TARGET_PLAYBOOK[0]!;
  }

  function buildLoopPrompt(nextIteration: number, resolvedGoal: string, goalTemplate?: string): string {

    return [
      `MICROLOOP ITERATION ${nextIteration}/${state.maxIterations}`,
      `Goal: ${resolvedGoal}`,
      goalTemplate && goalTemplate !== resolvedGoal
        ? `Goal source: auto-resolved from placeholder '${goalTemplate}'`
        : "",
      "",
      "Operating mindset:",
      "- You are a self-running, self-correcting, reliability-first engineering agent.",
      "- Be proactive: choose the next best slice without waiting for extra instruction.",
      "- Optimise for evidence over prose: run checks, gather artefacts, then conclude.",
      "- Think in systems: fix root causes and codify guardrails so the same class of failure is less likely next time.",
      "- Prefer minimal, reversible changes with clear rollback triggers.",
      "- Keep code/docs/verification in lockstep every iteration.",
      "",
      "Anti-patterns (forbidden):",
      "- Do not signal loop success after a normal iteration; success requires full-objective completion evidence.",
      "- Do not pivot targets mid-iteration after a product-level failure; finish diagnosis on the chosen target first.",
      "- Do not run `wibwob` CLI commands or call control API endpoints without an explicit instance target (CLI `-i <instance>` and matching API base/port).",
      "- Do not skip visual/runtime evidence just because API checks are green.",
      "- Do not introduce docs-only or code-only drift; paired updates are mandatory.",
      "",
      "Pre-step (required planning):",
      "- If goal is vague (e.g. '{next logical slice/app}'), first choose a concrete target and state why in 1-2 lines.",
      "- Prefer highest-leverage, lowest-risk slice: crash visibility > deterministic canary app > noisy/live-data app.",
      "- Derive command id from microapp.json (`microapp.<microapp.id>.open`), never directory slug guess.",
      "",
      "Protocol (do exactly this):",
      "1) Pick one smallest safe reliability slice (single concern, single target).",
      "2) Write a mini hypothesis before editing: expected gain, failure mode, rollback trigger.",
      "3) Apply code change.",
      "4) Sync docs in same slice (no doc drift).",
      "5) Run verification contract + visual proof.",
      "6) Run fresh-eyes pass and apply only smallest safe deltas.",
      "7) Log pain→cause→fix→canon in devlog.",
      "8) Decide keep/discard with evidence and propose next best slice.",
      "",
      "Files:",
      "- .planning/spikes/spk-microapp-dev-hygiene/README.md",
      "- .planning/spikes/spk-microapp-dev-hygiene/today-plan.md",
      "- .planning/spikes/spk-microapp-dev-hygiene/devlog.md",
      "",
      "Skills (load when relevant):",
      "- .pi/skills/simplify-docs/SKILL.md",
      "- .pi/skills/skill-creator/SKILL.md",
      "- .pi/skills/ww-ops/SKILL.md",
      "",
      "Verification command:",
      "- bash .pi/skills/autoresearch-microapp-migration/scripts/run-gates.sh <targetDir> <commandId> <signalRegex> <titleRegex> <modeField>",
      "- plus visual proof: wibwob state, wibwob map, ./scripts/screenshot-window.sh \"<title>\"",
      "",
      "Self-correction rules:",
      "- If gate fails due to harness/runtime precondition (instance down, 1x1 screen, stale socket), repair runtime once and rerun the same gate before concluding.",
      "- If failure is product-level (assertions/crashes), do not pivot targets mid-iteration; finish diagnosis and record exact blocker.",
      "- If reliability worsens, revert/discard and state the smallest safer follow-up.",
      "",
      "Fresh-eyes prompt:",
      "'Review this with fresh eyes. Assume current output is serviceable but suboptimal. Find top 3 clarity gaps, top 3 reliability risks, top 3 simplifications. Propose smallest safe edits.'",
      "",
      "Keep/discard rule:",
      "- Keep only when reliability evidence improves (or reliability unchanged with measurable simplification).",
      "- Otherwise discard and report why.",
      "",
      "Iteration report format (required):",
      "- Target + hypothesis",
      "- Changes (code + docs)",
      "- Verification commands + pass/fail",
      "- Visual artefact paths",
      "- Fresh-eyes top 3/3/3",
      "- Keep/discard decision + next slice recommendation",
      "- Loop control decision: continue | stop (with explicit reason)",
      "",
      "Stop rule:",
      "- Default is CONTINUE. Completing one good iteration is not success for the whole loop.",
      "- Call `signal_microloop_success` only when the full loop objective is complete (or user explicitly asks to stop), with verification evidence and no higher-priority next slice remaining.",
      "- If there is a viable next slice, do NOT call success signal; leave loop active.",
      "- Otherwise complete exactly one iteration and report evidence.",
    ].join("\n");
  }

  function shouldStopForLimit(): boolean {
    return state.iteration >= state.maxIterations;
  }

  function stop(ctx: ExtensionContext, reason: string): void {
    setState({ ...state, active: false }, ctx);
    if (ctx.hasUI) ctx.ui.notify(`microloop stopped: ${reason}`, "info");
  }

  function triggerNext(ctx: ExtensionContext): void {
    if (!state.active) return;
    if (shouldStopForLimit()) {
      stop(ctx, "max-iterations");
      return;
    }

    const nextIteration = state.iteration + 1;
    const goalTemplate = state.goalTemplate ?? state.goal;
    const resolvedGoal = resolveIterationGoal(goalTemplate, nextIteration);
    const persistTemplate = hasGoalPlaceholder(goalTemplate) ? goalTemplate : undefined;

    setState(
      {
        ...state,
        goal: resolvedGoal,
        goalTemplate: persistTemplate,
        iteration: nextIteration,
        lastPromptAt: Date.now(),
      },
      ctx,
    );

    const prompt = buildLoopPrompt(nextIteration, resolvedGoal, persistTemplate);

    // If idle, immediate. If busy, queue as follow-up.
    if (ctx.isIdle()) {
      pi.sendUserMessage(prompt);
    } else {
      pi.sendUserMessage(prompt, { deliverAs: "followUp" });
    }
  }

  pi.registerTool({
    name: "signal_microloop_success",
    label: "Signal microloop success",
    description: "Stop the active microloop only when the full loop objective is satisfied (or user requested stop), not after a normal iteration.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      if (!state.active) {
        return {
          content: [{ type: "text", text: "microloop is not active." }],
          details: { active: false },
        };
      }

      stop(ctx, "success-signal");
      return {
        content: [{ type: "text", text: "microloop stopped (success)." }],
        details: { active: false },
      };
    },
  });

  pi.registerCommand("microloop", {
    description: "Start/stop/status for continual microapp self-improvement loop",
    handler: async (args, ctx) => {
      const [sub, ...rest] = args.trim().split(/\s+/).filter(Boolean);
      const goalText = rest.join(" ").trim();

      if (!sub || sub === "status") {
        const status = state.active ? "active" : "inactive";
        ctx.ui.notify(
          `microloop ${status} · iter ${state.iteration}/${state.maxIterations}`,
          "info",
        );
        return;
      }

      if (sub === "stop") {
        stop(ctx, "manual");
        return;
      }

      if (sub === "start") {
        const next: MicroloopState = {
          active: true,
          goal: goalText || state.goal || DEFAULT_GOAL,
          goalTemplate: hasGoalPlaceholder(goalText || state.goal || DEFAULT_GOAL)
            ? (goalText || state.goal || DEFAULT_GOAL)
            : undefined,
          iteration: 0,
          maxIterations: state.maxIterations || DEFAULT_MAX_ITERATIONS,
          lastPromptAt: undefined,
        };
        setState(next, ctx);
        ctx.ui.notify("microloop started", "success");
        triggerNext(ctx);
        return;
      }

      if (sub === "tick") {
        if (!state.active) {
          ctx.ui.notify("microloop inactive", "warning");
          return;
        }
        triggerNext(ctx);
        return;
      }

      if (sub === "max") {
        const n = Number(rest[0]);
        if (!Number.isFinite(n) || n < 1 || n > 200) {
          ctx.ui.notify("usage: /microloop max <1..200>", "warning");
          return;
        }
        setState({ ...state, maxIterations: Math.floor(n) }, ctx);
        ctx.ui.notify(`microloop max set to ${Math.floor(n)}`, "info");
        return;
      }

      ctx.ui.notify("usage: /microloop start [goal] | status | stop | tick | max <n>", "warning");
    },
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!state.active) return;
    // Small defer avoids race with message queue flush at end of turn.
    setTimeout(() => {
      if (!state.active) return;
      triggerNext(ctx);
    }, 150);
  });

  pi.on("session_start", async (_event, ctx) => {
    await restore(ctx);
  });

  pi.on("session_switch", async (_event, ctx) => {
    await restore(ctx);
  });
}
