import type { RuntimeStatsSnapshot } from "../core/runtime-stats.js";
import type { DesktopState } from "../core/types.js";

export interface RuntimeInspectionService {
  getState(): DesktopState;
  syncState(): DesktopState;
  getPrimerInfo(pathOrName: string): unknown;
  screenshotText(): string;
  getScrambleState(): {
    status: string;
    sleeping: boolean;
    model: string;
    sessionId: string;
    messageCount: number;
    lastMessage: string | null;
    logPath: string | null;
  };
  getRuntimeStats(): RuntimeStatsSnapshot;
  getScrambleHistory(): Array<{ role: string; content: string; timestamp: number }>;
}

export function createRuntimeInspectionService(
  deps: RuntimeInspectionService,
): RuntimeInspectionService {
  return deps;
}
