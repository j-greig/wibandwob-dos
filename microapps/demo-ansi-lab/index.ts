import type { MicroappHost } from "../../src/services/microapp-sdk.js";
// eslint-disable-next-line no-restricted-imports
import blessed from "blessed";
import { execFileSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

const ANSI_LAB_ASSET_IMAGE = path.join(import.meta.dir, "assets", "cat.jpg");
const CHAFA_CACHE = new Map<string, string>();

function stripCursorToggles(raw: string): string {
  return raw.replace(/\x1b\[\?25[lh]/g, "");
}

function convertAnsiRgbToBlessedTags(raw: string): string {
  return stripCursorToggles(raw)
    .replace(/\x1b\[38;2;(\d+);(\d+);(\d+)m/g, (_m: string, r: string, g: string, b: string) => {
      const hex = ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, "0");
      return `{#${hex}-fg}`;
    })
    .replace(/\x1b\[48;2;(\d+);(\d+);(\d+)m/g, (_m: string, r: string, g: string, b: string) => {
      const hex = ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, "0");
      return `{#${hex}-bg}`;
    })
    .replace(/\x1b\[0m/g, "{/}")
    .replace(/\x1b\[7m/g, "")
    .replace(/\x1b\[[0-9;]*m/g, "");
}

function renderChafa(args: string[]): string {
  const cacheKey = JSON.stringify(args);
  const cached = CHAFA_CACHE.get(cacheKey);
  if (cached) return cached;
  if (!existsSync(ANSI_LAB_ASSET_IMAGE)) {
    const missingAssetMessage = [
      "  ERROR: missing image asset for chafa tests.",
      `  Expected: ${ANSI_LAB_ASSET_IMAGE}`,
      "  Add an image at microapps/demo-ansi-lab/assets/cat.jpg",
    ].join("\n");
    CHAFA_CACHE.set(cacheKey, missingAssetMessage);
    return missingAssetMessage;
  }

  try {
    const out = execFileSync("chafa", [...args, ANSI_LAB_ASSET_IMAGE], {
      encoding: "utf8",
      timeout: 5000,
    });
    CHAFA_CACHE.set(cacheKey, out);
    return out;
  } catch {
    const missingChafaMessage = [
      "  ERROR: chafa is unavailable for ANSI Lab preview tests.",
      "  Install chafa or skip tests 5/6/8/9/10.",
    ].join("\n");
    CHAFA_CACHE.set(cacheKey, missingChafaMessage);
    return missingChafaMessage;
  }
}

export default function init(ctx: MicroappHost) {
  ctx.registerCommand({
    id: "open",
    label: "ANSI Lab",
    description: "Test ANSI colour rendering in blessed",
    menu: [{ category: "demos", order: 10, label: "ANSI Lab" }],
    palette: { order: 300, label: "ANSI Lab" },
    action: () => {
      const win = ctx.createWindow({ title: "ANSI Lab", width: 80, height: 35 });
      let isClosing = false;

      const content = blessed.box({
        parent: win.body,
        top: 0,
        left: 0,
        right: 0,
        bottom: 2,
        mouse: true,
        keys: true,
        vi: true,
        scrollable: true,
        alwaysScroll: true,
        tags: true,
        style: { fg: "white", bg: "black" },
      });

      const status = blessed.box({
        parent: win.body,
        bottom: 0,
        left: 0,
        right: 0,
        height: 1,
        tags: true,
        style: { fg: "white", bg: "#333333" },
      });

      let currentTest = 0;
      let currentRender = "";
      const tests = [
        { name: "1: blessed {#hex-fg} tags", fn: testBlessedHexTags },
        { name: "2: blessed {color-fg} named", fn: testBlessedNamedTags },
        { name: "3: raw ANSI 256-color", fn: testRawAnsi256 },
        { name: "4: raw ANSI 24-bit", fn: testRawAnsi24bit },
        { name: "5: chafa block → blessed tags", fn: testChafaBlessedTags },
        { name: "6: chafa block raw ANSI", fn: testChafaRawAnsi },
        { name: "7: gradient blocks manual", fn: testGradientBlocks },
        { name: "8: mixed content + image", fn: testMixedContent },
        { name: "9: chafa 256-color raw", fn: testChafa256 },
        { name: "10: chafa 16-color raw", fn: testChafa16 },
      ];

      const normalizeTestIndex = (test: number) => ((test % tests.length) + tests.length) % tests.length;

      function show(test: number) {
        if (isClosing) return;
        currentTest = normalizeTestIndex(test);
        const t = tests[currentTest]!;
        currentRender = t.fn();
        content.setContent(currentRender);
        status.setContent(` ${t.name}  |  n/p = next/prev  |  ${currentTest + 1}/${tests.length}`);
        ctx.screen.render();
      }

      const requestClose = () => {
        if (isClosing) return;
        win.close();
      };

      content.key(["n", "right"], () => show(currentTest + 1));
      content.key(["p", "left"], () => show(currentTest - 1));
      content.key(["q", "escape"], requestClose);

      win.describeState(() => ({
        summary: `ANSI Lab test ${currentTest + 1}/${tests.length}`,
        testIndex: currentTest,
        testName: tests[currentTest]?.name ?? "unknown",
      }));
      win.captureText(() => {
        const header = `ANSI Lab ${currentTest + 1}/${tests.length} — ${tests[currentTest]?.name ?? "unknown"}`;
        return `${header}\n\n${currentRender}`;
      });
      win.onCleanup(() => {
        isClosing = true;
        currentRender = "";
      });

      content.focus();
      show(0);
    },
  });
}

// --- Test functions ---

function testBlessedHexTags(): string {
  const lines: string[] = [
    "  BLESSED {#hex-fg} / {#hex-bg} TAGS",
    "  ====================================",
    "",
  ];
  // Colour gradient using blessed hex tags
  for (let row = 0; row < 8; row++) {
    let line = "  ";
    for (let col = 0; col < 32; col++) {
      const r = Math.round((col / 31) * 255);
      const g = Math.round((row / 7) * 255);
      const b = 128;
      const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
      line += `{#${hex}-bg} {/#${hex}-bg}`;
    }
    lines.push(line);
  }
  lines.push("");
  lines.push("  {#ff0000-fg}RED TEXT{/#ff0000-fg}  {#00ff00-fg}GREEN TEXT{/#00ff00-fg}  {#0000ff-fg}BLUE TEXT{/#0000ff-fg}");
  lines.push("  {#ff8800-fg}{#000080-bg} ORANGE ON NAVY {/#000080-bg}{/#ff8800-fg}");
  lines.push("");
  // Half-block test
  lines.push("  Half-blocks with colour:");
  for (let i = 0; i < 16; i++) {
    const r = Math.round((i / 15) * 255);
    const hex = ((r << 16) | (0 << 8) | (255 - r)).toString(16).padStart(6, "0");
    lines.push(`  {#${hex}-fg}▄▀█▌▐{/#${hex}-fg}`);
  }
  return lines.join("\n");
}

function testBlessedNamedTags(): string {
  const colors = ["red", "green", "blue", "yellow", "magenta", "cyan", "white"];
  const lines = [
    "  BLESSED NAMED COLOUR TAGS",
    "  =========================",
    "",
  ];
  for (const c of colors) {
    lines.push(`  {${c}-fg}████████ ${c}{/${c}-fg}`);
  }
  lines.push("");
  lines.push("  Background test:");
  for (const c of colors) {
    lines.push(`  {${c}-bg} ${c.padEnd(10)} {/${c}-bg}`);
  }
  return lines.join("\n");
}

function testRawAnsi256(): string {
  const lines = [
    "  RAW ANSI 256-COLOR ESCAPE CODES",
    "  ================================",
    "  (if you see \\x1b or [38;5; these are NOT being interpreted)",
    "",
  ];
  // 256 color palette
  for (let row = 0; row < 16; row++) {
    let line = "  ";
    for (let col = 0; col < 16; col++) {
      const n = row * 16 + col;
      line += `\x1b[48;5;${n}m  \x1b[0m`;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function testRawAnsi24bit(): string {
  const lines = [
    "  RAW ANSI 24-BIT ESCAPE CODES",
    "  ==============================",
    "  (if you see \\x1b or [38;2; these are NOT being interpreted)",
    "",
  ];
  for (let row = 0; row < 8; row++) {
    let line = "  ";
    for (let col = 0; col < 40; col++) {
      const r = Math.round((col / 39) * 255);
      const g = Math.round((row / 7) * 255);
      line += `\x1b[48;2;${r};${g};128m \x1b[0m`;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function testChafaBlessedTags(): string {
  const lines = [
    "  CHAFA BLOCK → BLESSED TAGS CONVERSION",
    "  =======================================",
    "",
  ];
  const raw = renderChafa(["-f", "symbols", "-s", "60x20", "--symbols", "block", "--color-space", "rgb"]);
  lines.push(convertAnsiRgbToBlessedTags(raw));
  return lines.join("\n");
}

function testChafaRawAnsi(): string {
  const lines = [
    "  CHAFA BLOCK RAW ANSI (no conversion)",
    "  =====================================",
    "",
  ];
  const raw = renderChafa(["-f", "symbols", "-s", "60x20", "--symbols", "block", "--color-space", "rgb"]);
  lines.push(stripCursorToggles(raw));
  return lines.join("\n");
}

function testGradientBlocks(): string {
  const lines = [
    "  MANUAL GRADIENT WITH HALF-BLOCKS",
    "  ==================================",
    "",
  ];
  // Use blessed tags to colour half-block chars
  for (let row = 0; row < 12; row++) {
    let line = "  ";
    for (let col = 0; col < 40; col++) {
      const r = Math.round((col / 39) * 255);
      const g = Math.round(((11 - row) / 11) * 255);
      const b = Math.round(Math.sin(col * 0.2) * 127 + 128);
      const fhex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
      // Bottom half uses shifted colour
      const r2 = Math.round(((39 - col) / 39) * 255);
      const bhex = ((r2 << 16) | (g << 8) | b).toString(16).padStart(6, "0");
      line += `{#${fhex}-fg}{#${bhex}-bg}▀{/}`;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function testChafa256(): string {
  const lines = [
    "  CHAFA 256-COLOR MODE (-c 256)",
    "  ==============================",
    "",
  ];
  const raw = renderChafa(["-f", "symbols", "-c", "256", "-s", "60x20", "--symbols", "block"]);
  lines.push(stripCursorToggles(raw));
  return lines.join("\n");
}

function testChafa16(): string {
  const lines = [
    "  CHAFA 16-COLOR MODE (-c 16)",
    "  ============================",
    "",
  ];
  const raw = renderChafa(["-f", "symbols", "-c", "16", "-s", "60x20", "--symbols", "block"]);
  lines.push(stripCursorToggles(raw));
  return lines.join("\n");
}

function testMixedContent(): string {
  const lines = [
    "  MIXED: TEXT + BLESSED-TAGGED IMAGE",
    "  ====================================",
    "",
    "  Here is some normal text above an image.",
    "",
  ];
  const raw = renderChafa(["-f", "symbols", "-s", "40x12", "--symbols", "block", "--color-space", "rgb"]);
  lines.push(convertAnsiRgbToBlessedTags(raw));
  lines.push("");
  lines.push("  And here is text below the image. All good?");
  return lines.join("\n");
}
