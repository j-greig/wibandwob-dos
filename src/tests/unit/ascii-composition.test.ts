import { describe, expect, test } from "bun:test";

import { composeAsciiLayers, renderAsciiTextBlock } from "../../services/ascii-composition.js";

describe("ascii composition", () => {
  test("overwrite mode prefers later non-space glyphs", () => {
    const result = composeAsciiLayers(4, 2, [
      "A   \n    ",
      " B  \n  C ",
    ], "overwrite");

    expect(result.split("\n")[0]).toBe("AB  ");
    expect(result.split("\n")[1]).toBe("  C ");
  });

  test("mask mode marks visible occupancy rather than preserving glyph identity", () => {
    const result = composeAsciiLayers(4, 1, ["A   ", " B  "], "mask");
    expect(result).toBe("..  ");
  });

  test("renderAsciiTextBlock places text on the requested row", () => {
    const result = renderAsciiTextBlock(5, 4, "HI", 1).split("\n");
    expect(result[0]).toBe("     ");
    expect(result[1]).toBe("HI   ");
  });
});
