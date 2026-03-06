// Type stubs for irc-framework (kiwiirc/irc-framework)
// Adapted from vendor/pirc-extension/src/irc-framework.d.ts and extended for our usage.
// irc-framework is JS-only; these stubs cover the surface we actually use.

declare module "irc-framework" {
  interface ConnectOptions {
    host: string;
    port: number;
    nick: string;
    username?: string;
    gecos?: string; // realname
    password?: string;
    auto_reconnect?: boolean;
    auto_reconnect_wait?: number;
    auto_reconnect_max_retries?: number;
    tls?: boolean;
  }

  /** Payload from the "message" event */
  interface MessageEvent {
    nick: string;
    ident: string;
    hostname: string;
    target: string; // channel or nick
    message: string;
    tags: Record<string, string>;
  }

  /** Payload from the "join" event */
  interface JoinEvent {
    nick: string;
    ident: string;
    hostname: string;
    channel: string;
  }

  /** Payload from the "error" event */
  interface ErrorEvent {
    error?: Error;
    message?: string;
  }

  export class Client {
    constructor();
    connect(options: ConnectOptions): void;
    join(channel: string): void;
    say(target: string, message: string, tags?: Record<string, string>): void;
    quit(message?: string): void;
    requestCap(cap: string | string[]): void;
    raw(...args: (string | number)[]): void;

    // typed overloads for events we use
    on(event: "registered", handler: () => void): void;
    on(event: "message", handler: (event: MessageEvent) => void): void;
    on(event: "join", handler: (event: JoinEvent) => void): void;
    on(event: "close", handler: () => void): void;
    on(event: "socket close", handler: () => void): void;
    on(event: "error", handler: (event: ErrorEvent) => void): void;
    on(event: string, handler: (...args: unknown[]) => void): void; // catch-all

    network: {
      cap: {
        available: Map<string, string>;
        enabled: string[];
        isEnabled(cap: string): boolean;
      };
    };
  }

}
