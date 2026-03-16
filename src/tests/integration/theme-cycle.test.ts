/**
 * Theme cycle contract tests.
 *
 * Verifies that cycling through all themes doesn't crash,
 * and that each theme produces a visually distinct screenshot.
 *
 * Runs against the live control API.
 */

import { describe, test, expect } from "bun:test";
import { allVariants } from "../../core/theme/resolver.js";

const API = process.env.API_URL ?? "http://localhost:8099";

const THEME_COUNT = allVariants().length;

async function runCommand(id: string) {
  const res = await fetch(`${API}/commands/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}

async function getScreenText(): Promise<string> {
  const res = await fetch(`${API}/screenshot/text`);
  return res.text();
}

describe("theme cycle", () => {
  test(`cycles through all ${THEME_COUNT} themes without error`, async () => {
    const screenshots: string[] = [];

    for (let i = 0; i < THEME_COUNT; i++) {
      // Capture current screen
      const text = await getScreenText();
      screenshots.push(text);

      // Toggle to next
      const result = await runCommand("theme.cycle");
      expect(result.ok).toBe(true);
    }

    // After THEME_COUNT toggles we should be back to the original
    const finalScreen = await getScreenText();
    // First and last should match (same theme)
    expect(finalScreen).toBe(screenshots[0]);
  });

  test("each theme produces distinct ANSI output", async () => {
    const screenshots: string[] = [];

    for (let i = 0; i < THEME_COUNT; i++) {
      screenshots.push(await getScreenText());
      await runCommand("theme.cycle");
    }

    // Each pair of adjacent themes should differ
    for (let i = 0; i < THEME_COUNT - 1; i++) {
      expect(screenshots[i]).not.toBe(screenshots[i + 1]);
    }
  });
});
