import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createHeaderBar,
  createStatusBar,
  createTextViewer,
  registerMicroappHooks,
} from "../../src/services/microapp-sdk.js";

const APP_TITLE = "Word Counter";

interface Stats {
  chars: number;
  charsNoSpace: number;
  words: number;
  lines: number;
  sentences: number;
  paragraphs: number;
  readingTimeSec: number;
  uniqueWords: number;
  avgWordLen: number;
  longestWord: string;
}

function analyze(text: string): Stats {
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, "").length;
  const lines = text ? text.split("\n").length : 0;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
  const readingTimeSec = Math.ceil((words / 238) * 60); // avg 238wpm

  const wordList = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const uniqueWords = new Set(wordList).size;
  const wordLens = wordList.map((w) => w.length);
  const avgWordLen = wordList.length
    ? Math.round((wordLens.reduce((a, b) => a + b, 0) / wordList.length) * 10) / 10
    : 0;
  const longestWord = wordList.reduce((a, b) => (b.length > a.length ? b : a), "");

  return { chars, charsNoSpace, words, lines, sentences, paragraphs, readingTimeSec, uniqueWords, avgWordLen, longestWord };
}

function fmtTime(secs: number): string {
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function bar(val: number, max: number, width = 20): string {
  const filled = max > 0 ? Math.round((val / max) * width) : 0;
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function buildStatsContent(s: Stats, inputLen: number): string {
  const maxWidth = 500; // arbitrary reference for bars
  return [
    `┌─── Counts ──────────────────────────────┐`,
    `│ Characters      ${String(s.chars).padStart(8)}                │`,
    `│ Chars (no sp.)  ${String(s.charsNoSpace).padStart(8)}                │`,
    `│ Words           ${String(s.words).padStart(8)}                │`,
    `│ Lines           ${String(s.lines).padStart(8)}                │`,
    `│ Sentences       ${String(s.sentences).padStart(8)}                │`,
    `│ Paragraphs      ${String(s.paragraphs).padStart(8)}                │`,
    `└─────────────────────────────────────────┘`,
    ``,
    `┌─── Analysis ────────────────────────────┐`,
    `│ Unique words    ${String(s.uniqueWords).padStart(8)}                │`,
    `│ Avg word len    ${String(s.avgWordLen).padStart(8)}                │`,
    `│ Longest word    ${s.longestWord.slice(0, 16).padEnd(16).padStart(24)}  │`,
    `│ Reading time    ${fmtTime(s.readingTimeSec).padStart(8)}                │`,
    `└─────────────────────────────────────────┘`,
    ``,
    `Words  [${bar(s.words, 1000)}] ${s.words}`,
    inputLen === 0 ? "" : `Density [${bar(s.charsNoSpace, s.chars)}] ${s.chars > 0 ? Math.round((s.charsNoSpace / s.chars) * 100) : 0}%`,
  ]
    .join("\n")
    .trim();
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: APP_TITLE,
    description: "Live text stats. Type in the top pane; stats update in real-time. Tab: focus toggle, Ctrl-L: clear.",
    menu: [{ category: "applications", order: 215, label: APP_TITLE }],
    palette: { order: 215, label: `Open ${APP_TITLE}` },
    action: () => {
      let currentText = "";
      let stats = analyze("");

      const win = host.createWindow({ title: APP_TITLE, width: 50, height: 30 });

      const header = createHeaderBar(win.body, { left: APP_TITLE, right: "0 words" });

      // Top half: textarea for input
      const inputBox = blessed.textarea({
        parent: win.body,
        top: 1,
        left: 0,
        right: 0,
        height: "40%",
        border: "line" as const,
        label: " ✎ Type here ",
        keys: true,
        mouse: true,
        inputOnFocus: true,
        scrollable: true,
        alwaysScroll: true,
        tags: false,
        wrap: true,
        style: {
          ...host.theme().body,
          border: { fg: "cyan" },
          focus: { border: { fg: "yellow" } },
        },
      });

      // Bottom half: stats viewer
      const statsViewer = createTextViewer(win.body, {
        top: "40%",
        bottom: 1,
        wrap: false,
      });

      const status = createStatusBar(win.body, {
        left: "Tab: focus  Ctrl-L: clear",
        right: "0w 0c",
      });

      const refresh = () => {
        currentText = inputBox.getValue();
        stats = analyze(currentText);
        const content = buildStatsContent(stats, currentText.length);
        statsViewer.update({ content });
        header.update({ right: `${stats.words}w ${fmtTime(stats.readingTimeSec)}` });
        status.update({ right: `${stats.words}w ${stats.chars}c` });
        host.screen.render();
      };

      // Update on any keypress in textarea
      inputBox.on("keypress", () => {
        // Defer to let textarea process the key first
        setImmediate(refresh);
      });

      inputBox.key(["C-l"], () => {
        inputBox.setValue("");
        refresh();
      });

      inputBox.key(["tab"], () => {
        statsViewer.element.focus();
      });

      statsViewer.element.key(["tab"], () => {
        inputBox.focus();
      });

      registerMicroappHooks(win, {
        captureText: () => {
          const s = stats;
          return [
            `=== ${APP_TITLE} ===`,
            `Words: ${s.words}  Chars: ${s.chars}  Lines: ${s.lines}`,
            `Sentences: ${s.sentences}  Unique: ${s.uniqueWords}`,
            `Reading time: ${fmtTime(s.readingTimeSec)}`,
            `--- Text ---`,
            currentText.slice(0, 500),
          ].join("\n");
        },
        describeState: () => ({
          summary: `Word Counter — ${stats.words} words, ${stats.chars} chars`,
          stats,
          textPreview: currentText.slice(0, 100),
        }),
        onCleanup: () => {
          header.destroy();
          statsViewer.destroy();
          status.destroy();
          inputBox.destroy();
        },
        onRestyle: () => {
          inputBox.style = { ...host.theme().body, border: { fg: "cyan" } };
          header.update({});
          statsViewer.update({});
          status.update({});
          host.screen.render();
        },
      });

      refresh();
      win.setFocusTarget(inputBox);
      win.focus();
      inputBox.focus();

      return { ok: true, windowId: win.id };
    },
  });
}
