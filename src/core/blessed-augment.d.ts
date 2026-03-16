/**
 * blessed-augment.d.ts — Type augmentations for blessed properties/methods
 * that exist at runtime but are missing from @types/blessed.
 *
 * Eliminates `as any` casts for known blessed widget internals.
 */
import "blessed";

declare module "blessed" {
  namespace Widgets {
    interface BlessedElement {
      /** Absolute top position (computed). Runtime property, missing from @types/blessed. */
      atop?: number;
      /** Absolute left position (computed). Runtime property, missing from @types/blessed. */
      aleft?: number;
      /** Internal width (content area minus borders/padding). */
      iwidth?: number;
      /** Whether tags are parsed for this element. */
      parseTags?: boolean;
      /** Layout position cache. Runtime-only. */
      lpos?: { xi?: number; yi?: number };
      /** Scrollbar configuration (present when scrollbar option was set). */
      scrollbar?: { style?: any; track?: any; ch?: string };
    }

    interface ListElement {
      /** Index of the currently selected item (0-based). Runtime property, missing from @types/blessed. */
      selected: number;
      /** Replace all list items. */
      setItems(items: string[]): void;
    }

    interface ScrollableBoxElement {
      /** Current scroll offset (line index of top visible line). */
      childBase: number;
      /** Scroll by delta lines (positive = down). */
      scroll(delta: number): void;
      /** Scroll to an absolute line index. */
      scrollTo(index: number): void;
      /** Get the current scroll position. */
      getScroll(): number;
    }

    interface TextareaElement {
      /** Get the current text value. Runtime property, missing from @types/blessed. */
      value: string;
      /** Set the textarea text content. */
      setValue(text: string): void;
      /** Clear the textarea content. */
      clearValue(): void;
    }

    interface TextboxElement {
      /** Get the current text value. Runtime property, missing from @types/blessed. */
      value: string;
      /** Set the textbox text content. */
      setValue(text: string): void;
      /** Clear the textbox content. */
      clearValue(): void;
    }

    interface Screen {
      /** Capture a text screenshot of the terminal. */
      screenshot(): string;
      /** Whether keys are being grabbed by a focused element. */
      grabKeys: boolean;
    }
  }
}
