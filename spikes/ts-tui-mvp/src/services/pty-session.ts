import { spawn as spawnPty, type IExitEvent as BunPtyExitEvent, type IPty as BunPtyTerminal } from "@skitee3000/bun-pty/dist/index.js";

export interface PtySessionOptions {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  cols: number;
  rows: number;
  termName?: string;
}

export interface PtyExitEvent {
  exitCode: number;
  signal?: number;
}

export interface PtySession {
  pid?: number;
  write(input: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(listener: (chunk: string) => void): void;
  onExit(listener: (event: PtyExitEvent) => void): void;
}

class BunPtySessionAdapter implements PtySession {
  constructor(private readonly pty: BunPtyTerminal) {}

  get pid(): number | undefined {
    return typeof this.pty.pid === "number" ? this.pty.pid : undefined;
  }

  write(input: string): void {
    this.pty.write(input);
  }

  resize(cols: number, rows: number): void {
    this.pty.resize(cols, rows);
  }

  kill(): void {
    this.pty.kill();
  }

  onData(listener: (chunk: string) => void): void {
    this.pty.onData(listener);
  }

  onExit(listener: (event: PtyExitEvent) => void): void {
    this.pty.onExit((event: BunPtyExitEvent) => {
      listener({
        exitCode: event.exitCode,
        signal: typeof event.signal === "number" ? event.signal : undefined
      });
    });
  }
}

export function createPtySession(options: PtySessionOptions): PtySession {
  const pty = spawnPty(options.command, options.args, {
    name: options.termName ?? "xterm-256color",
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: options.env
  });
  return new BunPtySessionAdapter(pty);
}
