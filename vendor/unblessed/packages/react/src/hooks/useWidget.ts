/**
 * useWidget.ts - Hook for accessing underlying unblessed widgets
 *
 * Provides direct access to the unblessed widget instance from React components.
 * Useful for imperative animations and direct widget manipulation that bypasses
 * React re-renders.
 */

import type { Element } from "@unblessed/core";
import { useEffect, useRef, type MutableRefObject } from "react";

/**
 * Hook to access the underlying unblessed widget instance.
 *
 * Returns a ref object that will contain the widget after the component mounts.
 * The widget reference allows direct manipulation for animations and other
 * imperative operations without triggering React re-renders.
 *
 * **IMPORTANT:** The widget is only available AFTER the first render.
 * Use the callback pattern or useEffect to wait for the widget to be available.
 *
 * **How it works:**
 * - Component must use forwardRef and pass the ref through
 * - Reconciler's getPublicInstance() returns layoutNode.widget for refs
 * - This hook wraps the ref and provides convenient callback pattern
 *
 * @template T - Widget type (defaults to Element)
 * @param callback - Optional callback invoked when widget becomes available
 * @returns Ref object containing the widget instance
 *
 * @example
 * ```tsx
 * import { useWidget, makeAnimatable, generateRainbow, rotateColors } from '@unblessed/react';
 *
 * const MyBox = forwardRef((props, ref) => {
 *   return <Box ref={ref} {...props} />;
 * });
 *
 * function AnimatedBox() {
 *   const widgetRef = useWidget<Box>();
 *
 *   useEffect(() => {
 *     const widget = widgetRef.current;
 *     if (!widget) return;
 *
 *     // Enable animations on the widget
 *     makeAnimatable(widget);
 *
 *     // Animate border colors - bypasses React re-renders!
 *     const stop = widget.animateBorderColors((length, frame) => {
 *       const colors = generateRainbow(length);
 *       return rotateColors(colors, frame);
 *     }, { fps: 30 });
 *
 *     return () => stop();
 *   }, []);
 *
 *   return <MyBox border={1}>Animated!</MyBox>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With callback pattern
 * function AnimatedBox() {
 *   const widgetRef = useWidget((widget) => {
 *     // Widget is guaranteed to be available here
 *     makeAnimatable(widget);
 *     const stop = widget.animateBorderColors(...);
 *     return () => stop();  // Return cleanup function
 *   });
 *
 *   return <MyBox ref={widgetRef} border={1}>Animated!</MyBox>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Pulse animation
 * function PulsingText() {
 *   const widgetRef = useWidget<Element>();
 *
 *   useEffect(() => {
 *     if (!widgetRef.current) return;
 *
 *     makeAnimatable(widgetRef.current);
 *     const stop = widgetRef.current.pulse('fg', ['red', 'yellow', 'red'], {
 *       duration: 1000
 *     });
 *
 *     return () => stop();
 *   }, []);
 *
 *   return <Text>Pulsing!</Text>;
 * }
 * ```
 */
export function useWidget<T extends Element = Element>(
  callback?: (widget: T) => void | (() => void),
): MutableRefObject<T | null> {
  const widgetRef = useRef<T | null>(null);

  // Call callback when widget becomes available
  useEffect(() => {
    if (widgetRef.current && callback) {
      const cleanup = callback(widgetRef.current);
      return cleanup;
    }
  }, [widgetRef.current, callback]);

  return widgetRef;
}
