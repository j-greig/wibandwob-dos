/**
 * StepMatrix — generalised step sequencer grid (N tracks x M steps).
 * Reusable, keyboard navigable, colour-coded per track.
 * Wib register: pulsing active step column.
 * Wob register: clean grid with precise step markers.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../../ui-parts.js";
import { applyRect } from "../../../ui-parts.js";
import { theme } from "../../../theme/resolver.js";

export interface StepMatrixProps {
  steps: number;             // columns
  tracks: string[];          // track labels
  active: boolean[][];       // [track][step]
  playhead?: number;         // current step highlight
  onToggle?: (track: number, step: number) => void;
}

const TRACK_COLORS = ["●", "◆", "■", "▲", "★", "♦", "◉", "▶"];

export function createStepMatrix(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<StepMatrixProps>,
): UiPart<Partial<StepMatrixProps>> {
  let props: StepMatrixProps = {
    steps: initial?.steps ?? 16,
    tracks: initial?.tracks ?? ["BD", "SD", "HH", "OH"],
    active: initial?.active ?? [],
    playhead: initial?.playhead,
    onToggle: initial?.onToggle,
  };

  const node = blessed.box({ parent });
  let cursorTrack = 0;
  let cursorStep = 0;

  function render() {
    const t = theme();
    const labelW = Math.max(...props.tracks.map(t => t.length), 2) + 1;

    const lines: string[] = [];

    // Step header
    let header = " ".repeat(labelW);
    for (let s = 0; s < props.steps; s++) {
      const isPlayhead = s === props.playhead;
      header += isPlayhead ? "▼ " : (s % 4 === 0 ? `${(s + 1).toString().padEnd(2).slice(0, 2)}` : "· ");
    }
    lines.push(header);

    // Track rows
    for (let tr = 0; tr < props.tracks.length; tr++) {
      const label = props.tracks[tr].padEnd(labelW);
      let row = label;
      const marker = TRACK_COLORS[tr % TRACK_COLORS.length];

      for (let s = 0; s < props.steps; s++) {
        const on = props.active[tr]?.[s] ?? false;
        const isCursor = tr === cursorTrack && s === cursorStep;
        const isPlayhead = s === props.playhead;

        if (isCursor) {
          row += on ? `${marker} ` : "▓ ";
        } else if (isPlayhead && on) {
          row += `${marker} `;
        } else if (on) {
          row += `${marker} `;
        } else {
          row += "· ";
        }
      }
      lines.push(row);
    }

    node.setContent(lines.join("\n"));
    node.style.fg = t.body.fg;
    node.style.bg = t.body.bg;
  }

  node.key(["up"], () => {
    cursorTrack = Math.max(0, cursorTrack - 1);
    render();
  });
  node.key(["down"], () => {
    cursorTrack = Math.min(props.tracks.length - 1, cursorTrack + 1);
    render();
  });
  node.key(["left"], () => {
    cursorStep = Math.max(0, cursorStep - 1);
    render();
  });
  node.key(["right"], () => {
    cursorStep = Math.min(props.steps - 1, cursorStep + 1);
    render();
  });
  node.key(["space", "enter"], () => {
    if (props.onToggle) {
      props.onToggle(cursorTrack, cursorStep);
    }
  });

  render();

  return {
    node,
    layout(rect: Rect) { applyRect(node, rect); render(); },
    update(next) {
      if (next.steps !== undefined) props.steps = next.steps;
      if (next.tracks !== undefined) props.tracks = next.tracks;
      if (next.active !== undefined) props.active = next.active;
      if (next.playhead !== undefined) props.playhead = next.playhead;
      if (next.onToggle !== undefined) props.onToggle = next.onToggle;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
