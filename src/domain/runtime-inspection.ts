import type { RuntimeStatsSnapshot } from "../core/runtime-stats.js";
import type { DesktopState } from "../core/types.js";

export interface RuntimeMenuInspection {
  open: boolean;
  label?: string;
}

export interface RuntimeOverlayInspection {
  type: string;
  selectedIndex?: number;
  count?: number;
  currentDirectory?: string;
}

export interface RuntimeUiInspection {
  menu: RuntimeMenuInspection;
  overlay: RuntimeOverlayInspection | null;
}

export interface RuntimeScrambleInspection {
  status: string;
  sleeping: boolean;
  model: string;
  sessionId: string;
  messageCount: number;
  lastMessage: string | null;
  logPath: string | null;
}

export interface RuntimeHistoryEntry {
  role: string;
  content: string;
  timestamp: number;
}

export interface RuntimeInspectionSnapshot {
  state: DesktopState;
  stats: RuntimeStatsSnapshot;
  ui: RuntimeUiInspection;
  scramble: RuntimeScrambleInspection;
  history: RuntimeHistoryEntry[];
}
