/**
 * Unit tests for wibwob-router.ts — pure routing logic, no TUI deps.
 */
import { describe, expect, test } from "bun:test";
import { route } from "./wibwob-router.js";

describe("route — file paths", () => {
  test("routes .ts to editor.open", () => {
    const r = route({ path: "/foo/bar.ts" });
    expect(r).not.toBeNull();
    expect(r!.commands).toHaveLength(1);
    expect(r!.commands[0].id).toBe("editor.open");
    expect(r!.commands[0].args.filePath).toBe("/foo/bar.ts");
  });

  test("routes .md to markdown.open", () => {
    const r = route({ path: "/foo/README.md" });
    expect(r!.commands[0].id).toBe("markdown.open");
  });

  test("routes .txt to primer.open", () => {
    const r = route({ path: "/foo/art.txt" });
    expect(r!.commands[0].id).toBe("primer.open");
  });

  test("routes .png to primer.open", () => {
    const r = route({ path: "/img/photo.png" });
    expect(r!.commands[0].id).toBe("primer.open");
  });

  test("routes .json to editor.open", () => {
    const r = route({ path: "/config/package.json" });
    expect(r!.commands[0].id).toBe("editor.open");
  });

  test("routes .yaml to editor.open", () => {
    const r = route({ path: "/config/ci.yaml" });
    expect(r!.commands[0].id).toBe("editor.open");
  });

  test("routes .css to editor.open", () => {
    const r = route({ path: "/styles/main.css" });
    expect(r!.commands[0].id).toBe("editor.open");
  });

  test("routes .py to editor.open", () => {
    const r = route({ path: "/scripts/train.py" });
    expect(r!.commands[0].id).toBe("editor.open");
  });

  test("routes .sh to editor.open", () => {
    const r = route({ path: "/scripts/deploy.sh" });
    expect(r!.commands[0].id).toBe("editor.open");
  });

  test("unknown extension defaults to editor.open", () => {
    const r = route({ path: "/foo/bar.xyz" });
    expect(r!.commands[0].id).toBe("editor.open");
  });

  test("includes line number when provided", () => {
    const r = route({ path: "/foo/bar.ts", line: 42 });
    expect(r!.commands[0].args.line).toBe(42);
  });

  test("resolves relative paths to absolute", () => {
    const r = route({ path: "src/app.ts" });
    expect(r!.commands[0].args.filePath).toMatch(/^\//);
  });
});

describe("route — directories", () => {
  test("routes existing directory to finder.open + finder.navigate", () => {
    const r = route({ path: "/tmp" });
    expect(r!.commands).toHaveLength(2);
    expect(r!.commands[0].id).toBe("finder.open");
    expect(r!.commands[1].id).toBe("finder.navigate");
    expect(r!.commands[1].args.path).toBe("/tmp");
  });

  test("directory with app hint uses that app", () => {
    const r = route({ path: "/tmp", app: "editor" });
    expect(r!.commands).toHaveLength(1);
    expect(r!.commands[0].id).toBe("editor.open");
  });
});

describe("route — app hint override", () => {
  test("app hint overrides extension mapping", () => {
    const r = route({ path: "/foo/bar.ts", app: "finder" });
    expect(r!.commands[0].id).toBe("finder.open");
  });

  test("app hint 'markdown' on a .json file", () => {
    const r = route({ path: "/foo/data.json", app: "markdown" });
    expect(r!.commands[0].id).toBe("markdown.open");
  });

  test("app hint 'primer' on a .ts file", () => {
    const r = route({ path: "/foo/code.ts", app: "primer" });
    expect(r!.commands[0].id).toBe("primer.open");
  });
});

describe("route — wibwob:// URLs", () => {
  test("wibwob://open?path=/foo/bar.md routes to markdown.open", () => {
    const r = route({ url: "wibwob://open?path=/foo/bar.md" });
    expect(r!.commands[0].id).toBe("markdown.open");
    expect(r!.commands[0].args.filePath).toBe("/foo/bar.md");
  });

  test("wibwob://open?path=/foo/bar.ts&line=10 includes line", () => {
    const r = route({ url: "wibwob://open?path=/foo/bar.ts&line=10" });
    expect(r!.commands[0].id).toBe("editor.open");
    expect(r!.commands[0].args.line).toBe(10);
  });

  test("wibwob://open?path=/foo/bar.ts&app=primer respects app hint", () => {
    const r = route({ url: "wibwob://open?path=/foo/bar.ts&app=primer" });
    expect(r!.commands[0].id).toBe("primer.open");
  });

  test("wibwob://command?id=primer.open&args.filePath=/tmp/art.txt dispatches directly", () => {
    const r = route({ url: "wibwob://command?id=primer.open&args.filePath=/tmp/art.txt" });
    expect(r!.commands[0].id).toBe("primer.open");
    expect(r!.commands[0].args.filePath).toBe("/tmp/art.txt");
  });

  test("wibwob://command with multiple args", () => {
    const r = route({ url: "wibwob://command?id=editor.open&args.filePath=/f.ts&args.line=5" });
    expect(r!.commands[0].id).toBe("editor.open");
    expect(r!.commands[0].args.filePath).toBe("/f.ts");
    expect(r!.commands[0].args.line).toBe("5"); // URL params are strings
  });

  test("wibwob://shader?name=glow routes to ghostty.shader.set", () => {
    const r = route({ url: "wibwob://shader?name=glow" });
    expect(r!.commands[0].id).toBe("ghostty.shader.set");
    expect(r!.commands[0].args.name).toBe("glow");
  });

  test("wibwob://open without path returns null", () => {
    const r = route({ url: "wibwob://open" });
    expect(r).toBeNull();
  });

  test("invalid URL returns null", () => {
    const r = route({ url: "not-a-url" });
    expect(r).toBeNull();
  });

  test("non-wibwob protocol returns null", () => {
    const r = route({ url: "https://example.com" });
    expect(r).toBeNull();
  });

  test("unknown action returns null", () => {
    const r = route({ url: "wibwob://unknown-action" });
    expect(r).toBeNull();
  });
});

describe("route — edge cases", () => {
  test("empty intent returns null", () => {
    const r = route({});
    expect(r).toBeNull();
  });

  test("path with no extension defaults to editor.open", () => {
    const r = route({ path: "/foo/Makefile" });
    expect(r!.commands[0].id).toBe("editor.open");
  });

  test(".ascii routes to primer.open", () => {
    const r = route({ path: "/art/logo.ascii" });
    expect(r!.commands[0].id).toBe("primer.open");
  });

  test(".ans routes to primer.open", () => {
    const r = route({ path: "/art/banner.ans" });
    expect(r!.commands[0].id).toBe("primer.open");
  });
});
