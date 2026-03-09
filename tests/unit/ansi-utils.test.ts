import { describe, it, expect } from "bun:test";
import { visibleWidth, wrapTextWithAnsi, padToWidth, extractAnsiCode } from "../../src/core/ansi-utils.js";

describe("visibleWidth", () => {
  it("plain ASCII", () => expect(visibleWidth("hello")).toBe(5));
  it("strips ANSI codes", () => expect(visibleWidth("\x1b[1mhello\x1b[0m")).toBe(5));
  it("emoji counts as 2", () => expect(visibleWidth("hi 👋")).toBe(5));
  it("empty string", () => expect(visibleWidth("")).toBe(0));
  it("bold+italic compound ANSI", () => expect(visibleWidth("\x1b[1m\x1b[3mtest\x1b[0m")).toBe(4));
});

describe("extractAnsiCode", () => {
  it("returns 0 for non-ANSI", () => expect(extractAnsiCode("hello", 0)).toBe(0));
  it("returns length of CSI sequence", () => {
    const s = "\x1b[1mhello";
    expect(extractAnsiCode(s, 0)).toBe(4); // \x1b[1m is 4 bytes
  });
  it("returns 0 for incomplete sequence", () => expect(extractAnsiCode("\x1b[", 0)).toBe(0));
});

describe("wrapTextWithAnsi", () => {
  it("no wrap needed", () => {
    expect(wrapTextWithAnsi("hello world", 20)).toEqual(["hello world"]);
  });
  it("wraps at word boundary", () => {
    const result = wrapTextWithAnsi("hello world foo bar", 10);
    expect(result.length).toBeGreaterThan(1);
    for (const line of result) expect(visibleWidth(line)).toBeLessThanOrEqual(10);
  });
  it("preserves ANSI across wrap", () => {
    const text = "\x1b[1mhello world this is bold text that wraps\x1b[0m";
    const result = wrapTextWithAnsi(text, 15);
    expect(result.length).toBeGreaterThan(1);
    // Each line should contain ANSI codes (bold reapplied)
    expect(result[0]).toContain("\x1b[");
  });
  it("handles empty string", () => expect(wrapTextWithAnsi("", 80)).toEqual([""]));
});

describe("padToWidth", () => {
  it("pads short string", () => {
    const result = padToWidth("hi", 5);
    expect(visibleWidth(result)).toBe(5);
  });
  it("does not truncate long string", () => {
    const result = padToWidth("hello world", 5);
    expect(result).toBe("hello world");
  });
  it("pads ANSI string correctly", () => {
    const result = padToWidth("\x1b[1mhi\x1b[0m", 6);
    expect(visibleWidth(result)).toBe(6);
  });
});
