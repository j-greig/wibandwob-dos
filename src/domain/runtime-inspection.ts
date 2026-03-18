import type { RuntimeStatsSnapshot } from "../core/runtime-stats.js";
import type { DesktopState } from "../core/types.js";

export interface RuntimeMenuInspection {
  open: boolean;
  label?: string;
}

export interface RuntimeOverlayInspection {
  type: string;
  label?: string;
  selectedIndex?: number;
  count?: number;
  currentDirectory?: string;
}

export interface RuntimeUiBlockerInspection {
  kind: "menu" | "overlay" | "picker-window";
  type: string;
  label?: string;
  windowId?: number;
  selectedIndex?: number;
  count?: number;
  currentDirectory?: string;
  escapeCommands: string[];
  continueCommands?: string[];
}

export interface RuntimeUiInspection {
  menu: RuntimeMenuInspection;
  overlay: RuntimeOverlayInspection | null;
  blocked: boolean;
  blockers: RuntimeUiBlockerInspection[];
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

export interface RuntimeRateLimitInspection {
  enabled: boolean;
  enforce: boolean;
  accepted: number;
  denied: number;
  wouldLimit: number;
  activeLeases: number;
  buckets: number;
}

export interface RuntimeInspectionSnapshot {
  state: DesktopState;
  stats: RuntimeStatsSnapshot;
  ui: RuntimeUiInspection;
  scramble: RuntimeScrambleInspection;
  history: RuntimeHistoryEntry[];
  rateLimit?: RuntimeRateLimitInspection;
}
