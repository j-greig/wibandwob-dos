/**
 * Microapp snapshot registry — unit round-trip test.
 *
 * Validates that dynamic snapshot handlers registered by microapps
 * participate correctly in serialize / restore / isPersistable.
 * No running app, no blessed, no real windows needed.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  registerDynamicSnapshot,
  registrySerialize,
  registryRestore,
  isPersistable,
} from "../../src/core/snapshot-registry.js";
import type { WindowRecord, WindowSnapshot } from "../../src/core/types.js";
import type { SnapshotRestoreActions } from "../../src/core/snapshot-registry.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APP_TYPE = "wibwob.example.hello";

/** Minimal WindowRecord stub — only describeState() is needed by the registry. */
function makeWindowRecord(appType: string, extra: Record<string, unknown> = {}): WindowRecord {
  return {
    id: "test-window-1",
    kind: "microapp",
    title: "Hello World",
    zIndex: 0,
    focused: false,
    rect: { x: 0, y: 0, w: 40, h: 10 },
    describeState: () => ({
      appType,
      summary: "Hello World",
      ...extra,
    }),
  } as unknown as WindowRecord;
}

/** Minimal SnapshotRestoreActions stub. */
function makeActions(): SnapshotRestoreActions & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    openPrimerViewer: () => { calls.push("openPrimerViewer"); },
    openTextEditor: () => { calls.push("openTextEditor"); },
    openGenerativeArt: () => { calls.push("openGenerativeArt"); },
    openPatternAnimation: () => { calls.push("openPatternAnimation"); },
    openPrimerBrowser: () => { calls.push("openPrimerBrowser"); },
    openPrimerGallery: () => { calls.push("openPrimerGallery"); },
    openReaderViewer: () => { calls.push("openReaderViewer"); },
    openFigletBanner: () => { calls.push("openFigletBanner"); },
    openBackroomsTV: () => { calls.push("openBackroomsTV"); },
    openCompanion: () => { calls.push("openCompanion"); },
    openWibwobAgent: () => { calls.push("openWibwobAgent"); },
    openMonsterCam: () => { calls.push("openMonsterCam"); },
  } as unknown as SnapshotRestoreActions & { calls: string[] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("microapp snapshot registry", () => {

  // Use a unique appType per test run to avoid cross-test pollution
  // from the module-level dynamicHandlers Map (no reset between tests).
  const uniqueId = `example.hello-world-${Date.now()}`;

  let restoreCalled = false;
  let restorePayload: Record<string, unknown> = {};

  beforeEach(() => {
    restoreCalled = false;
    restorePayload = {};
  });

  test("registerDynamicSnapshot + isPersistable", () => {
    registerDynamicSnapshot(uniqueId, {
      serialize: (window) => ({
        title: window.title,
      }),
      restore: (_snapshot, payload) => {
        restoreCalled = true;
        restorePayload = payload;
        return undefined;
      },
    });

    const window = makeWindowRecord(uniqueId);
    expect(isPersistable(window)).toBe(true);
  });

  test("registrySerialize returns payload with correct appType", () => {
    // Handler already registered by the test above (same uniqueId)
    const window = makeWindowRecord(uniqueId);
    const payload = registrySerialize(window);

    expect(payload).not.toBeUndefined();
    expect(payload!.appType).toBe(uniqueId);
    expect(payload!.title).toBe("Hello World");
  });

  test("registryRestore dispatches to dynamic handler, not warn-and-skip", () => {
    const snapshot: WindowSnapshot = {
      kind: "microapp",
      title: "Hello World",
      left: 0, top: 0, width: 40, height: 10,
      payload: { appType: uniqueId, title: "Hello World" },
    };

    const actions = makeActions();
    const result = registryRestore(snapshot, actions);

    // Dynamic modules don't return the window yet, but restore should have been called
    expect(restoreCalled).toBe(true);
    expect(restorePayload.appType).toBe(uniqueId);
    expect(restorePayload.title).toBe("Hello World");
  });

  test("isPersistable is false for unknown microapp appType", () => {
    const window = makeWindowRecord("example.unknown-app-xyz");
    expect(isPersistable(window)).toBe(false);
  });

  test("registryRestore returns false for unknown appType", () => {
    const snapshot: WindowSnapshot = {
      kind: "microapp",
      title: "Unknown",
      left: 0, top: 0, width: 40, height: 10,
      payload: { appType: "example.unknown-app-xyz" },
    };
    const actions = makeActions();
    const result = registryRestore(snapshot, actions);
    expect(result).toBeUndefined();
  });
});
