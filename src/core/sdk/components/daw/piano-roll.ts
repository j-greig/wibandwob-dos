/**
 * PianoRoll — scrollable grid of semitones x bars.
 * Filled cells = active notes. Pitch labels on left, bar numbers on top.
 * Wib register: glowing active cells with color drift.
 * Wob register: clean monochrome grid.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../../ui-parts.js";
import { applyRect } from "../../../ui-parts.js";
import { theme } from "../../../theme/resolver.js";

export interface PianoRollProps {
  notes: boolean[][];  // [semitone][bar] — true = active
  bars: number;
  zoom?: number;
  onToggle?: (semitone: number, bar: number) => void;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function createPianoRoll(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<PianoRollProps>,
): UiPart<Partial<PianoRollProps>> {
  let props: PianoRollProps = {
    notes: initial?.notes ?? Array.from({ length: 12 }, () => []),
    bars: initial?.bars ?? 16,
    zoom: initial?.zoom ?? 1,
    onToggle: initial?.onToggle,
  };

  const node = blessed.box({ parent, scrollable: true });
  let cursorSemitone = 0;
  let cursorBar = 0;

  function render() {
    const t = theme();
    const labelW = 4;
    const bars = props.bars;
    const rows = props.notes.length;

    const lines: string[] = [];

    // Header row: bar numbers
    let header = " ".repeat(labelW);
    for (let b = 0; b < bars; b++) {
      header += (b % 4 === 0) ? String(b + 1).padEnd(2).slice(0, 2) : "· ";
    }
    lines.push(header);

    // Note rows (top = highest pitch)
    for (let s = rows - 1; s >= 0; s--) {
      const octave = Math.floor(s / 12) + 3;
      const label = `${NOTE_NAMES[s % 12]}${octave}`.padStart(labelW);
      let row = label;
      for (let b = 0; b < bars; b++) {
        const active = props.notes[s]?.[b] ?? false;
        const isCursor = s === cursorSemitone && b === cursorBar;
        if (isCursor) {
          row += active ? "██" : "▓▓";
        } else {
          row += active ? "██" : (s % 12 === 0 ? "──" : "· ");
        }
      }
      lines.push(row);
    }

    node.setContent(lines.join("\n"));
    node.style.fg = t.body.fg;
    node.style.bg = t.body.bg;
  }

  node.key(["up"], () => {
    cursorSemitone = Math.min(props.notes.length - 1, cursorSemitone + 1);
    render();
  });
  node.key(["down"], () => {
    cursorSemitone = Math.max(0, cursorSemitone - 1);
    render();
  });
  node.key(["left"], () => {
    cursorBar = Math.max(0, cursorBar - 1);
    render();
  });
  node.key(["right"], () => {
    cursorBar = Math.min(props.bars - 1, cursorBar + 1);
    render();
  });
  node.key(["space", "enter"], () => {
    if (props.onToggle) {
      props.onToggle(cursorSemitone, cursorBar);
    }
  });

  render();

  return {
    node,
    layout(rect: Rect) { applyRect(node, rect); render(); },
    update(next) {
      if (next.notes !== undefined) props.notes = next.notes;
      if (next.bars !== undefined) props.bars = next.bars;
      if (next.zoom !== undefined) props.zoom = next.zoom;
      if (next.onToggle !== undefined) props.onToggle = next.onToggle;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
