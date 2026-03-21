import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createTimer,
  clearTimers,
  createStatusBar,
  createHeaderBar,
  createCanvas,
} from "../../src/services/microapp-sdk.js";

const APP_TITLE = "Dice Roller";

// ASCII art for each die face (5x5 grid)
const DICE_FACES: Record<number, string[]> = {
  1: [
    "┌─────────┐",
    "│         │",
    "│    ●    │",
    "│         │",
    "└─────────┘",
  ],
  2: [
    "┌─────────┐",
    "│ ●       │",
    "│         │",
    "│       ● │",
    "└─────────┘",
  ],
  3: [
    "┌─────────┐",
    "│ ●       │",
    "│    ●    │",
    "│       ● │",
    "└─────────┘",
  ],
  4: [
    "┌─────────┐",
    "│ ●     ● │",
    "│         │",
    "│ ●     ● │",
    "└─────────┘",
  ],
  5: [
    "┌─────────┐",
    "│ ●     ● │",
    "│    ●    │",
    "│ ●     ● │",
    "└─────────┘",
  ],
  6: [
    "┌─────────┐",
    "│ ●     ● │",
    "│ ●     ● │",
    "│ ●     ● │",
    "└─────────┘",
  ],
};

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: APP_TITLE,
    description: "Roll dice with ASCII art. Space: roll, 1-4: set dice count, r: reset history.",
    menu: [{ category: "demos", order: 202, label: APP_TITLE }],
    palette: { order: 202, label: `Open ${APP_TITLE}` },
    action: (args) => {
      let diceCount = (args?.count as number) ?? 2;
      let results: number[] = [];
      let history: number[] = [];
      let rolling = false;
      const timers = new Set<ReturnType<typeof setInterval>>();

      const win = host.createWindow({ title: APP_TITLE, width: 52, height: 16 });

      const header = createHeaderBar(win.body, {
        left: APP_TITLE,
        right: `${diceCount}d6`,
      });

      const canvas = createCanvas(win.body, {
        topOffset: 1,
        bottomOffset: 1,
      });

      const status = createStatusBar(win.body, {
        left: "space: roll  1-4: dice count  r: reset",
        right: "",
      });

      const renderDice = () => {
        if (results.length === 0) {
          canvas.setContent("\n\n    Press SPACE to roll!");
          host.screen.render();
          return;
        }

        const faces = results.map(v => DICE_FACES[v] ?? DICE_FACES[1]);
        const lines: string[] = [];
        for (let row = 0; row < 5; row++) {
          lines.push("  " + faces.map(f => f[row]).join("  "));
        }
        const total = results.reduce((a, b) => a + b, 0);
        lines.push("");
        lines.push(`  Total: ${total}  |  History: [${history.slice(-10).join(", ")}]`);

        canvas.setContent(lines.join("\n"));
        header.update({ right: `${diceCount}d6 = ${total}` });
        status.update({ right: `rolls: ${history.length}` });
        host.screen.render();
      };

      const roll = () => {
        if (rolling) return;
        rolling = true;
        let ticks = 0;
        const maxTicks = 8;

        createTimer(() => {
          ticks++;
          results = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
          renderDice();
          if (ticks >= maxTicks) {
            clearTimers(timers);
            rolling = false;
            const total = results.reduce((a, b) => a + b, 0);
            history.push(total);
            renderDice();
          }
        }, 80, timers);
      };

      canvas.element.key(["space"], roll);
      canvas.element.key(["1"], () => { diceCount = 1; header.update({ right: `${diceCount}d6` }); host.screen.render(); });
      canvas.element.key(["2"], () => { diceCount = 2; header.update({ right: `${diceCount}d6` }); host.screen.render(); });
      canvas.element.key(["3"], () => { diceCount = 3; header.update({ right: `${diceCount}d6` }); host.screen.render(); });
      canvas.element.key(["4"], () => { diceCount = 4; header.update({ right: `${diceCount}d6` }); host.screen.render(); });
      canvas.element.key(["r"], () => { history = []; results = []; renderDice(); });

      win.describeState(() => ({
        summary: `Dice Roller — ${diceCount}d6, last: [${results.join(",")}], total: ${results.reduce((a, b) => a + b, 0)}`,
        diceCount,
        results,
        total: results.reduce((a, b) => a + b, 0),
        rollCount: history.length,
      }));

      win.captureText(() => {
        if (results.length === 0) return "No rolls yet";
        return `${diceCount}d6: [${results.join(", ")}] = ${results.reduce((a, b) => a + b, 0)}`;
      });

      win.onRestyle(() => {
        header.update({});
        status.update({});
        host.screen.render();
      });

      win.onCleanup(() => {
        clearTimers(timers);
        header.destroy();
        canvas.destroy();
        status.destroy();
      });

      win.setFocusTarget(canvas.element);
      win.focus();
      renderDice();

      return { ok: true, windowId: win.id };
    },
  });
}
