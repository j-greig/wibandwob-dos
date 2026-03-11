import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import blessed from "blessed";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Emoji Test",
    menu: [{ category: "demos", order: 90, label: "Emoji Test" }],
    palette: { order: 250, label: "Emoji Test" },
    action: () => {
      const win = host.createWindow({ title: "Emoji Test", width: 70, height: 30 });
      const box = blessed.box({
        parent: win.body,
        top: 0, left: 0, right: 0, bottom: 0,
        content: [
          "Each row: 10 visual cols between pipes. Aligned = PASS.",
          "",
          "ASCII        |..........|",
          "Box draw     |──────────|",
          "Braille      |⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿|",
          "Blocks       |░▒▓█░▒▓█░▒|",
          "Arrows       |←→↑↓↔←→↑↓↔|",
          "Stars        |★☆★☆★☆★☆★☆|",
          "Math         |∀∃∅∇∈∀∃∅∇∈|",
          "",
          "--- DOUBLE WIDTH (2 cols each, 5 chars = 10 cols) ---",
          "",
          "CJK          |漢字日本語|",
          "Hangul       |한글가나다|",
          "Trigrams     |☰☱☲☳☴|",
          "Emoji faces  |😀😎🔥💀👻|",
          "Animals      |🐱🐶🐸🐙🦊|",
          "Food         |🍕🍔🌮🍣🍩|",
          "Weather      |🌞🌙⛅🌊🌸|",
          "Objects      |🚀⭐🎉❤️🌈|",
          "",
          "--- MULTI-CODEPOINT (tricky) ---",
          "",
          "Flags        |🇬🇧 🇺🇸 🇯🇵 🇫🇷 🇩🇪|",
          "Skin tones   |👋🏻 👋🏽 👋🏿|",
          "Keycaps      |1️⃣ 2️⃣ 3️⃣|",
          "ZWJ          |👨‍👩‍👧‍👦 👩‍💻|",
          "",
          "Close window: no ghost chars = cleanup PASS",
        ].join("\n"),
        style: { fg: "white" },
      });
      host.screen.render();
    },
  });
}
