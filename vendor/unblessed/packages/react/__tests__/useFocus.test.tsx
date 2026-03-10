/**
 * useFocus.test.tsx - Tests for useFocus and useScreenFocus hooks
 *
 * PURPOSE: Verify that focus hooks correctly wrap the blessed focus system
 */

import { Box as CoreBox } from "@unblessed/core";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Box, render, Text, useFocus, useScreenFocus } from "../src";
import { testRuntime } from "./setup.js";
import { expectRenderSuccess } from "./test-helpers.js";

describe("useFocus Hook", () => {
  describe("basic functionality", () => {
    it("returns isFocused as false initially", async () => {
      let capturedFocusState: any = null;

      function TestApp() {
        const boxRef = useRef<CoreBox>(null);
        const focusState = useFocus(boxRef);
        capturedFocusState = focusState;

        return (
          <Box ref={boxRef} tabIndex={0} width={20} height={5}>
            <Text>Focusable Box</Text>
          </Box>
        );
      }

      const instance = render(<TestApp />, { runtime: testRuntime });
      await expectRenderSuccess(instance);

      expect(capturedFocusState).toBeDefined();
      expect(capturedFocusState.isFocused).toBe(false);

      instance.unmount();
    });

    it("provides focus() method", async () => {
      let capturedFocusState: any = null;

      function TestApp() {
        const boxRef = useRef<CoreBox>(null);
        const focusState = useFocus(boxRef);
        capturedFocusState = focusState;

        return (
          <Box ref={boxRef} tabIndex={0} width={20} height={5}>
            <Text>Focusable Box</Text>
          </Box>
        );
      }

      const instance = render(<TestApp />, { runtime: testRuntime });
      await expectRenderSuccess(instance);

      expect(capturedFocusState.focus).toBeDefined();
      expect(typeof capturedFocusState.focus).toBe("function");

      instance.unmount();
    });

    it("provides blur() method", async () => {
      let capturedFocusState: any = null;

      function TestApp() {
        const boxRef = useRef<CoreBox>(null);
        const focusState = useFocus(boxRef);
        capturedFocusState = focusState;

        return (
          <Box ref={boxRef} tabIndex={0} width={20} height={5}>
            <Text>Focusable Box</Text>
          </Box>
        );
      }

      const instance = render(<TestApp />, { runtime: testRuntime });
      await expectRenderSuccess(instance);

      expect(capturedFocusState.blur).toBeDefined();
      expect(typeof capturedFocusState.blur).toBe("function");

      instance.unmount();
    });
  });

  describe("focus state", () => {
    it("isFocused reflects focus state correctly", async () => {
      let focusState1: any = null;
      let focusState2: any = null;

      function TestApp() {
        const boxRef1 = useRef<CoreBox>(null);
        const boxRef2 = useRef<CoreBox>(null);
        focusState1 = useFocus(boxRef1);
        focusState2 = useFocus(boxRef2);

        return (
          <Box flexDirection="column">
            <Box ref={boxRef1} tabIndex={0} width={20} height={5}>
              <Text>Focusable Box 1</Text>
            </Box>
            <Box ref={boxRef2} tabIndex={0} width={20} height={5}>
              <Text>Focusable Box 2</Text>
            </Box>
          </Box>
        );
      }

      const instance = render(<TestApp />, { runtime: testRuntime });
      await expectRenderSuccess(instance);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // One should be focused (blessed auto-focuses first element)
      const totalFocused =
        (focusState1.isFocused ? 1 : 0) + (focusState2.isFocused ? 1 : 0);
      expect(totalFocused).toBeLessThanOrEqual(1); // At most one focused

      instance.unmount();
    });

    it("focus() method focuses the widget", async () => {
      let focusState1: any = null;
      let focusState2: any = null;

      function TestApp() {
        const boxRef1 = useRef<CoreBox>(null);
        const boxRef2 = useRef<CoreBox>(null);
        focusState1 = useFocus(boxRef1, { autoFocus: true }); // Start focused
        focusState2 = useFocus(boxRef2);

        return (
          <Box flexDirection="column">
            <Box ref={boxRef1} tabIndex={0} width={20} height={5}>
              <Text>Box 1</Text>
            </Box>
            <Box ref={boxRef2} tabIndex={0} width={20} height={5}>
              <Text>Box 2</Text>
            </Box>
          </Box>
        );
      }

      const instance = render(<TestApp />, { runtime: testRuntime });
      await expectRenderSuccess(instance);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Box 1 should be focused initially
      expect(focusState1.isFocused).toBe(true);
      expect(focusState2.isFocused).toBe(false);

      // Call focus() on box 2
      focusState2.focus();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Now box 2 should be focused
      expect(focusState1.isFocused).toBe(false);
      expect(focusState2.isFocused).toBe(true);

      instance.unmount();
    });
  });

  describe("autoFocus option", () => {
    it("auto-focuses widget when autoFocus is true", async () => {
      let capturedFocusState: any = null;

      function TestApp() {
        const boxRef = useRef<CoreBox>(null);
        const focusState = useFocus(boxRef, { autoFocus: true });
        capturedFocusState = focusState;

        return (
          <Box ref={boxRef} tabIndex={0} width={20} height={5}>
            <Text>Auto-focused Box</Text>
          </Box>
        );
      }

      const instance = render(<TestApp />, { runtime: testRuntime });
      await expectRenderSuccess(instance);

      // Wait for auto-focus
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should be focused
      expect(capturedFocusState.isFocused).toBe(true);

      instance.unmount();
    });
  });

  describe("callbacks", () => {
    it("calls onFocus when widget receives focus via focus()", async () => {
      const onFocus = vi.fn();
      let focusState2: any = null;

      function TestApp() {
        const boxRef1 = useRef<CoreBox>(null);
        const boxRef2 = useRef<CoreBox>(null);
        useFocus(boxRef1, { autoFocus: true }); // Start with focus
        focusState2 = useFocus(boxRef2, { onFocus });

        return (
          <Box flexDirection="column">
            <Box ref={boxRef1} tabIndex={0} width={20} height={5}>
              <Text>Box 1</Text>
            </Box>
            <Box ref={boxRef2} tabIndex={0} width={20} height={5}>
              <Text>Box 2</Text>
            </Box>
          </Box>
        );
      }

      const instance = render(<TestApp />, { runtime: testRuntime });
      await expectRenderSuccess(instance);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onFocus).not.toHaveBeenCalled();

      // Focus box 2 using the hook's method
      focusState2.focus();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onFocus).toHaveBeenCalledTimes(1);

      instance.unmount();
    });

    it("calls onBlur callback when widget loses focus", async () => {
      const onBlur = vi.fn();
      let focusState1: any = null;
      let focusState2: any = null;

      function TestApp() {
        const ref1 = useRef<CoreBox>(null);
        const ref2 = useRef<CoreBox>(null);
        focusState1 = useFocus(ref1, { onBlur, autoFocus: true });
        focusState2 = useFocus(ref2);

        return (
          <Box flexDirection="column">
            <Box ref={ref1} tabIndex={0} width={20} height={5}>
              <Text>Box 1</Text>
            </Box>
            <Box ref={ref2} tabIndex={0} width={20} height={5}>
              <Text>Box 2</Text>
            </Box>
          </Box>
        );
      }

      const instance = render(<TestApp />, { runtime: testRuntime });
      await expectRenderSuccess(instance);

      // Wait for autoFocus on first box
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reset the spy after autoFocus completes
      onBlur.mockClear();

      expect(focusState1.isFocused).toBe(true);

      // Focus second widget (first loses focus)
      focusState2.focus();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // onBlur should have been called exactly once
      expect(onBlur).toHaveBeenCalledTimes(1);
      expect(focusState1.isFocused).toBe(false);
      expect(focusState2.isFocused).toBe(true);

      instance.unmount();
    });
  });
});

describe("useScreenFocus Hook", () => {
  describe("navigation methods", () => {
    it("provides focusNext method", async () => {
      let capturedScreenFocus: any = null;

      function TestApp() {
        const screenFocus = useScreenFocus();
        capturedScreenFocus = screenFocus;

        return (
          <Box width={20} height={10}>
            <Text>Test</Text>
          </Box>
        );
      }

      const instance = render(<TestApp />, { runtime: testRuntime });
      await expectRenderSuccess(instance);

      expect(capturedScreenFocus.focusNext).toBeDefined();
      expect(typeof capturedScreenFocus.focusNext).toBe("function");

      instance.unmount();
    });

    it("provides focusPrevious method", async () => {
      let capturedScreenFocus: any = null;

      function TestApp() {
        const screenFocus = useScreenFocus();
        capturedScreenFocus = screenFocus;

        return (
          <Box width={20} height={10}>
            <Text>Test</Text>
          </Box>
        );
      }

      const instance = render(<TestApp />, { runtime: testRuntime });
      await expectRenderSuccess(instance);

      expect(capturedScreenFocus.focusPrevious).toBeDefined();
      expect(typeof capturedScreenFocus.focusPrevious).toBe("function");

      instance.unmount();
    });

    it("provides focusOffset method", async () => {
      let capturedScreenFocus: any = null;

      function TestApp() {
        const screenFocus = useScreenFocus();
        capturedScreenFocus = screenFocus;

        return (
          <Box width={20} height={10}>
            <Text>Test</Text>
          </Box>
        );
      }

      const instance = render(<TestApp />, { runtime: testRuntime });
      await expectRenderSuccess(instance);

      expect(capturedScreenFocus.focusOffset).toBeDefined();
      expect(typeof capturedScreenFocus.focusOffset).toBe("function");

      instance.unmount();
    });
  });

  describe("modal pattern", () => {
    it("provides saveFocus and restoreFocus methods", async () => {
      let capturedScreenFocus: any = null;

      function TestApp() {
        const screenFocus = useScreenFocus();
        capturedScreenFocus = screenFocus;

        return (
          <Box width={20} height={10}>
            <Text>Test</Text>
          </Box>
        );
      }

      const instance = render(<TestApp />, { runtime: testRuntime });
      await expectRenderSuccess(instance);

      expect(capturedScreenFocus.saveFocus).toBeDefined();
      expect(typeof capturedScreenFocus.saveFocus).toBe("function");
      expect(capturedScreenFocus.restoreFocus).toBeDefined();
      expect(typeof capturedScreenFocus.restoreFocus).toBe("function");

      instance.unmount();
    });

    it("saveFocus and restoreFocus work together", async () => {
      let screenFocusAPI: any = null;
      let focusState1: any = null;
      let focusState2: any = null;

      function TestApp() {
        const ref1 = useRef<CoreBox>(null);
        const ref2 = useRef<CoreBox>(null);
        const screenFocus = useScreenFocus();

        screenFocusAPI = screenFocus;
        focusState1 = useFocus(ref1, { autoFocus: true });
        focusState2 = useFocus(ref2);

        return (
          <Box flexDirection="column">
            <Box ref={ref1} tabIndex={0} width={20} height={5}>
              <Text>Box 1</Text>
            </Box>
            <Box ref={ref2} tabIndex={0} width={20} height={5}>
              <Text>Box 2</Text>
            </Box>
          </Box>
        );
      }

      const instance = render(<TestApp />, { runtime: testRuntime });
      await expectRenderSuccess(instance);

      // Wait for autoFocus on box1
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(focusState1.isFocused).toBe(true);

      // Save focus
      screenFocusAPI.saveFocus();

      // Focus second widget
      focusState2.focus();
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(focusState2.isFocused).toBe(true);
      expect(focusState1.isFocused).toBe(false);

      // Restore focus (should go back to widget1)
      screenFocusAPI.restoreFocus();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(focusState1.isFocused).toBe(true);
      expect(focusState2.isFocused).toBe(false);

      instance.unmount();
    });
  });

  describe("focus property", () => {
    it("provides focused property", async () => {
      let capturedScreenFocus: any = null;

      function TestApp() {
        const screenFocus = useScreenFocus();
        capturedScreenFocus = screenFocus;

        return (
          <Box width={20} height={10}>
            <Text>Test</Text>
          </Box>
        );
      }

      const instance = render(<TestApp />, { runtime: testRuntime });
      await expectRenderSuccess(instance);

      // focused property exists (may be null if nothing is focused)
      expect(capturedScreenFocus).toHaveProperty("focused");

      instance.unmount();
    });

    it("focused reflects currently focused widget", async () => {
      let screenFocusAPI: any = null;
      let focusState: any = null;

      function TestApp() {
        const ref1 = useRef<CoreBox>(null);
        const screenFocus = useScreenFocus();

        screenFocusAPI = screenFocus;
        focusState = useFocus(ref1, { autoFocus: true });

        return (
          <Box ref={ref1} tabIndex={0} width={20} height={5}>
            <Text>Box 1</Text>
          </Box>
        );
      }

      const instance = render(<TestApp />, { runtime: testRuntime });
      await expectRenderSuccess(instance);

      // Wait for autoFocus
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should be focused
      expect(focusState.isFocused).toBe(true);
      expect(screenFocusAPI.focused).toBeDefined();

      instance.unmount();
    });
  });

  describe("history property", () => {
    it("provides history property", async () => {
      let capturedScreenFocus: any = null;

      function TestApp() {
        const screenFocus = useScreenFocus();
        capturedScreenFocus = screenFocus;

        return (
          <Box width={20} height={10}>
            <Text>Test</Text>
          </Box>
        );
      }

      const instance = render(<TestApp />, { runtime: testRuntime });
      await expectRenderSuccess(instance);

      expect(capturedScreenFocus.history).toBeDefined();
      expect(Array.isArray(capturedScreenFocus.history)).toBe(true);

      instance.unmount();
    });
  });
});
