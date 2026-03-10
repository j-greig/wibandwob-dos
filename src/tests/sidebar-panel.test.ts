/**
 * Unit tests for resolveSidebarWidth — the width-resolution logic of
 * createSidebarPanel (P01 / S02).
 *
 * These are pure-logic tests: no blessed, no DOM, no running app.
 */

import { describe, test, expect } from "bun:test";
import { resolveSidebarWidth } from "../../src/core/ui-parts.js";

describe("resolveSidebarWidth", () => {
  // ── Fixed width ─────────────────────────────────────────────────────────

  test("fixed: returns the fixed value when total is large", () => {
    expect(resolveSidebarWidth(100, { fixed: 26 }, true, 12)).toBe(26);
  });

  test("fixed: no divider — full fixed width used", () => {
    expect(resolveSidebarWidth(100, { fixed: 26 }, false, 12)).toBe(26);
  });

  // ── Percent width ────────────────────────────────────────────────────────

  test("percent: basic floor calculation", () => {
    // 32% of 100 = 32
    expect(resolveSidebarWidth(100, { percent: 0.32 }, true, 12)).toBe(32);
  });

  test("percent: clamps to min when computed is below min", () => {
    // 32% of 50 = 16, min=24 → 24
    expect(resolveSidebarWidth(50, { percent: 0.32, min: 24 }, true, 12)).toBe(24);
  });

  test("percent: clamps to max when computed is above max", () => {
    // 32% of 200 = 64, max=36 → 36
    expect(resolveSidebarWidth(200, { percent: 0.32, max: 36 }, true, 12)).toBe(36);
  });

  test("percent: clamps to min and max together (patchbay range 24-36)", () => {
    // 32% of 100 = 32 — within [24, 36]
    expect(resolveSidebarWidth(100, { percent: 0.32, min: 24, max: 36 }, true, 12)).toBe(32);
  });

  // ── Overflow guard ───────────────────────────────────────────────────────

  test("overflow guard: shrinks sidebar so main has at least mainMinWidth", () => {
    // total=30, fixed=26, divider=1, mainMin=12 → maxAllowed=17, result=17
    expect(resolveSidebarWidth(30, { fixed: 26 }, true, 12)).toBe(17);
  });

  test("overflow guard: no divider — one more char available", () => {
    // total=30, fixed=26, no divider, mainMin=12 → maxAllowed=18, result=18
    expect(resolveSidebarWidth(30, { fixed: 26 }, false, 12)).toBe(18);
  });

  test("overflow guard: fires for percent when window is tiny", () => {
    // total=20, 32% of 20=6, but mainMin=12, divider=1 → maxAllowed=7, result=6 (no clamp needed)
    expect(resolveSidebarWidth(20, { percent: 0.32 }, true, 12)).toBe(6);
  });

  test("overflow guard: extreme — total barely fits mainMinWidth plus divider", () => {
    // total=13, mainMin=12, divider=1 → maxAllowed=0, result=0
    expect(resolveSidebarWidth(13, { fixed: 26 }, true, 12)).toBe(0);
  });

  test("overflow guard: zero-width edge case (total=0)", () => {
    expect(resolveSidebarWidth(0, { fixed: 26 }, true, 12)).toBe(0);
  });

  // ── WibWobWorld pattern: max(14, floor(total/6)) ──────────────────────────

  test("wibwobworld pattern: 1/6 min 14 at wide screen (120 cols)", () => {
    // floor(120/6) = 20, min=14 → 20
    expect(resolveSidebarWidth(120, { percent: 1 / 6, min: 14 }, true, 12)).toBe(20);
  });

  test("wibwobworld pattern: 1/6 min 14 at narrow screen (60 cols)", () => {
    // floor(60/6) = 10, min=14 → 14
    expect(resolveSidebarWidth(60, { percent: 1 / 6, min: 14 }, true, 12)).toBe(14);
  });
});
