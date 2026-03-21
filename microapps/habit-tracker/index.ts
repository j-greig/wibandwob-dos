import path from "node:path";
import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createHeaderBar,
  createStatusBar,
  createTextViewer,
  safeReadJSON,
  safeWriteFile,
  registerMicroappHooks,
} from "../../src/services/microapp-sdk.js";

const APP_TITLE = "Habit Tracker";

// ── Data model ──────────────────────────────────────────────────────────────

interface Habit {
  id: string;
  name: string;
  emoji: string;
  createdAt: string; // ISO date YYYY-MM-DD
}

interface CompletionRecord {
  [date: string]: string[]; // date -> array of habit ids completed
}

interface HabitData {
  version: 1;
  habits: Habit[];
  completions: CompletionRecord;
}

const DEFAULT_HABITS: Habit[] = [
  { id: "h1", name: "Exercise", emoji: "🏃", createdAt: today() },
  { id: "h2", name: "Read", emoji: "📖", createdAt: today() },
  { id: "h3", name: "Meditate", emoji: "🧘", createdAt: today() },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBack(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function dataPath(repoRoot: string): string {
  return path.join(repoRoot, "scratch", "microapps", "habit-tracker", "data.json");
}

function loadData(repoRoot: string): HabitData {
  const saved = safeReadJSON<HabitData>(dataPath(repoRoot));
  if (saved && saved.version === 1) return saved;
  return { version: 1, habits: DEFAULT_HABITS, completions: {} };
}

function saveData(repoRoot: string, data: HabitData): void {
  safeWriteFile(dataPath(repoRoot), JSON.stringify(data, null, 2));
}

// ── Streak calculation ───────────────────────────────────────────────────────

function currentStreak(data: HabitData, habitId: string): number {
  let streak = 0;
  let d = today();
  // Count from yesterday if not yet done today
  const todayDone = (data.completions[today()] ?? []).includes(habitId);
  if (!todayDone) d = daysBack(1);
  for (let i = 0; i < 365; i++) {
    const done = (data.completions[d] ?? []).includes(habitId);
    if (!done) break;
    streak++;
    d = daysBack(i + (todayDone ? 1 : 2));
  }
  return streak;
}

function longestStreak(data: HabitData, habitId: string): number {
  let best = 0;
  let current = 0;
  // Walk last 365 days oldest-first
  for (let i = 364; i >= 0; i--) {
    const d = daysBack(i);
    const done = (data.completions[d] ?? []).includes(habitId);
    if (done) {
      current++;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

function completionRate(data: HabitData, habitId: string, days = 30): number {
  let done = 0;
  const habit = data.habits.find((h) => h.id === habitId);
  if (!habit) return 0;
  const start = new Date(habit.createdAt);
  for (let i = 0; i < days; i++) {
    const d = daysBack(i);
    if (new Date(d) < start) break;
    if ((data.completions[d] ?? []).includes(habitId)) done++;
  }
  const total = Math.min(days, Math.ceil((Date.now() - start.getTime()) / 86400000) + 1);
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

// ── Mini calendar: last 21 days as ■/□ ──────────────────────────────────────

function miniCalendar(data: HabitData, habitId: string, cols = 21): string {
  let s = "";
  for (let i = cols - 1; i >= 0; i--) {
    const d = daysBack(i);
    s += (data.completions[d] ?? []).includes(habitId) ? "■" : "□";
  }
  return s;
}

// ── Detail panel content ─────────────────────────────────────────────────────

function buildDetail(data: HabitData, habit: Habit | undefined): string {
  if (!habit) return "  No habit selected.";
  const todayDone = (data.completions[today()] ?? []).includes(habit.id);
  const cur = currentStreak(data, habit.id);
  const best = longestStreak(data, habit.id);
  const rate = completionRate(data, habit.id, 30);
  const cal = miniCalendar(data, habit.id, 21);
  const bar = (pct: number, w = 20) =>
    "█".repeat(Math.round((pct / 100) * w)) + "░".repeat(w - Math.round((pct / 100) * w));

  return [
    `  ${habit.emoji}  ${habit.name}`,
    `  Since: ${habit.createdAt}`,
    ``,
    `  Today:   ${todayDone ? "✓ Done" : "○ Pending"}`,
    `  Streak:  ${cur} day${cur !== 1 ? "s" : ""} 🔥`,
    `  Best:    ${best} day${best !== 1 ? "s" : ""}`,
    ``,
    `  30-day rate`,
    `  [${bar(rate)}] ${rate}%`,
    ``,
    `  Last 21 days (oldest→today)`,
    `  ${cal}`,
    ``,
    `  ─── Keys ─────────────────`,
    `  space  toggle today`,
    `  a      add habit`,
    `  d      delete habit`,
    `  h      history (28d)`,
  ].join("\n");
}

function buildHistory(data: HabitData): string {
  const lines: string[] = ["  28-day completion matrix", ""];
  // Header row: day numbers
  const header = "  Habit                    " +
    Array.from({ length: 28 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (27 - i));
      return d.getDate().toString().padStart(2);
    }).join("");
  lines.push(header);
  lines.push("  " + "─".repeat(header.length - 2));

  for (const habit of data.habits) {
    const row = Array.from({ length: 28 }, (_, i) => {
      const d = daysBack(27 - i);
      return (data.completions[d] ?? []).includes(habit.id) ? " ■" : " □";
    }).join("");
    const name = `${habit.emoji} ${habit.name}`.slice(0, 22).padEnd(22);
    lines.push(`  ${name}   ${row}`);
  }

  lines.push("");
  lines.push("  ■ done  □ missed  Press h to return");
  return lines.join("\n");
}

// ── Main setup ───────────────────────────────────────────────────────────────

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: APP_TITLE,
    description: "Daily habit tracker. space: toggle, a: add, d: delete, h: history.",
    menu: [{ category: "applications", order: 220, label: APP_TITLE }],
    palette: { order: 220, label: `Open ${APP_TITLE}` },
    action: () => {
      const data = loadData(host.repoRoot);
      let selectedIdx = 0;
      let showHistory = false;

      const win = host.createWindow({ title: APP_TITLE, width: 76, height: 26 });

      const header = createHeaderBar(win.body, {
        left: APP_TITLE,
        right: today(),
      });

      // ── Left pane: habit list ──────────────────────────────────────────────
      const listBox = blessed.box({
        parent: win.body,
        top: 1,
        left: 0,
        width: "40%",
        bottom: 1,
        border: "line" as const,
        label: " Habits ",
        style: { ...host.theme().body, border: { fg: "cyan" } },
      });

      const list = blessed.list({
        parent: listBox,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        keys: true,
        vi: true,
        mouse: true,
        items: [],
        style: {
          ...host.theme().body,
          selected: { fg: "black", bg: "cyan" },
        },
      } as Record<string, unknown>);

      // ── Right pane: detail / history ───────────────────────────────────────
      const detailViewer = createTextViewer(win.body, {
        top: 1,
        left: "40%",
        bottom: 1,
        wrap: false,
      });

      const status = createStatusBar(win.body, {
        left: "space: toggle  a: add  d: del  h: history  s: save",
        right: "",
      });

      // ── Helpers ────────────────────────────────────────────────────────────

      const todayCompletions = (): string[] => data.completions[today()] ?? [];

      const setTodayCompletions = (ids: string[]) => {
        data.completions[today()] = ids;
      };

      const isHabitDone = (habitId: string) => todayCompletions().includes(habitId);

      const buildListItems = (): string[] =>
        data.habits.map((h, i) => {
          const done = isHabitDone(h.id);
          const streak = currentStreak(data, h.id);
          const marker = done ? "✓" : "○";
          const streakBadge = streak > 0 ? ` 🔥${streak}` : "";
          const prefix = i === selectedIdx ? "▶ " : "  ";
          return `${prefix}${marker} ${h.emoji} ${h.name}${streakBadge}`;
        });

      const doneCount = () => data.habits.filter((h) => isHabitDone(h.id)).length;

      const refresh = () => {
        const items = buildListItems();
        (list as any).setItems(items);
        (list as any).select(selectedIdx);

        if (showHistory) {
          detailViewer.update({ content: buildHistory(data) });
        } else {
          const habit = data.habits[selectedIdx];
          detailViewer.update({ content: buildDetail(data, habit) });
        }

        header.update({
          left: showHistory ? `${APP_TITLE} — History` : APP_TITLE,
          right: `${doneCount()}/${data.habits.length} today`,
        });
        status.update({ right: `${doneCount()}/${data.habits.length} done` });
        host.screen.render();
      };

      // ── Key bindings ───────────────────────────────────────────────────────

      const focusTarget = list as unknown as blessed.Widgets.ListElement;

      focusTarget.key(["up", "k"], () => {
        selectedIdx = Math.max(0, selectedIdx - 1);
        refresh();
      });

      focusTarget.key(["down", "j"], () => {
        selectedIdx = Math.min(data.habits.length - 1, selectedIdx + 1);
        refresh();
      });

      focusTarget.key(["space"], () => {
        const habit = data.habits[selectedIdx];
        if (!habit) return;
        const ids = todayCompletions();
        if (ids.includes(habit.id)) {
          setTodayCompletions(ids.filter((id) => id !== habit.id));
        } else {
          setTodayCompletions([...ids, habit.id]);
        }
        saveData(host.repoRoot, data);
        refresh();
      });

      focusTarget.key(["a"], () => {
        host.promptValue("New habit name", "", (name) => {
          if (!name.trim()) return;
          const id = `h${Date.now()}`;
          const emojis = ["⭐", "💪", "🌱", "🎯", "🧠", "🎨", "✍️", "🚶"];
          const emoji = emojis[data.habits.length % emojis.length]!;
          data.habits.push({ id, name: name.trim(), emoji, createdAt: today() });
          selectedIdx = data.habits.length - 1;
          saveData(host.repoRoot, data);
          refresh();
        });
      });

      focusTarget.key(["d"], () => {
        const habit = data.habits[selectedIdx];
        if (!habit) return;
        data.habits = data.habits.filter((h) => h.id !== habit.id);
        selectedIdx = Math.min(selectedIdx, data.habits.length - 1);
        saveData(host.repoRoot, data);
        host.flash(`Deleted: ${habit.name}`);
        refresh();
      });

      focusTarget.key(["h"], () => {
        showHistory = !showHistory;
        refresh();
      });

      focusTarget.key(["s"], () => {
        saveData(host.repoRoot, data);
        host.flash("Saved!");
      });

      // ── Workspace persistence ──────────────────────────────────────────────
      host.registerSnapshot({
        serialize: () => ({ selectedIdx }),
        restore: (_snap, _payload) => {
          host.runCommand("open");
        },
      });

      // ── Hook registration ──────────────────────────────────────────────────
      registerMicroappHooks(win, {
        captureText: () => {
          const lines = [
            `=== ${APP_TITLE} — ${today()} ===`,
            `Done: ${doneCount()}/${data.habits.length}`,
            ``,
            ...data.habits.map((h) => {
              const done = isHabitDone(h.id);
              const streak = currentStreak(data, h.id);
              return `${done ? "✓" : "○"} ${h.emoji} ${h.name} (streak: ${streak})`;
            }),
          ];
          return lines.join("\n");
        },
        describeState: () => ({
          summary: `Habit Tracker — ${doneCount()}/${data.habits.length} habits done today`,
          date: today(),
          habits: data.habits.map((h) => ({
            name: h.name,
            doneToday: isHabitDone(h.id),
            streak: currentStreak(data, h.id),
            longestStreak: longestStreak(data, h.id),
            rate30d: completionRate(data, h.id, 30),
          })),
          totalDone: doneCount(),
          totalHabits: data.habits.length,
        }),
        onCleanup: () => {
          header.destroy();
          detailViewer.destroy();
          status.destroy();
          listBox.destroy();
        },
        onRestyle: () => {
          listBox.style = { ...host.theme().body, border: { fg: "cyan" } };
          (list as any).style = {
            ...host.theme().body,
            selected: { fg: "black", bg: "cyan" },
          };
          header.update({});
          detailViewer.update({});
          status.update({});
          host.screen.render();
        },
      });

      win.setFocusTarget(focusTarget);
      win.focus();
      focusTarget.focus();
      refresh();

      return { ok: true, windowId: win.id };
    },
  });
}
