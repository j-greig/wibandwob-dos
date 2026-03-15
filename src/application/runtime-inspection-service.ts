import type { DesktopState } from "../core/types.js";
import type {
  RuntimeInspectionSnapshot,
} from "../domain/runtime-inspection.js";

export interface RuntimeInspectionService {
  getState(): DesktopState;
  syncState(): DesktopState;
  getPrimerInfo(pathOrName: string): unknown;
  screenshotText(): string;
  getSnapshot(): RuntimeInspectionSnapshot;
}

export function createRuntimeInspectionService(
  deps: RuntimeInspectionService,
): RuntimeInspectionService {
  return deps;
}
