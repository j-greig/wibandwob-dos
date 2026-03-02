/**
 * MonsterCamService — spawns the face worker, reads socket frames, emits events.
 */
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { EventEmitter } from "events";
import { spawn, type ChildProcess } from "child_process";

export interface MonsterCamFrame {
  w: number;
  h: number;
  ts: number;
  hasFace: boolean;
  bbox: [number, number, number, number];
  hasHands: boolean;
  handCount: number;
  handBoxes: [number, number, number, number][];
  handLabels: string[];
  hasPose: boolean;
  fps: number;
  gray: Uint8Array; // w*h grayscale bytes
}

export declare interface MonsterCamService {
  on(event: "frame", listener: (frame: MonsterCamFrame) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(event: "ready", listener: () => void): this;
}

const SOCK_PATH = "/tmp/face_monster_cam.sock";
const WORKER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "monster-cam-worker.ts"
);

export class MonsterCamService extends EventEmitter {
  private worker: ChildProcess | null = null;
  private sock: net.Socket | null = null;
  private running = false;
  private buf = Buffer.alloc(0);
  private pendingHeader: Omit<MonsterCamFrame, "gray"> | null = null;

  start() {
    if (this.running) return;
    this.running = true;
    this._spawnWorker();
  }

  stop() {
    this.running = false;
    this.sock?.destroy();
    this.sock = null;
    this.worker?.kill();
    this.worker = null;
  }

  private _spawnWorker() {
    this.worker = spawn("bun", ["run", WORKER_PATH], {
      stdio: ["ignore", "ignore", "pipe"],
      env: { ...process.env, MONSTER_CAM_SOCK: SOCK_PATH },
    });

    this.worker.stderr?.on("data", (d: Buffer) => {
      const msg = d.toString();
      // Python worker logs "Socket ready: /tmp/..." when ready
      if (msg.toLowerCase().includes("socket ready")) {
        setTimeout(() => this._connect(), 200);
      }
    });

    this.worker.on("close", (code) => {
      if (this.running) {
        this.emit("error", new Error(`Worker exited with code ${code}`));
      }
    });

    this.worker.on("error", (err) => {
      this.emit("error", err);
    });
  }

  private _connect() {
    const sock = net.createConnection(SOCK_PATH);
    this.sock = sock;

    sock.on("connect", () => this.emit("ready"));

    sock.on("data", (chunk: Buffer) => {
      this.buf = Buffer.concat([this.buf, chunk]);
      this._parseFrames();
    });

    sock.on("error", (err) => {
      if (this.running) this.emit("error", err);
    });

    sock.on("close", () => {
      if (this.running) this.emit("error", new Error("Socket closed unexpectedly"));
    });
  }

  private _parseFrames() {
    while (true) {
      if (!this.pendingHeader) {
        // Look for newline (JSON header)
        const nl = this.buf.indexOf(10); // '\n'
        if (nl === -1) break;
        const line = this.buf.subarray(0, nl).toString("utf8");
        this.buf = this.buf.subarray(nl + 1);
        try {
          const h = JSON.parse(line);
          this.pendingHeader = {
            w: h.w, h: h.h, ts: h.ts,
            hasFace:   h.has_face   ?? false,
            bbox:      h.bbox       ?? [0,0,0,0],
            hasHands:  h.has_hands  ?? false,
            handCount: h.hand_count ?? 0,
            handBoxes:  h.hand_boxes   ?? [],
            handLabels: h.hand_labels  ?? [],
            hasPose:   h.has_pose   ?? false,
            fps:       h.fps        ?? 0,
          };
        } catch { /* malformed header — skip */ }
      }

      if (this.pendingHeader) {
        const needed = this.pendingHeader.w * this.pendingHeader.h;
        if (this.buf.length < needed) break;
        const gray = new Uint8Array(this.buf.subarray(0, needed));
        this.buf = this.buf.subarray(needed);
        const frame: MonsterCamFrame = { ...this.pendingHeader, gray };
        this.pendingHeader = null;
        this.emit("frame", frame);
      }
    }
  }
}
