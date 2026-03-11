import { describe, expect, it } from "bun:test";

import { measurePlainTextContent, measurePrimerContent } from "../../src/services/content-measurement.js";

describe("content measurement", () => {
  it("measures mixed-width Unicode by visible cells, not code units", () => {
    const raw = [
      "plain",
      "∑(👁️,👂,👃,👅) → 🧠(∞)",
      "||👁️◄►👂👃👅||",
      "🌈👅🌈👅🌈👅🌈",
    ].join("\n");

    const measured = measurePlainTextContent(raw);
    expect(measured.measurement.columnWidth).toBe(21);
    expect(measured.measurement.recommendedWidth).toBe(23);
  });

  it("ignores primer comments and keeps frame sizing on the first visible frame", () => {
    const raw = [
      "# comment",
      "FPS=8",
      "🌈👅🌈👅",
      "---",
      "plain",
    ].join("\n");

    const measured = measurePrimerContent(raw);
    expect(measured.measurement.skippedCommentLines).toBe(1);
    expect(measured.measurement.frameCount).toBe(2);
    expect(measured.primaryFrameLines).toEqual(["🌈👅🌈👅"]);
    expect(measured.measurement.columnWidth).toBe(8);
  });
});
