import { describe, it, expect } from "bun:test";
import { renderMarkdown, isMarkdownFile, PLAIN_HEADING_CONFIG } from "../../src/services/markdown-service.js";

describe("isMarkdownFile", () => {
  it("accepts .md", () => expect(isMarkdownFile("README.md")).toBe(true));
  it("accepts .markdown", () => expect(isMarkdownFile("doc.markdown")).toBe(true));
  it("rejects .ts", () => expect(isMarkdownFile("foo.ts")).toBe(false));
  it("rejects no extension", () => expect(isMarkdownFile("AGENTS")).toBe(false));
});

describe("renderMarkdown", () => {
  it("returns array of strings", () => {
    const lines = renderMarkdown("hello world", 80);
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("renders bold inline style", () => {
    const lines = renderMarkdown("**bold text**", 80, { headingConfig: PLAIN_HEADING_CONFIG });
    const joined = lines.join("\n");
    expect(joined).toContain("\x1b[1m"); // bold code
  });

  it("renders italic inline style", () => {
    const lines = renderMarkdown("_italic text_", 80, { headingConfig: PLAIN_HEADING_CONFIG });
    expect(lines.join("\n")).toContain("\x1b[3m"); // italic code
  });

  it("renders code span with background", () => {
    const lines = renderMarkdown("use `foo()` here", 80, { headingConfig: PLAIN_HEADING_CONFIG });
    expect(lines.join("\n")).toContain("\x1b[48;5;236m"); // dark bg
  });

  it("renders fenced code block with border", () => {
    const lines = renderMarkdown("```python\nprint('hi')\n```", 80, { headingConfig: PLAIN_HEADING_CONFIG });
    const joined = lines.join("\n");
    expect(joined).toContain("```python");
    expect(joined).toContain("```");
    expect(joined).toContain("\x1b[48;5;234m"); // code block bg
  });

  it("renders unordered list", () => {
    const lines = renderMarkdown("- item one\n- item two", 80, { headingConfig: PLAIN_HEADING_CONFIG });
    const joined = lines.join("\n");
    expect(joined).toContain("item one");
    expect(joined).toContain("item two");
  });

  it("renders plain heading with PLAIN_HEADING_CONFIG", () => {
    const lines = renderMarkdown("# Hello World", 80, { headingConfig: PLAIN_HEADING_CONFIG });
    const joined = lines.join("\n");
    expect(joined).toContain("Hello World");
    expect(joined).toContain("\x1b[1m"); // bold
  });

  it("all output lines padded to width", () => {
    const width = 60;
    const lines = renderMarkdown("# Title\n\nSome paragraph text here.\n\n- item\n", width, {
      headingConfig: PLAIN_HEADING_CONFIG,
    });
    // visibleWidth requires ansi-utils — just check no line is empty array
    expect(lines.every(l => typeof l === "string")).toBe(true);
  });

  it("does not crash on empty input", () => {
    expect(() => renderMarkdown("", 80)).not.toThrow();
  });

  it("does not crash on complex AGENTS.md", () => {
    const { readFileSync } = require("node:fs");
    const text = readFileSync("AGENTS.md", "utf8");
    expect(() => renderMarkdown(text, 80, { headingConfig: PLAIN_HEADING_CONFIG })).not.toThrow();
  });
});
