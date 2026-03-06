declare module "irc-framework" {
  export class Client {
    connect(options: { host: string; port: number; nick: string }): void;
    join(channel: string): void;
    say(target: string, message: string, tags?: Record<string, string>): void;
    quit(message?: string): void;
    on(event: string, handler: (...args: unknown[]) => void): void;
    /** Request additional CAP capabilities before registration. */
    requestCap(cap: string | string[]): void;
    /** Send a raw IRC line (string args are joined with spaces). */
    raw(...args: (string | number)[]): void;
    /** Network info including negotiated capabilities. */
    network: {
      cap: {
        available: Map<string, string>;
        enabled: string[];
        isEnabled(cap: string): boolean;
      };
    };
  }
}
