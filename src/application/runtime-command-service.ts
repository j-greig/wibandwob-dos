import type {
  CommandListItem,
  CommandRunResult,
  CommandSurface,
} from "../core/command-registry.js";

export interface RuntimeCommandService {
  list(
    surface?: CommandSurface,
    opts?: { includeUnavailable?: boolean },
  ): CommandListItem[];
  run(id: string, args?: Record<string, unknown>): CommandRunResult;
}

export function createRuntimeCommandService(deps: {
  listCommands: RuntimeCommandService["list"];
  runCommand: RuntimeCommandService["run"];
}): RuntimeCommandService {
  return {
    list: (surface, opts) => deps.listCommands(surface, opts),
    run: (id, args) => deps.runCommand(id, args),
  };
}
