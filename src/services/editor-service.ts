import type { EditorState } from "../core/types.js";

export function insertText(editor: EditorState, text: string): void {
  const { value, cursor } = editor;
  editor.value = `${value.slice(0, cursor)}${text}${value.slice(cursor)}`;
  editor.cursor += text.length;
}

export function deleteBackward(editor: EditorState): void {
  if (editor.cursor === 0) {
    return;
  }
  const { value, cursor } = editor;
  editor.value = `${value.slice(0, cursor - 1)}${value.slice(cursor)}`;
  editor.cursor -= 1;
}

export function deleteForward(editor: EditorState): void {
  if (editor.cursor >= editor.value.length) {
    return;
  }
  const { value, cursor } = editor;
  editor.value = `${value.slice(0, cursor)}${value.slice(cursor + 1)}`;
}

export function moveCursor(editor: EditorState, delta: number): void {
  editor.cursor = Math.max(0, Math.min(editor.value.length, editor.cursor + delta));
}

export function render(editor: EditorState): void {
  // Guard: blessed's word-wrap infinite-loops if scrollable widget has width ≤ 0
  if (Number(editor.widget.width) <= 0) return;
  const before = escapeTags(editor.value.slice(0, editor.cursor));
  const atCursor = editor.value[editor.cursor] ?? " ";
  const after = escapeTags(editor.value.slice(editor.cursor + 1));
  editor.widget.setContent(`${before}{inverse}${escapeTags(atCursor)}{/inverse}${after}`);
  editor.widget.setScrollPerc(100);
}

function escapeTags(value: string): string {
  return value.replace(/[{}]/g, "\\$&");
}
