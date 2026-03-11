import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import blessed from "blessed";
import { execSync } from "child_process";

export default function init(ctx: MicroappHost) {
  ctx.registerCommand({
    id: "open",
    label: "ANSI Lab",
    description: "Test ANSI colour rendering in blessed",
    menu: [{ category: "demos", order: 10, label: "ANSI Lab" }],
    palette: { order: 300, label: "ANSI Lab" },
    action: () => {
      const win = ctx.createWindow({ title: "ANSI Lab", width: 80, height: 35 });

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

      function show(test: number) {
        currentTest = test % tests.length;
        const t = tests[currentTest]!;
        content.setContent(t.fn());
        status.setContent(` ${t.name}  |  n/p = next/prev  |  ${currentTest + 1}/${tests.length}`);
        ctx.screen.render();
      }

      content.key(["n", "right"], () => show(currentTest + 1));
      content.key(["p", "left"], () => show(currentTest - 1 + tests.length));
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
  try {
    const raw = execSync(
      "chafa -f symbols -s 60x20 --symbols block --color-space rgb /Users/james/Repos/wibandwob-dos/scratch/test-site/cat.jpg",
      { encoding: "utf8", timeout: 5000 }
    );
    // Convert ANSI → blessed tags
    const converted = raw
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
      .replace(/\x1b\[[0-9;]*m/g, "")
      .replace(/\x1b\[\?25[lh]/g, "");
    lines.push(converted);
  } catch (e) {
    lines.push("  ERROR: " + String(e));
  }
  return lines.join("\n");
}

function testChafaRawAnsi(): string {
  const lines = [
    "  CHAFA BLOCK RAW ANSI (no conversion)",
    "  =====================================",
    "",
  ];
  try {
    const raw = execSync(
      "chafa -f symbols -s 60x20 --symbols block --color-space rgb /Users/james/Repos/wibandwob-dos/scratch/test-site/cat.jpg",
      { encoding: "utf8", timeout: 5000 }
    );
    lines.push(raw.replace(/\x1b\[\?25[lh]/g, ""));
  } catch (e) {
    lines.push("  ERROR: " + String(e));
  }
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
  try {
    const raw = execSync(
      "chafa -f symbols -c 256 -s 60x20 --symbols block /Users/james/Repos/wibandwob-dos/scratch/test-site/cat.jpg",
      { encoding: "utf8", timeout: 5000 }
    );
    lines.push(raw.replace(/\x1b\[\?25[lh]/g, ""));
  } catch (e) {
    lines.push("  ERROR: " + String(e));
  }
  return lines.join("\n");
}

function testChafa16(): string {
  const lines = [
    "  CHAFA 16-COLOR MODE (-c 16)",
    "  ============================",
    "",
  ];
  try {
    const raw = execSync(
      "chafa -f symbols -c 16 -s 60x20 --symbols block /Users/james/Repos/wibandwob-dos/scratch/test-site/cat.jpg",
      { encoding: "utf8", timeout: 5000 }
    );
    lines.push(raw.replace(/\x1b\[\?25[lh]/g, ""));
  } catch (e) {
    lines.push("  ERROR: " + String(e));
  }
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
  try {
    const raw = execSync(
      "chafa -f symbols -s 40x12 --symbols block --color-space rgb /Users/james/Repos/wibandwob-dos/scratch/test-site/cat.jpg",
      { encoding: "utf8", timeout: 5000 }
    );
    const converted = raw
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
      .replace(/\x1b\[[0-9;]*m/g, "")
      .replace(/\x1b\[\?25[lh]/g, "");
    lines.push(converted);
  } catch (e) {
    lines.push("  ERROR: " + String(e));
  }
  lines.push("");
  lines.push("  And here is text below the image. All good?");
  return lines.join("\n");
}
