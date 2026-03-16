/**
 * blessed-augment.d.ts — Type augmentations for blessed properties/methods
 * that exist at runtime but are missing from @types/blessed.
 *
 * Eliminates `as any` casts for known blessed widget internals.
 */
import "blessed";

declare module "blessed" {
  namespace Widgets {
    interface ListElement {
      /** Index of the currently selected item (0-based). Runtime property, missing from @types/blessed. */
      selected: number;
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
