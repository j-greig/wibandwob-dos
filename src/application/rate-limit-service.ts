export type RateLimitScope = "ingress" | "command";

export interface RateLimitBucketConfig {
  burst: number;
  refillPerSec: number;
  maxConcurrent: number;
}

export interface RateLimitConfig {
  enabled: boolean;
  enforce: boolean;
  ingress: RateLimitBucketConfig;
  command: RateLimitBucketConfig;
  costs: {
    ingress: Record<string, number>;
    command: Record<string, number>;
    defaultIngress: number;
    defaultCommand: number;
  };
}

interface BucketState {
  tokens: number;
  lastRefillMs: number;
  inFlight: number;
}

export interface RateLimitSnapshot {
  enabled: boolean;
  enforce: boolean;
  accepted: number;
  denied: number;
  wouldLimit: number;
  activeLeases: number;
  buckets: number;
}

export interface RateLimitLease {
  release: () => void;
}

export interface RateLimitDecision {
  allowed: boolean;
  enforced: boolean;
  retryAfterMs: number;
  lease?: RateLimitLease;
}

const YES = new Set(["1", "true", "yes", "on"]);

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return YES.has(raw.trim().toLowerCase());
}

function envNum(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function resolveRateLimitConfig(): RateLimitConfig {
  return {
    enabled: envBool("WIBWOB_RL_ENABLED", true),
    enforce: envBool("WIBWOB_RL_ENFORCE", true),
    ingress: {
      burst: envNum("WIBWOB_RL_INGRESS_BURST", 60),
      refillPerSec: envNum("WIBWOB_RL_INGRESS_REFILL_PER_SEC", 30),
      maxConcurrent: envNum("WIBWOB_RL_INGRESS_MAX_CONCURRENT", 20),
    },
    command: {
      burst: envNum("WIBWOB_RL_COMMAND_BURST", 40),
      refillPerSec: envNum("WIBWOB_RL_COMMAND_REFILL_PER_SEC", 20),
      maxConcurrent: envNum("WIBWOB_RL_COMMAND_MAX_CONCURRENT", 8),
    },
    costs: {
      defaultIngress: envNum("WIBWOB_RL_DEFAULT_INGRESS_COST", 1),
      defaultCommand: envNum("WIBWOB_RL_DEFAULT_COMMAND_COST", 1),
      ingress: {
        "GET:/health": 0,
        "GET:/docs": 0,
        "GET:/openapi.json": 0,
        "GET:/state": 2,
        "GET:/runtime/inspection": 2,
        "GET:/screenshot/text": 3,
        "GET:/screenshot/ansi": 4,
        "POST:/commands/run": 2,
      },
      command: {
        "source:api": 2,
        "source:agent": 1,
        "source:internal": 1,
      },
    },
  };
}

export class RateLimitService {
  private readonly states = new Map<string, BucketState>();
  private accepted = 0;
  private denied = 0;
  private wouldLimit = 0;

  constructor(private readonly config: RateLimitConfig) {}

  snapshot(): RateLimitSnapshot {
    let activeLeases = 0;
    for (const state of this.states.values()) activeLeases += state.inFlight;
    return {
      enabled: this.config.enabled,
      enforce: this.config.enforce,
      accepted: this.accepted,
      denied: this.denied,
      wouldLimit: this.wouldLimit,
      activeLeases,
      buckets: this.states.size,
    };
  }

  ingress(method: string, pathname: string): RateLimitDecision {
    const key = `${method.toUpperCase()}:${pathname}`;
    const cost = this.config.costs.ingress[key] ?? this.config.costs.defaultIngress;
    return this.acquire("ingress", key, cost);
  }

  command(source: string): RateLimitDecision {
    const sourceKey = `source:${source}`;
    const cost = this.config.costs.command[sourceKey] ?? this.config.costs.defaultCommand;
    return this.acquire("command", sourceKey, cost);
  }

  private acquire(scope: RateLimitScope, key: string, cost: number): RateLimitDecision {
    if (!this.config.enabled) {
      return { allowed: true, enforced: false, retryAfterMs: 0 };
    }

    const cfg = this.config[scope];
    const now = Date.now();
    const stateKey = `${scope}:${key}`;
    const state = this.states.get(stateKey) ?? {
      tokens: cfg.burst,
      lastRefillMs: now,
      inFlight: 0,
    };

    const elapsedSec = Math.max(0, now - state.lastRefillMs) / 1000;
    state.tokens = Math.min(cfg.burst, state.tokens + elapsedSec * cfg.refillPerSec);
    state.lastRefillMs = now;

    const noConcurrency = state.inFlight >= cfg.maxConcurrent;
    const noTokens = state.tokens < cost;
    if (noConcurrency || noTokens) {
      const missing = Math.max(0, cost - state.tokens);
      const retryAfterMs = noConcurrency
        ? 100
        : Math.ceil((missing / Math.max(cfg.refillPerSec, 0.001)) * 1000);

      this.states.set(stateKey, state);
      if (this.config.enforce) this.denied += 1;
      else this.wouldLimit += 1;

      return {
        allowed: !this.config.enforce,
        enforced: this.config.enforce,
        retryAfterMs: Math.max(1, retryAfterMs),
      };
    }

    state.tokens -= cost;
    state.inFlight += 1;
    this.states.set(stateKey, state);
    this.accepted += 1;

    return {
      allowed: true,
      enforced: false,
      retryAfterMs: 0,
      lease: {
        release: () => {
          const next = this.states.get(stateKey);
          if (!next) return;
          next.inFlight = Math.max(0, next.inFlight - 1);
          this.states.set(stateKey, next);
        },
      },
    };
  }
}
