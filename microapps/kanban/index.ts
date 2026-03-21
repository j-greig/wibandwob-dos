import path from "node:path";
import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createHeaderBar,
  createStatusBar,
  createManagedList,
  safeReadJSONOrDefault,
  safeWriteFile,
} from "../../src/services/microapp-sdk.js";
import type { ManagedListHandle } from "../../src/services/microapp-sdk.js";

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

const DEFAULT_DATA: KanbanData = {
  nextId: 1,
  columns: { Todo: [], "In Progress": [], Done: [] },
};

function getDataPath(repoRoot: string): string {
  return path.join(repoRoot, "scratch", "kanban-data.json");
}

function loadData(repoRoot: string): KanbanData {
  return safeReadJSONOrDefault<KanbanData>(getDataPath(repoRoot), DEFAULT_DATA);
}

function saveData(repoRoot: string, data: KanbanData): void {
  safeWriteFile(getDataPath(repoRoot), JSON.stringify(data, null, 2));
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

      // Create 3 column boxes with managed list widgets
      const colBoxes: blessed.Widgets.BoxElement[] = [];
      const colManagedLists: ManagedListHandle[] = [];

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

        const managed = createManagedList(box, {
          items: data.columns[COLUMNS[i]].map(c => c.text),
          style: { selected: { fg: "black", bg: "cyan" } },
        });

        colBoxes.push(box);
        colManagedLists.push(managed);
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
          colManagedLists[i]!.setItems(items);
          colBoxes[i]!.style.border = { fg: i === activeCol ? "cyan" : "gray" };
          colBoxes[i]!.setLabel(` ${COLUMNS[i]} (${data.columns[COLUMNS[i]].length}) `);
        }
        header.update({ right: `${totalCards()} cards` });
        status.update({ right: COLUMNS[activeCol] });
        host.screen.render();
      }

      function switchCol(dir: number) {
        activeCol = Math.max(0, Math.min(COLUMNS.length - 1, activeCol + dir));
        colManagedLists[activeCol]!.element.focus();
        refreshLists();
      }

      function getSelectedIdx(): number {
        return colManagedLists[activeCol]!.selected;
      }

      // Bind keys on each list element
      for (let i = 0; i < colManagedLists.length; i++) {
        const managed = colManagedLists[i]!;

        managed.element.key(["tab"], () => switchCol(activeCol < COLUMNS.length - 1 ? 1 : -2));

        managed.element.key(["a"], () => {
          host.promptValue("New card text", "", (text) => {
            if (text.trim()) {
              data.columns[COLUMNS[activeCol]].push({ id: data.nextId++, text: text.trim() });
              refreshLists();
            }
          });
        });

        managed.element.key(["d"], () => {
          const idx = getSelectedIdx();
          const cards = data.columns[COLUMNS[activeCol]];
          if (cards.length > 0 && idx < cards.length) {
            cards.splice(idx, 1);
            refreshLists();
          }
        });

        managed.element.key(["right"], () => {
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

        managed.element.key(["left"], () => {
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

        managed.element.key(["s"], () => {
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
          colManagedLists[i]!.update();
        }
        header.update({});
        status.update({});
        host.screen.render();
      });

      win.onCleanup(() => {
        header.destroy();
        status.destroy();
        for (const managed of colManagedLists) managed.destroy();
        for (const box of colBoxes) box.destroy();
      });

      colManagedLists[0]!.element.focus();
      win.setFocusTarget(colManagedLists[0]!.element);
      refreshLists();

      return { ok: true, windowId: win.id };
    },
  });
}
