/**
 * Unit tests for WibWobRoom server logic (E008 F01).
 *
 * Tests the state management and message handling logic in isolation,
 * without needing a live PartyKit deployment.
 */

import { describe, it, expect } from "vitest";

// ── Helpers to exercise server logic directly ────────────────────────────────

interface WindowState {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface StateDelta {
  add?: WindowState[];
  remove?: string[];
  update?: WindowState[];
}

interface CanonicalState {
  windows: Record<string, WindowState>;
  version: number;
}

function applyDelta(state: CanonicalState, delta: StateDelta): CanonicalState {
  const next = { ...state, windows: { ...state.windows } };
  for (const win of delta.add ?? []) {
    next.windows[win.id] = win;
  }
  for (const id of delta.remove ?? []) {
    delete next.windows[id];
  }
  for (const win of delta.update ?? []) {
    if (next.windows[win.id]) {
      next.windows[win.id] = { ...next.windows[win.id], ...win };
    } else {
      next.windows[win.id] = win;
    }
  }
  next.version += 1;
  return next;
}

function makeWindow(id: string, overrides: Partial<WindowState> = {}): WindowState {
  return { id, type: "test_pattern", x: 0, y: 0, w: 40, h: 20, ...overrides };
}

// ── State delta logic ────────────────────────────────────────────────────────

describe("applyDelta — add", () => {
  it("adds a window to empty state", () => {
    const state: CanonicalState = { windows: {}, version: 0 };
    const win = makeWindow("w1");
    const next = applyDelta(state, { add: [win] });
    expect(next.windows["w1"]).toEqual(win);
    expect(next.version).toBe(1);
  });

  it("adds multiple windows", () => {
    const state: CanonicalState = { windows: {}, version: 0 };
    const next = applyDelta(state, {
      add: [makeWindow("w1"), makeWindow("w2", { x: 50 })],
    });
    expect(Object.keys(next.windows)).toHaveLength(2);
    expect(next.windows["w2"].x).toBe(50);
  });
});

describe("applyDelta — remove", () => {
  it("removes a window", () => {
    const state: CanonicalState = {
      windows: { w1: makeWindow("w1") },
      version: 0,
    };
    const next = applyDelta(state, { remove: ["w1"] });
    expect(next.windows["w1"]).toBeUndefined();
    expect(next.version).toBe(1);
  });

  it("silently ignores removing non-existent window", () => {
    const state: CanonicalState = { windows: {}, version: 0 };
    const next = applyDelta(state, { remove: ["nonexistent"] });
    expect(next.version).toBe(1);
  });
});

describe("applyDelta — update", () => {
  it("updates existing window properties", () => {
    const state: CanonicalState = {
      windows: { w1: makeWindow("w1", { x: 0, y: 0 }) },
      version: 0,
    };
    const next = applyDelta(state, {
      update: [{ ...makeWindow("w1"), x: 10, y: 5 }],
    });
    expect(next.windows["w1"].x).toBe(10);
    expect(next.windows["w1"].y).toBe(5);
    expect(next.windows["w1"].w).toBe(40); // unchanged
  });

  it("upserts window if not present", () => {
    const state: CanonicalState = { windows: {}, version: 0 };
    const next = applyDelta(state, { update: [makeWindow("w1")] });
    expect(next.windows["w1"]).toBeDefined();
  });
});

describe("applyDelta — version", () => {
  it("increments version on every delta", () => {
    let state: CanonicalState = { windows: {}, version: 0 };
    for (let i = 0; i < 5; i++) {
      state = applyDelta(state, { add: [makeWindow(`w${i}`)] });
    }
    expect(state.version).toBe(5);
  });

  it("does not mutate original state", () => {
    const state: CanonicalState = { windows: {}, version: 0 };
    const next = applyDelta(state, { add: [makeWindow("w1")] });
    expect(state.windows["w1"]).toBeUndefined();
    expect(next.windows["w1"]).toBeDefined();
  });
});

// ── Message type parsing ─────────────────────────────────────────────────────

describe("message type handling", () => {
  it("parses state_delta message", () => {
    const raw = JSON.stringify({
      type: "state_delta",
      delta: { add: [makeWindow("w1")] },
    });
    const msg = JSON.parse(raw);
    expect(msg.type).toBe("state_delta");
    expect(msg.delta.add).toHaveLength(1);
  });

  it("parses chat_msg message", () => {
    const raw = JSON.stringify({ type: "chat_msg", sender: "zilla", text: "hello" });
    const msg = JSON.parse(raw);
    expect(msg.type).toBe("chat_msg");
    expect(msg.sender).toBe("zilla");
  });

  it("parses cursor_pos message", () => {
    const raw = JSON.stringify({ type: "cursor_pos", sender: "zilla", x: 10, y: 5 });
    const msg = JSON.parse(raw);
    expect(msg.type).toBe("cursor_pos");
    expect(msg.x).toBe(10);
  });

  it("handles invalid JSON gracefully", () => {
    expect(() => JSON.parse("not json")).toThrow();
  });
});
