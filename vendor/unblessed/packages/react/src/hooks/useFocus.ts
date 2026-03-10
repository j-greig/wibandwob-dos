/**
 * useFocus.ts - Focus management hooks for @unblessed/react
 *
 * Provides React hooks that wrap the blessed focus management system.
 * These hooks leverage the battle-tested focus system from @unblessed/core
 * (originally from blessed) rather than reimplementing it.
 */

import type { Element } from "@unblessed/core";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useScreen } from "./ScreenContext.js";

/**
 * Options for useFocus hook
 */
export interface UseFocusOptions {
  /**
   * Auto-focus this element on mount
   */
  autoFocus?: boolean;

  /**
   * Callback when element receives focus
   */
  onFocus?: () => void;

  /**
   * Callback when element loses focus
   */
  onBlur?: () => void;
}

/**
 * Result from useFocus hook
 */
export interface UseFocusResult {
  /**
   * Whether this element currently has focus
   */
  isFocused: boolean;

  /**
   * Focus this element (calls element.focus())
   */
  focus: () => void;

  /**
   * Blur this element (focuses previous element in history)
   */
  blur: () => void;
}

/**
 * Hook for managing focus on a widget.
 *
 * Wraps the blessed focus system (element.focus(), element.focused, focus/blur events)
 * to provide reactive focus state in React components.
 *
 * **How blessed focus works:**
 * - Screen maintains focus history stack (last 10 focused elements)
 * - Tab/Shift+Tab automatically cycle through elements with tabIndex >= 0
 * - Elements with tabIndex undefined are not focusable
 * - Elements with tabIndex -1 are programmatically focusable only
 * - Focus/blur events emitted automatically on focus changes
 *
 * **Usage Requirements:**
 * - Pass a ref object that will contain the widget instance
 * - Widget must have tabIndex set (0 for Tab navigation, -1 for programmatic only)
 *
 * @param widgetRef - Ref object containing the widget instance
 * @param options - Focus options (autoFocus, onFocus, onBlur)
 * @returns Focus state and control methods
 *
 * @example
 * ```tsx
 * import { useFocus, Box } from '@unblessed/react';
 * import { useRef } from 'react';
 *
 * function MyInput() {
 *   const inputRef = useRef(null);
 *   const { isFocused, focus } = useFocus(inputRef, { autoFocus: true });
 *
 *   return (
 *     <Box
 *       ref={inputRef}
 *       tabIndex={0}
 *       borderColor={isFocused ? 'cyan' : 'gray'}
 *       borderStyle={isFocused ? 'double' : 'single'}
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With callbacks
 * function SearchBox() {
 *   const searchRef = useRef(null);
 *   const { isFocused } = useFocus(searchRef, {
 *     onFocus: () => console.log('Search focused'),
 *     onBlur: () => console.log('Search blurred'),
 *   });
 *
 *   return <Input ref={searchRef} placeholder="Search..." />;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Programmatic focus
 * function LoginForm() {
 *   const usernameRef = useRef(null);
 *   const passwordRef = useRef(null);
 *   const username = useFocus(usernameRef, { autoFocus: true });
 *   const password = useFocus(passwordRef);
 *
 *   const handleUsernameSubmit = () => {
 *     // Focus password field after username entered
 *     password.focus();
 *   };
 *
 *   return (
 *     <Box flexDirection="column" gap={1}>
 *       <Input ref={usernameRef} onSubmit={handleUsernameSubmit} />
 *       <Input ref={passwordRef} type="password" />
 *     </Box>
 *   );
 * }
 * ```
 */
export function useFocus<T extends Element = Element>(
  widgetRef: RefObject<T>,
  options: UseFocusOptions = {},
): UseFocusResult {
  const screen = useScreen();
  const [isFocused, setIsFocused] = useState(false);

  // Use refs for callbacks to avoid re-registering event handlers
  const onFocusRef = useRef(options.onFocus);
  const onBlurRef = useRef(options.onBlur);

  // Update refs when callbacks change
  useEffect(() => {
    onFocusRef.current = options.onFocus;
    onBlurRef.current = options.onBlur;
  }, [options.onFocus, options.onBlur]);

  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;

    // Listen to blessed focus/blur events
    const handleFocus = () => {
      setIsFocused(true);
      onFocusRef.current?.();
    };

    const handleBlur = () => {
      setIsFocused(false);
      onBlurRef.current?.();
    };

    widget.on("focus", handleFocus);
    widget.on("blur", handleBlur);

    // Sync initial state
    setIsFocused(widget.focused);

    // Auto-focus if requested
    if (options.autoFocus) {
      widget.focus();
    }

    return () => {
      widget.removeListener("focus", handleFocus);
      widget.removeListener("blur", handleBlur);
    };
  }, [widgetRef.current, options.autoFocus]);

  // Imperative API - calls blessed methods
  const focus = useCallback(() => {
    widgetRef.current?.focus();
  }, [widgetRef]);

  const blur = useCallback(() => {
    // Blur by focusing previous element in history
    if (widgetRef.current && screen.focused === widgetRef.current) {
      screen.rewindFocus();
    }
  }, [widgetRef, screen]);

  return { isFocused, focus, blur };
}

/**
 * Result from useScreenFocus hook
 */
export interface UseScreenFocusResult {
  /**
   * Focus the next focusable element (Tab)
   */
  focusNext: () => void;

  /**
   * Focus the previous focusable element (Shift+Tab)
   */
  focusPrevious: () => void;

  /**
   * Move focus by N elements (positive = forward, negative = backward)
   */
  focusOffset: (offset: number) => void;

  /**
   * Save current focus to restore later (for modals)
   */
  saveFocus: () => void;

  /**
   * Restore previously saved focus
   */
  restoreFocus: () => void;

  /**
   * Get/set the currently focused element
   */
  focused: Element | null;

  /**
   * Focus history stack (last 10 focused elements)
   */
  history: Element[];
}

/**
 * Hook for screen-level focus navigation.
 *
 * Provides convenient access to blessed's screen focus management methods.
 * Use this for custom focus navigation, modal patterns (save/restore),
 * and programmatic focus control.
 *
 * **blessed focus system:**
 * - Screen.focusNext() / focusPrevious() - Tab navigation
 * - Screen.focusOffset(n) - Move focus by N elements
 * - Screen.saveFocus() / restoreFocus() - Modal pattern
 * - Screen.focused - Get/set currently focused element
 * - Screen.history - Focus history stack (max 10)
 *
 * @returns Screen focus navigation methods
 *
 * @example
 * ```tsx
 * // Custom Tab navigation
 * function MyForm() {
 *   const { focusNext, focusPrevious } = useScreenFocus();
 *
 *   return (
 *     <Box onKeyPress={(ch, key) => {
 *       if (key.name === 'tab') {
 *         key.shift ? focusPrevious() : focusNext();
 *       }
 *     }}>
 *       {/* Form fields *\/}
 *     </Box>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Modal pattern (save/restore focus)
 * function Dialog({ onClose }) {
 *   const { saveFocus, restoreFocus } = useScreenFocus();
 *
 *   useEffect(() => {
 *     saveFocus();  // Save focus before modal opens
 *     return () => restoreFocus();  // Restore on close
 *   }, []);
 *
 *   return (
 *     <Box>
 *       <Button onClick={onClose}>Close</Button>
 *     </Box>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Get currently focused element
 * function DebugInfo() {
 *   const { focused } = useScreenFocus();
 *
 *   return (
 *     <Text>
 *       Focused: {focused?.type || 'none'}
 *     </Text>
 *   );
 * }
 * ```
 */
export function useScreenFocus(): UseScreenFocusResult {
  const screen = useScreen();

  return {
    focusNext: useCallback(() => screen.focusNext(), [screen]),
    focusPrevious: useCallback(() => screen.focusPrevious(), [screen]),
    focusOffset: useCallback(
      (offset: number) => screen.focusOffset(offset),
      [screen],
    ),
    saveFocus: useCallback(() => screen.saveFocus(), [screen]),
    restoreFocus: useCallback(() => screen.restoreFocus(), [screen]),
    get focused() {
      return screen.focused;
    },
    get history() {
      return screen.history;
    },
  };
}
