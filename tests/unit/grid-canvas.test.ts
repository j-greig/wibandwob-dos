import { describe, expect, it } from "bun:test";

import { visibleWidth } from "../../src/core/ansi-utils.js";
import { blankGrid, gridToText, paintCentered, paintLines, paintText } from "../../src/core/grid-canvas.js";

describe("grid canvas Unicode handling", () => {
  it("paints a wide grapheme without splitting the cluster", () => {
    const grid = blankGrid(6, 1);
    paintText(grid, 1, 0, "A👁️B");
    const rendered = gridToText(grid);
    expect(rendered.includes("👁️")).toBe(true);
    expect(visibleWidth(rendered)).toBe(6);
  });

  it("centres by visible width rather than code-unit length", () => {
    const grid = blankGrid(8, 1);
    paintCentered(grid, 0, "👁️hi");
    const rendered = gridToText(grid);
    expect(rendered.trim()).toBe("👁️hi");
    expect(visibleWidth(rendered)).toBe(8);
  });

  it("clips by visible width in paintLines", () => {
    const rendered = paintLines(5, 1, ["🌈👅🌈👅🌈"]);
    expect(visibleWidth(rendered)).toBe(5);
    expect(rendered.includes("🌈")).toBe(true);
  });
});
