/**
 * Editor open failure-path tests.
 * Tests EditorCoordinator.openFile behavior for edge cases.
 * Requires the app to be running on port 8099.
 */
import { describe, test, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const API = "http://localhost:8099";

async function post(path: string, body?: Record<string, unknown>) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() as any };
}

async function get(path: string) {
  const res = await fetch(`${API}${path}`);
  return res.json() as Promise<any>;
}

async function getEditorWindows() {
  const state = await get("/state");
  return state.windows.filter((w: any) => w.details?.appType === "text-editor");
}

async function closeWindow(id: number) {
  await post("/windows/close", { id });
}

describe("editor open failure paths", () => {
  test("nonexistent file → opens empty buffer with that path", async () => {
    const fakePath = path.join(os.tmpdir(), `wibwob-test-nonexistent-${Date.now()}.txt`);
    // Ensure it really doesn't exist
    try { fs.unlinkSync(fakePath); } catch {}

    const before = await getEditorWindows();
    await post("/commands/run", { id: "editor.open", args: { filePath: fakePath } });
    await new Promise(r => setTimeout(r, 300));
    const after = await getEditorWindows();

    const newEditors = after.filter(
      (w: any) => !before.some((b: any) => b.id === w.id)
    );
    expect(newEditors.length).toBe(1);
    // Should have the filename as title and the path set
    expect(newEditors[0].title).toBe(path.basename(fakePath));
    expect(newEditors[0].details?.filePath).toBe(fakePath);

    // Clean up
    for (const w of newEditors) await closeWindow(w.id);
  });

  test("title + initial with no filePath → opens unsaved buffer", async () => {
    const before = await getEditorWindows();
    await post("/commands/run", {
      id: "editor.open",
      args: { title: "Test Buffer", initial: "hello world" },
    });
    await new Promise(r => setTimeout(r, 300));
    const after = await getEditorWindows();

    const newEditors = after.filter(
      (w: any) => !before.some((b: any) => b.id === w.id)
    );
    expect(newEditors.length).toBe(1);
    expect(newEditors[0].title).toContain("Test Buffer");
    // Should NOT have a filePath (unsaved buffer)
    expect(newEditors[0].details?.filePath).toBeUndefined();
    // Content should contain our initial text
    expect(newEditors[0].details?.contentPreview).toContain("hello world");

    // Clean up
    for (const w of newEditors) await closeWindow(w.id);
  });

  test("existing readable file → opens with content", async () => {
    const tmpFile = path.join(os.tmpdir(), `wibwob-test-readable-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, "test content here", "utf8");

    const before = await getEditorWindows();
    await post("/commands/run", { id: "editor.open", args: { filePath: tmpFile } });
    await new Promise(r => setTimeout(r, 300));
    const after = await getEditorWindows();

    const newEditors = after.filter(
      (w: any) => !before.some((b: any) => b.id === w.id)
    );
    expect(newEditors.length).toBe(1);
    expect(newEditors[0].details?.filePath).toBe(tmpFile);
    expect(newEditors[0].title).toBe(path.basename(tmpFile));
    // Verify content was loaded
    expect(newEditors[0].details?.contentPreview).toContain("test content here");

    // Clean up
    for (const w of newEditors) await closeWindow(w.id);
    try { fs.unlinkSync(tmpFile); } catch {}
  });

  test("no args via API → fails cleanly and leaves no overlay behind", async () => {
    const result = await post("/commands/run", { id: "editor.open" });
    expect(result.status).toBe(404);
    expect(result.data.ok).toBe(false);
    expect(result.data.error).toContain("non-interactive control surface");
    await new Promise(r => setTimeout(r, 300));
    const health = await get("/health");
    expect(health.ok).toBe(true);
    expect(typeof health.instanceId).toBe("string");
    const overlay = await get("/overlay/info");
    expect(overlay.ok).toBe(true);
    expect(overlay.result.active).toBe(false);
  });
});
