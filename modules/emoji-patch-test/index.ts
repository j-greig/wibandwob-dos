/**
 * emoji-patch-test — Visual test for blessed unicode monkey-patch.
 *
 * RESULTS (as of 2026-03-11, blessed + string-width v8 patch):
 *
 * WORKING (pipes align, correct width):
 *   Single-width: ASCII, box drawing (─┐│), braille (⣿), blocks (░▒▓█),
 *                 arrows (←→↑↓), math (∀∃∅∇∈)
 *   Double-width: CJK (漢字日本), Hangul (한글가나), trigrams (☰☱☲),
 *                 emoji faces (😀😎🔥), animals (🐱🐶🐸), food (🍕🍔),
 *                 weather (🌞🌙⛅), objects (🚀⭐🎉)
 *
 * PARTIALLY WORKING (render but blessed decomposes into separate cells):
 *   Flags:      🇬🇧 shows as two regional indicator letters, not flag glyph
 *   Skin tones: 👋🏽 shows base hand + modifier as separate glyphs
 *   Keycaps:    1️⃣ renders but spacing inconsistent
 *   ZWJ:        👨‍👩‍👧‍👦 decomposes into 👨👩👧👦 (four separate emoji)
 *
 * WHY multi-codepoint fails: blessed's parseContent splits content into
 * cells one codepoint at a time (element.js ~line 2047). It only merges
 * blessed "combining" chars (from its own combining table). ZWJ (U+200D),
 * regional indicators, skin tone modifiers, and variation selectors are
 * NOT in that table, so each codepoint becomes its own cell. Fixing this
 * would require rewriting the cell builder to be grapheme-cluster-aware.
 *
 * GHOST ARTIFACTS: double-width chars leave trails when windows are dragged.
 * Mitigated by screen.alloc() before every render (forces full repaint).
 * Some minor right-border bleed on CJK/Hangul/Trigram rows persists.
 *
 * See: src/core/unicode-patch.ts, LINGO.md (unicode terms)
 */
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
