import type {
  CommandListItem,
  CommandRunResult,
  CommandSurface,
} from "../core/command-registry.js";
import type { RateLimitService } from "./rate-limit-service.js";

export type RuntimeCommandSource = "api" | "agent" | "internal";

export interface RuntimeCommandOptions {
  source?: RuntimeCommandSource;
  interactive?: boolean;
}

export interface RuntimeCommandService {
  list(
    surface?: CommandSurface,
    opts?: { includeUnavailable?: boolean },
  ): CommandListItem[];
  run(
    id: string,
    args?: Record<string, unknown>,
    options?: RuntimeCommandOptions,
  ): CommandRunResult;
}

export function createRuntimeCommandService(deps: {
  listCommands: RuntimeCommandService["list"];
  runCommand: (id: string, args?: Record<string, unknown>) => CommandRunResult;
  rateLimiter?: RateLimitService;
}): RuntimeCommandService {
  const prepareArgs = (
    args?: Record<string, unknown>,
    options?: RuntimeCommandOptions,
  ): Record<string, unknown> | undefined => {
    if (!args && !options) {
      return undefined;
    }

    const prepared = { ...(args ?? {}) } as Record<string, unknown>;
    if (options?.source) {
      prepared._controlSurface = options.source;
    }
    if (options?.interactive === false) {
      prepared._interactive = false;
    }
    return prepared;
  };

  return {
    list: (surface, opts) => deps.listCommands(surface, opts),
    run: (id, args, options) => {
      const source = options?.source ?? "internal";
      const decision = deps.rateLimiter?.command(source);
      if (decision && !decision.allowed) {
        return {
          ok: false,
          error: "rate_limited",
          retryAfterMs: decision.retryAfterMs,
          source,
        };
      }

      try {
        return deps.runCommand(id, prepareArgs(args, options));
      } finally {
        decision?.lease?.release();
      }
    },
  };
}
