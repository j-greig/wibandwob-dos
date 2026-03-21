import fs from "node:fs";
import path from "node:path";
import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createHeaderBar,
  createStatusBar,
} from "../../src/services/microapp-sdk.js";

const APP_TITLE = "Kanban";
const COLUMNS = ["Todo", "In Progress", "Done"] as const;
type ColumnName = (typeof COLUMNS)[number];

interface KanbanCard {
  id: number;
  text: string;
}

interface KanbanData {
  nextId: number;
  columns: Record<ColumnName, KanbanCard[]>;
}

function getDataPath(repoRoot: string): string {
  return path.join(repoRoot, "scratch", "kanban-data.json");
}

function loadData(repoRoot: string): KanbanData {
  const file = getDataPath(repoRoot);
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as KanbanData;
  } catch {
    return {
      nextId: 1,
      columns: { Todo: [], "In Progress": [], Done: [] },
    };
  }
}

function saveData(repoRoot: string, data: KanbanData): void {
  const dir = path.dirname(getDataPath(repoRoot));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getDataPath(repoRoot), JSON.stringify(data, null, 2), "utf8");
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: APP_TITLE,
    description: "Kanban board with three columns. a: add card, →/←: move card, d: delete, Tab: switch column.",
    menu: [{ category: "applications", order: 208, label: APP_TITLE }],
    palette: { order: 208, label: `Open ${APP_TITLE}` },
    action: () => {
      const data = loadData(host.repoRoot);
      let activeCol = 0;

      const win = host.createWindow({ title: APP_TITLE, width: 75, height: 22 });

      const header = createHeaderBar(win.body, {
        left: APP_TITLE,
        right: `${totalCards()} cards`,
      });

      // Create 3 column boxes with list widgets
      const colWidth = () => Math.max(15, Math.floor((Number(win.body.width) || 75) / 3));
      const colBoxes: blessed.Widgets.BoxElement[] = [];
      const colLists: blessed.Widgets.ListElement[] = [];

      for (let i = 0; i < COLUMNS.length; i++) {
        const box = blessed.box({
          parent: win.body,
          top: 1,
          left: `${Math.floor((i / 3) * 100)}%`,
          width: `${Math.floor(100 / 3)}%`,
          bottom: 1,
          border: "line" as const,
          label: ` ${COLUMNS[i]} `,
          style: {
            ...host.theme().body,
            border: { fg: i === activeCol ? "cyan" : "gray" },
          },
        });

        const list = blessed.list({
          parent: box,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          keys: true,
          mouse: true,
          vi: true,
          items: data.columns[COLUMNS[i]].map(c => c.text),
          style: {
            ...host.theme().body,
            selected: { fg: "black", bg: "cyan" },
          },
        } as Record<string, unknown>);

        colBoxes.push(box);
        colLists.push(list as unknown as blessed.Widgets.ListElement);
      }

      const status = createStatusBar(win.body, {
        left: "a: add  d: delete  ←→: move  Tab: column  s: save",
        right: COLUMNS[activeCol],
      });

      function totalCards(): number {
        return COLUMNS.reduce((sum, col) => sum + data.columns[col].length, 0);
      }

      function refreshLists() {
        for (let i = 0; i < COLUMNS.length; i++) {
          const items = data.columns[COLUMNS[i]].map(c => c.text);
          (colLists[i] as any).setItems(items);
          colBoxes[i]!.style.border = { fg: i === activeCol ? "cyan" : "gray" };
          colBoxes[i]!.setLabel(` ${COLUMNS[i]} (${data.columns[COLUMNS[i]].length}) `);
        }
        header.update({ right: `${totalCards()} cards` });
        status.update({ right: COLUMNS[activeCol] });
        host.screen.render();
      }

      function switchCol(dir: number) {
        activeCol = Math.max(0, Math.min(COLUMNS.length - 1, activeCol + dir));
        colLists[activeCol]!.focus();
        refreshLists();
      }

      function getSelectedIdx(): number {
        return (colLists[activeCol] as any).selected ?? 0;
      }

      // Bind keys on each list
      for (let i = 0; i < colLists.length; i++) {
        const list = colLists[i]!;

        list.key(["tab"], () => switchCol(activeCol < COLUMNS.length - 1 ? 1 : -2));

        list.key(["a"], () => {
          host.promptValue("New card text", "", (text) => {
            if (text.trim()) {
              data.columns[COLUMNS[activeCol]].push({ id: data.nextId++, text: text.trim() });
              refreshLists();
            }
          });
        });

        list.key(["d"], () => {
          const idx = getSelectedIdx();
          const cards = data.columns[COLUMNS[activeCol]];
          if (cards.length > 0 && idx < cards.length) {
            cards.splice(idx, 1);
            refreshLists();
          }
        });

        list.key(["right"], () => {
          if (activeCol >= COLUMNS.length - 1) return;
          const idx = getSelectedIdx();
          const srcCards = data.columns[COLUMNS[activeCol]];
          if (srcCards.length > 0 && idx < srcCards.length) {
            const [card] = srcCards.splice(idx, 1);
            data.columns[COLUMNS[activeCol + 1]].push(card!);
            switchCol(1);
            refreshLists();
          }
        });

        list.key(["left"], () => {
          if (activeCol <= 0) return;
          const idx = getSelectedIdx();
          const srcCards = data.columns[COLUMNS[activeCol]];
          if (srcCards.length > 0 && idx < srcCards.length) {
            const [card] = srcCards.splice(idx, 1);
            data.columns[COLUMNS[activeCol - 1]].push(card!);
            switchCol(-1);
            refreshLists();
          }
        });

        list.key(["s"], () => {
          saveData(host.repoRoot, data);
          host.flash("Kanban saved!");
        });
      }

      // Also register snapshot for workspace persistence
      host.registerSnapshot({
        serialize: () => ({ data }),
        restore: (_snapshot, payload) => {
          host.runCommand("open", payload);
        },
      });

      win.describeState(() => ({
        summary: `Kanban — ${COLUMNS.map(c => `${c}: ${data.columns[c].length}`).join(", ")}`,
        columns: Object.fromEntries(COLUMNS.map(c => [c, data.columns[c].map(card => card.text)])),
        totalCards: totalCards(),
        activeColumn: COLUMNS[activeCol],
      }));

      win.captureText(() =>
        COLUMNS.map(c =>
          `=== ${c} ===\n${data.columns[c].map(card => `  - ${card.text}`).join("\n") || "  (empty)"}`
        ).join("\n\n")
      );

      win.onRestyle(() => {
        for (let i = 0; i < COLUMNS.length; i++) {
          colBoxes[i]!.style = {
            ...host.theme().body,
            border: { fg: i === activeCol ? "cyan" : "gray" },
          };
          (colLists[i] as any).style = {
            ...host.theme().body,
            selected: { fg: "black", bg: "cyan" },
          };
        }
        header.update({});
        status.update({});
        host.screen.render();
      });

      win.onCleanup(() => {
        header.destroy();
        status.destroy();
        for (const box of colBoxes) box.destroy();
      });

      colLists[0]!.focus();
      win.setFocusTarget(colLists[0]!);
      refreshLists();

      return { ok: true, windowId: win.id };
    },
  });
}
