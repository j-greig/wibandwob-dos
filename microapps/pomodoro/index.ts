import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createTimer,
  clearTimers,
  createStatusBar,
  createHeaderBar,
} from "../../src/services/microapp-sdk.js";

const APP_TITLE = "Pomodoro";
const WORK_SECS = 25 * 60;
const BREAK_SECS = 5 * 60;

type Phase = "work" | "break" | "idle";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: APP_TITLE,
    description: "Open a Pomodoro timer. Space: start/pause, r: reset, b: toggle work/break.",
    menu: [{ category: "applications", order: 201, label: APP_TITLE }],
    palette: { order: 201, label: `Open ${APP_TITLE}` },
    action: () => {
      let phase: Phase = "idle";
      let remaining = WORK_SECS;
      let running = false;
      let sessions = 0;
      const timers = new Set<ReturnType<typeof setInterval>>();

      const win = host.createWindow({ title: APP_TITLE, width: 44, height: 14 });

      const header = createHeaderBar(win.body, {
        left: APP_TITLE,
        right: "idle",
      });

      const display = blessed.box({
        parent: win.body,
        top: 1,
        left: 0,
        right: 0,
        bottom: 1,
        tags: true,
        content: "",
        align: "center" as const,
        valign: "middle" as const,
        style: host.theme().body,
      });

      const status = createStatusBar(win.body, {
        left: "space: start  r: reset  b: break",
        right: `sessions: ${sessions}`,
      });

      const fmt = (secs: number) => {
        const m = Math.floor(secs / 60).toString().padStart(2, "0");
        const s = (secs % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
      };

      const render = () => {
        const phaseLabel = phase === "idle" ? "IDLE" : phase === "work" ? "WORK" : "BREAK";
        const pauseLabel = running ? "" : " (paused)";
        display.setContent(`{bold}${fmt(remaining)}{/bold}\n\n${phaseLabel}${pauseLabel}`);
        header.update({ right: `${phaseLabel}${pauseLabel}` });
        status.update({ right: `sessions: ${sessions}` });
        host.screen.render();
      };

      const tick = () => {
        if (!running) return;
        remaining--;
        if (remaining <= 0) {
          if (phase === "work") {
            sessions++;
            phase = "break";
            remaining = BREAK_SECS;
            host.flash(`Pomodoro #${sessions} complete! Take a break.`);
          } else {
            phase = "work";
            remaining = WORK_SECS;
            host.flash("Break over — back to work!");
          }
        }
        render();
      };

      const start = () => {
        if (phase === "idle") phase = "work";
        if (!running) {
          running = true;
          createTimer(tick, 1000, timers);
        }
        render();
      };

      const pause = () => {
        running = false;
        clearTimers(timers);
        render();
      };

      const reset = () => {
        running = false;
        clearTimers(timers);
        phase = "idle";
        remaining = WORK_SECS;
        render();
      };

      const togglePhase = () => {
        if (phase === "work" || phase === "idle") {
          phase = "break";
          remaining = BREAK_SECS;
        } else {
          phase = "work";
          remaining = WORK_SECS;
        }
        render();
      };

      display.key(["space"], () => {
        running ? pause() : start();
      });
      display.key(["r"], reset);
      display.key(["b"], togglePhase);

      win.describeState(() => ({
        summary: `Pomodoro — ${phase} ${fmt(remaining)} ${running ? "running" : "paused"}`,
        phase,
        remaining,
        running,
        sessions,
      }));

      win.captureText(() => `${phase} ${fmt(remaining)} sessions:${sessions}`);

      win.onRestyle(() => {
        display.style = host.theme().body;
        header.update({});
        status.update({});
        host.screen.render();
      });

      win.onCleanup(() => {
        clearTimers(timers);
        header.destroy();
        status.destroy();
      });

      win.setFocusTarget(display);
      win.focus();
      render();

      return { ok: true, windowId: win.id };
    },
  });
}
