import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import blessed from "blessed";

// ── ASCII dice face art ────────────────────────────────────────────────────
//
// Each face is 7 wide × 5 tall (including border).
//
//   ┌─────┐
//   │ · · │
//   │  ·  │
//   │ · · │
//   └─────┘
//
const DICE_FACES: Record<number, string[]> = {
  1: [
    "┌─────┐",
    "│     │",
    "│  ●  │",
    "│     │",
    "└─────┘",
  ],
  2: [
    "┌─────┐",
    "│ ●   │",
    "│     │",
    "│   ● │",
    "└─────┘",
  ],
  3: [
    "┌─────┐",
    "│ ●   │",
    "│  ●  │",
    "│   ● │",
    "└─────┘",
  ],
  4: [
    "┌─────┐",
    "│ ● ● │",
    "│     │",
    "│ ● ● │",
    "└─────┘",
  ],
  5: [
    "┌─────┐",
    "│ ● ● │",
    "│  ●  │",
    "│ ● ● │",
    "└─────┘",
  ],
  6: [
    "┌─────┐",
    "│ ● ● │",
    "│ ● ● │",
    "│ ● ● │",
    "└─────┘",
  ],
};

const FACE_WIDTH = 7;
const FACE_HEIGHT = 5;
const FACE_GAP = 1; // spaces between dice

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function rollDice(count: number): number[] {
  return Array.from({ length: count }, () => rollDie());
}

/** Render multiple dice side-by-side as a single multi-line string. */
function renderDiceRow(values: number[]): string {
  const lines: string[] = [];
  for (let row = 0; row < FACE_HEIGHT; row++) {
    const rowParts = values.map((v) => DICE_FACES[v]![row] ?? "       ");
    lines.push(rowParts.join(" ".repeat(FACE_GAP)));
  }
  return lines.join("\n");
}

/** Total width of N dice side by side. */
function diceRowWidth(count: number): number {
  return count * FACE_WIDTH + (count - 1) * FACE_GAP;
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Dice Roller",
    description: "Roll 1-6 dice and display ASCII faces. Args: count (1-6, default 2).",
    action: (args) => {
      const rawCount = args?.count as number | undefined;
      const count = Math.min(6, Math.max(1, Math.round(rawCount ?? 2)));
      openDiceRoller(count);
    },
    palette: { order: 75, label: "Dice Roller" },
    menu: [{ category: "applications", order: 75, label: "Dice Roller" }],
    direct: true,
  });

  function openDiceRoller(initialCount: number) {
    let count = initialCount;
    let values = rollDice(count);

    // Window size: dice row + padding + 4 rows for header/footer/button
    const windowWidth = Math.max(diceRowWidth(6), 44) + 4; // max width for 6 dice + padding
    const windowHeight = FACE_HEIGHT + 8; // dice + header + status + button

    const win = host.createWindow({
      title: "Dice Roller",
      width: windowWidth,
      height: windowHeight,
    });

    const t = host.theme();

    // ── Header bar ──
    const header = blessed.box({
      parent: win.body,
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      tags: false,
      content: " 🎲 Dice Roller — press [r] to roll, [+/-] to add/remove dice ",
      style: t.header,
    });

    // ── Dice display area ──
    const diceView = blessed.box({
      parent: win.body,
      top: 1,
      left: 0,
      right: 0,
      height: FACE_HEIGHT + 1,
      tags: false,
      style: t.body,
    });

    // ── Status bar (shows sum) ──
    const statusBar = blessed.box({
      parent: win.body,
      bottom: 2,
      left: 0,
      right: 0,
      height: 1,
      tags: false,
      style: t.footer ?? t.header,
    });

    // ── Roll button ──
    const rollBtn = blessed.box({
      parent: win.body,
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      mouse: true,
      clickable: true,
      tags: false,
      content: " [ Roll! ] ",
      style: { ...t.header, hover: t.selected },
    });

    function render() {
      const art = renderDiceRow(values);
      const sum = values.reduce((a, b) => a + b, 0);
      const diceLabel = count === 1 ? "die" : "dice";
      const centeredArt = art
        .split("\n")
        .map((line) => {
          const totalWidth = Math.max(0, Number(diceView.width) - 2);
          const pad = Math.max(0, Math.floor((totalWidth - diceRowWidth(count)) / 2));
          return " ".repeat(pad) + line;
        })
        .join("\n");

      diceView.setContent(centeredArt);
      statusBar.setContent(
        ` ${count} ${diceLabel} → sum: ${sum}  |  values: [${values.join(", ")}]  |  [+/-] dice  [r] roll`,
      );
      header.setContent(
        ` 🎲 Dice Roller — ${count} ${diceLabel}  |  press [r] to roll`,
      );
      host.screen.render();
    }

    function doRoll() {
      values = rollDice(count);
      render();
    }

    function addDie() {
      if (count < 6) {
        count++;
        values = rollDice(count);
        render();
      }
    }

    function removeDie() {
      if (count > 1) {
        count--;
        values = rollDice(count);
        render();
      }
    }

    // ── Key bindings ──
    diceView.keys = true;
    diceView.mouse = true;

    diceView.key(["r", "space"], doRoll);
    diceView.key(["+", "="], addDie);
    diceView.key(["-", "_"], removeDie);

    rollBtn.on("click", doRoll);

    // ── SDK hooks ──
    win.describeState(() => ({
      summary: `Dice roller: ${count} dice — [${values.join(", ")}] = ${values.reduce((a, b) => a + b, 0)}`,
      appType: "dice-roller",
      count,
      values,
      sum: values.reduce((a, b) => a + b, 0),
    }));

    win.captureText(() => renderDiceRow(values));

    win.onRestyle(() => {
      const nt = host.theme();
      header.style = nt.header;
      diceView.style = nt.body;
      statusBar.style = nt.footer ?? nt.header;
      rollBtn.style = { ...nt.header, hover: nt.selected };
      host.screen.render();
    });

    win.setFocusTarget(diceView);
    win.focus();

    // Initial render
    render();
  }
}
