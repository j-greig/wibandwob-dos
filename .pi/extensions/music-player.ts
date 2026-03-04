/**
 * WibWob Music Player — fullscreen overlay plus inline background playback tool.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { Container, Text, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";
import {
	execFileSync,
	spawn,
	type ChildProcess,
	type ChildProcessWithoutNullStreams,
} from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const COMPOSITIONS_DIR = path.join(process.cwd(), "scratch/compositions");
const AUDIO_FILE_PATTERN = /\.(mp3|wav|m4a|ogg|flac)$/i;
const SCRUB_SECONDS = 5;
const VOLUME_STEP = 10;
const DEFAULT_VOLUME = 80;

type PlayState = "stopped" | "playing" | "paused";

type PlayerSnapshot = {
	files: string[];
	selectedIndex: number;
	filePath: string;
	fileName: string;
	state: PlayState;
	volume: number;
	elapsed: number;
	duration: number;
};

const PlayMusicParams = Type.Object({
	action: StringEnum(["play", "stop"] as const, {
		description: "Play a file from scratch/compositions or stop current playback.",
	}),
	filePath: Type.Optional(
		Type.String({
			description:
				"Absolute path or path relative to scratch/compositions. Required for action=play.",
		}),
	),
});

function fmtTime(secs: number): string {
	const safe = Number.isFinite(secs) ? Math.max(0, secs) : 0;
	const minutes = Math.floor(safe / 60);
	const seconds = Math.floor(safe % 60);
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getDuration(filePath: string): number {
	try {
		const output = execFileSync(
			"ffprobe",
			["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", filePath],
			{ encoding: "utf-8", timeout: 5000 },
		);
		const duration = parseFloat(output.trim());
		return Number.isFinite(duration) ? duration : 0;
	} catch {
		return 0;
	}
}

function findAudioFiles(dir: string): string[] {
	try {
		return fs.readdirSync(dir).filter((name) => AUDIO_FILE_PATTERN.test(name)).sort();
	} catch {
		return [];
	}
}

function resolveAudioPath(rawPath: string): string | null {
	const trimmed = rawPath.trim().replace(/^@/, "");
	if (!trimmed) return null;

	const candidates = [
		path.isAbsolute(trimmed) ? trimmed : "",
		path.resolve(process.cwd(), trimmed),
		path.resolve(COMPOSITIONS_DIR, trimmed),
	].filter(Boolean);

	for (const candidate of candidates) {
		if (!fs.existsSync(candidate)) continue;
		const stat = fs.statSync(candidate);
		if (stat.isFile() && stat.size > 0 && AUDIO_FILE_PATTERN.test(candidate)) {
			return candidate;
		}
	}

	return null;
}

class AudioPlayerController {
	private files: string[] = [];
	private selectedIndex = 0;
	private filePath = "";
	private fileName = "(no file)";
	private state: PlayState = "stopped";
	private volume = DEFAULT_VOLUME;
	private elapsed = 0;
	private duration = 0;
	private startTime = 0;
	private baseOffset = 0;
	private proc: ChildProcessWithoutNullStreams | null = null;
	private ticker: ReturnType<typeof setInterval> | null = null;
	private lastTickerSecond = -1;
	private listeners = new Set<() => void>();
	private opChain: Promise<void> = Promise.resolve();
	private generationCounter = 0;
	private activeGeneration = 0;

	constructor() {
		this.refreshFiles();
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	getSnapshot(): PlayerSnapshot {
		return {
			files: [...this.files],
			selectedIndex: this.selectedIndex,
			filePath: this.filePath,
			fileName: this.fileName,
			state: this.state,
			volume: this.volume,
			elapsed: this.getCurrentElapsed(),
			duration: this.duration,
		};
	}

	async startWithFile(startFile?: string): Promise<void> {
		if (!startFile) return;
		const resolved = resolveAudioPath(startFile);
		if (!resolved) return;
		await this.playFile(resolved);
	}

	selectNext(): void {
		this.refreshFiles();
		if (this.files.length === 0) return;
		if (this.selectedIndex >= this.files.length - 1) return;
		this.selectedIndex += 1;
		this.emitChange();
	}

	selectPrevious(): void {
		this.refreshFiles();
		if (this.files.length === 0) return;
		if (this.selectedIndex <= 0) return;
		this.selectedIndex -= 1;
		this.emitChange();
	}

	async playSelected(): Promise<void> {
		this.refreshFiles();
		const selected = this.files[this.selectedIndex];
		if (!selected) return;
		await this.playFile(path.join(COMPOSITIONS_DIR, selected));
	}

	async playFile(rawPath: string): Promise<PlayerSnapshot> {
		const resolved = resolveAudioPath(rawPath);
		if (!resolved) {
			throw new Error(`Audio file not found: ${rawPath}`);
		}

		await this.enqueue(async () => {
			this.refreshFiles();
			this.setCurrentFile(resolved);
			await this.restartPlayback(this.baseOffset, "playing");
		});

		return this.getSnapshot();
	}

	async stop(): Promise<PlayerSnapshot> {
		await this.enqueue(async () => {
			const proc = this.detachActiveProcess();
			await this.killAndWait(proc);
			this.stopTicker();
			this.state = "stopped";
			this.elapsed = 0;
			this.baseOffset = 0;
			this.emitChange();
		});
		return this.getSnapshot();
	}

	async togglePause(): Promise<PlayerSnapshot> {
		await this.enqueue(async () => {
			if (!this.filePath) return;

			if (this.state === "playing" && this.proc) {
				const current = this.getCurrentElapsed();
				this.writeToProc("p");
				this.stopTicker();
				this.state = "paused";
				this.elapsed = current;
				this.baseOffset = current;
				this.emitChange();
				return;
			}

			if (this.state === "paused" && this.proc) {
				this.writeToProc("p");
				this.startTime = Date.now();
				this.state = "playing";
				this.startTicker();
				this.emitChange();
				return;
			}

			await this.restartPlayback(this.baseOffset, "playing");
		});
		return this.getSnapshot();
	}

	async scrub(deltaSeconds: number): Promise<PlayerSnapshot> {
		await this.enqueue(async () => {
			if (!this.filePath) return;
			const target = this.clampElapsed(this.getCurrentElapsed() + deltaSeconds);
			this.elapsed = target;
			this.baseOffset = target;
			if (this.state === "stopped") {
				this.emitChange();
				return;
			}
			await this.restartPlayback(target, this.state);
		});
		return this.getSnapshot();
	}

	async changeVolume(delta: number): Promise<PlayerSnapshot> {
		await this.enqueue(async () => {
			this.volume = Math.max(0, Math.min(100, this.volume + delta));
			if (!this.filePath) {
				this.emitChange();
				return;
			}
			if (this.state === "stopped") {
				this.emitChange();
				return;
			}
			await this.restartPlayback(this.getCurrentElapsed(), this.state);
		});
		return this.getSnapshot();
	}

	private emitChange(): void {
		for (const listener of this.listeners) listener();
	}

	private refreshFiles(): void {
		this.files = findAudioFiles(COMPOSITIONS_DIR);
		if (this.files.length === 0) {
			this.selectedIndex = 0;
			return;
		}

		const currentIndex = this.fileName ? this.files.indexOf(this.fileName) : -1;
		if (currentIndex >= 0) {
			this.selectedIndex = currentIndex;
			return;
		}

		if (this.selectedIndex >= this.files.length) {
			this.selectedIndex = this.files.length - 1;
		}
	}

	private setCurrentFile(filePath: string): void {
		this.filePath = filePath;
		this.fileName = path.basename(filePath);
		this.duration = getDuration(filePath);
		this.elapsed = 0;
		this.baseOffset = 0;
		const fileIndex = this.files.indexOf(this.fileName);
		if (fileIndex >= 0) this.selectedIndex = fileIndex;
		this.emitChange();
	}

	private getCurrentElapsed(): number {
		if (this.state !== "playing") {
			return this.clampElapsed(this.elapsed);
		}
		const current = this.baseOffset + (Date.now() - this.startTime) / 1000;
		return this.clampElapsed(current);
	}

	private clampElapsed(value: number): number {
		if (this.duration <= 0) return Math.max(0, value);
		return Math.max(0, Math.min(this.duration, value));
	}

	private enqueue(op: () => Promise<void>): Promise<void> {
		const run = this.opChain.then(op, op);
		this.opChain = run.catch(() => undefined);
		return run;
	}

	private async restartPlayback(offset: number, desiredState: PlayState): Promise<void> {
		const proc = this.detachActiveProcess();
		await this.killAndWait(proc);
		if (!this.filePath) return;
		await this.spawnPlayback(offset, desiredState);
	}

	private async spawnPlayback(offset: number, desiredState: PlayState): Promise<void> {
		const args = ["-nodisp", "-autoexit", "-volume", String(this.volume)];
		if (offset > 0) {
			args.push("-ss", String(Math.floor(offset)));
		}
		args.push(this.filePath);

		const proc = spawn("ffplay", args, { stdio: ["pipe", "pipe", "pipe"] });
		const generation = ++this.generationCounter;
		this.proc = proc;
		this.activeGeneration = generation;
		this.elapsed = offset;
		this.baseOffset = offset;
		this.startTime = Date.now();

		let startupStderr = "";
		try {
			await new Promise<void>((resolve, reject) => {
				let settled = false;
				let startupTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
					startupTimer = null;
					cleanup();
					resolve();
				}, 200);
				const cleanup = () => {
					proc.off("error", onStartupError);
					proc.off("close", onStartupClose);
					proc.stderr?.off("data", onStderr);
					if (startupTimer) {
						clearTimeout(startupTimer);
						startupTimer = null;
					}
				};
				const fail = (error: Error) => {
					if (settled) return;
					settled = true;
					cleanup();
					reject(error);
				};
				const onStderr = (chunk: string | Buffer) => {
					if (startupStderr.length >= 400) return;
					startupStderr += String(chunk);
					if (startupStderr.length > 400) {
						startupStderr = startupStderr.slice(0, 400);
					}
				};
				const onStartupError = (error: Error) => {
					fail(new Error(this.formatPlaybackStartupError(error.message, startupStderr)));
				};
				const onStartupClose = (code: number | null, signal: NodeJS.Signals | null) => {
					fail(
						new Error(
							this.formatPlaybackStartupError(
								`ffplay exited during startup (code=${code ?? "null"}, signal=${signal ?? "null"})`,
								startupStderr,
							),
						),
					);
				};
				proc.stderr?.on("data", onStderr);
				proc.once("error", onStartupError);
				proc.once("close", onStartupClose);
			});
		} catch (error) {
			if (generation === this.activeGeneration) {
				this.handleProcessExit();
			}
			throw error;
		}

		this.state = "playing";
		this.startTicker();
		this.emitChange();

		proc.on("error", () => {
			if (generation !== this.activeGeneration) return;
			this.handleProcessExit();
		});

		proc.on("close", () => {
			if (generation !== this.activeGeneration) return;
			this.handleProcessExit();
		});

		if (desiredState === "paused") {
			await this.sendPauseToggle(proc);
			if (generation !== this.activeGeneration) return;
			this.stopTicker();
			this.state = "paused";
			this.elapsed = offset;
			this.baseOffset = offset;
			this.emitChange();
		}
	}

	private handleProcessExit(): void {
		this.proc = null;
		this.stopTicker();
		this.state = "stopped";
		this.elapsed = 0;
		this.baseOffset = 0;
		this.emitChange();
	}

	private detachActiveProcess(): ChildProcess | null {
		if (!this.proc) return null;
		const active = this.proc;
		this.proc = null;
		this.stopTicker();
		this.activeGeneration = ++this.generationCounter;
		return active;
	}

	private async killAndWait(proc: ChildProcess | null): Promise<void> {
		if (!proc) return;
		if (proc.exitCode !== null || proc.signalCode !== null) return;
		await new Promise<void>((resolve) => {
			let settled = false;
			let killTimer: ReturnType<typeof setTimeout> | null = null;
			let hardTimeout: ReturnType<typeof setTimeout> | null = null;
			const finish = () => {
				if (settled) return;
				settled = true;
				proc.off("close", finish);
				proc.off("error", finish);
				if (killTimer) clearTimeout(killTimer);
				if (hardTimeout) clearTimeout(hardTimeout);
				resolve();
			};
			proc.once("close", finish);
			proc.once("error", finish);
			hardTimeout = setTimeout(finish, 2000);
			try {
				proc.kill("SIGTERM");
				killTimer = setTimeout(() => {
					if (proc.exitCode !== null || proc.signalCode !== null) {
						finish();
						return;
					}
					try {
						proc.kill("SIGKILL");
					} catch {
						finish();
					}
				}, 500);
			} catch {
				finish();
			}
		});
	}

	private formatPlaybackStartupError(reason: string, startupStderr: string): string {
		const stderr = startupStderr.trim();
		return stderr ? `${reason}: ${stderr}` : reason;
	}

	private writeToProc(input: string): void {
		try {
			this.proc?.stdin.write(input);
		} catch {}
	}

	private async sendPauseToggle(proc: ChildProcessWithoutNullStreams): Promise<void> {
		await new Promise((resolve) => setTimeout(resolve, 60));
		try {
			proc.stdin.write("p");
		} catch {}
	}

	private startTicker(): void {
		this.stopTicker();
		this.lastTickerSecond = Math.floor(this.getCurrentElapsed());
		this.ticker = setInterval(() => {
			if (this.state !== "playing") return;
			this.elapsed = this.getCurrentElapsed();
			const currentSecond = Math.floor(this.elapsed);
			if (currentSecond === this.lastTickerSecond) return;
			this.lastTickerSecond = currentSecond;
			this.emitChange();
		}, 250);
	}

	private stopTicker(): void {
		if (!this.ticker) return;
		clearInterval(this.ticker);
		this.ticker = null;
		this.lastTickerSecond = -1;
	}
}

const playerController = new AudioPlayerController();

class MusicPlayerOverlay {
	private cachedWidth = -1;
	private cachedLines: string[] = [];
	private scrollTop = 0;
	private unsubscribe: (() => void) | null = null;
	private pendingEscape = "";
	private escapeTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private tui: { requestRender(): void },
		private onClose: () => void,
		startFile?: string,
	) {
		this.unsubscribe = playerController.subscribe(() => {
			this.cachedWidth = -1;
			this.tui.requestRender();
		});
		void playerController.startWithFile(startFile);
	}

	handleInput(data: string): boolean {
		if (this.pendingEscape || data.startsWith("\x1b")) {
			const resolved = this.resolveEscapeInput(data);
			if (!resolved) return true;
			data = resolved;
		}

		for (const chunk of splitInputChunks(data)) {
			if (!this.handleChunk(chunk)) return false;
		}
		return true;
	}

	private handleChunk(data: string): boolean {
		if (matchesKey(data, "escape") || data === "q" || data === "Q") {
			this.destroy();
			this.onClose();
			return false;
		}
		if (data === " ") {
			void playerController.togglePause();
		} else if (data === "s" || data === "S") {
			void playerController.stop();
		} else if (matchesKey(data, "right")) {
			void playerController.scrub(SCRUB_SECONDS);
		} else if (matchesKey(data, "left")) {
			void playerController.scrub(-SCRUB_SECONDS);
		} else if (data === "+" || data === "=") {
			void playerController.changeVolume(VOLUME_STEP);
		} else if (data === "-") {
			void playerController.changeVolume(-VOLUME_STEP);
		} else if (matchesKey(data, "down") || data === "j" || data === "J") {
			playerController.selectNext();
		} else if (matchesKey(data, "up") || data === "k" || data === "K") {
			playerController.selectPrevious();
		} else if (matchesKey(data, "return")) {
			void playerController.playSelected();
		}
		return true;
	}

	private resolveEscapeInput(data: string): string | null {
		const combined = `${this.pendingEscape}${data}`;
		this.pendingEscape = "";
		if (this.escapeTimer) {
			clearTimeout(this.escapeTimer);
			this.escapeTimer = null;
		}

		if (combined === "\x1b" || combined === "\x1b[") {
			this.pendingEscape = combined;
			this.escapeTimer = setTimeout(() => {
				if (this.pendingEscape !== "\x1b") return;
				this.pendingEscape = "";
				this.escapeTimer = null;
				this.destroy();
				this.onClose();
			}, 40);
			return null;
		}

		if (
			combined.startsWith("\x1b[") &&
			!combined.startsWith("\x1b[A") &&
			!combined.startsWith("\x1b[B") &&
			!combined.startsWith("\x1b[C") &&
			!combined.startsWith("\x1b[D")
		) {
			this.pendingEscape = combined;
			return null;
		}

		return combined;
	}

	invalidate(): void {
		this.cachedWidth = -1;
	}

	render(width: number): string[] {
		if (this.cachedWidth === width) return this.cachedLines;

		const dim = (text: string) => `\x1b[2m${text}\x1b[22m`;
		const bold = (text: string) => `\x1b[1m${text}\x1b[22m`;
		const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`;
		const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;
		const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
		const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
		const inverse = (text: string) => `\x1b[7m${text}\x1b[27m`;

		const snapshot = playerController.getSnapshot();
		const lines: string[] = [];
		const titleName = snapshot.fileName || "(no file)";
		const stateIcon =
			snapshot.state === "playing"
				? green("▶")
				: snapshot.state === "paused"
					? yellow("⏸")
					: red("■");
		const header = ` ${bold(cyan("♫ WibWob Player"))}  ${stateIcon}  ${bold(titleName)}`;
		lines.push(truncateToWidth(header, width));
		lines.push(dim("─".repeat(width)));

		const progressWidth = Math.max(10, width - 18);
		const ratio = snapshot.duration > 0 ? Math.min(snapshot.elapsed / snapshot.duration, 1) : 0;
		const filled = Math.round(ratio * progressWidth);
		const progressBar = cyan("█".repeat(filled)) + dim("░".repeat(progressWidth - filled));
		lines.push(` ${fmtTime(snapshot.elapsed)} ${progressBar} ${fmtTime(snapshot.duration)}`);

		const volumeBars = Math.round(snapshot.volume / 10);
		const volumeBar = green("▮".repeat(volumeBars)) + dim("▯".repeat(10 - volumeBars));
		lines.push(` Vol: ${volumeBar}  ${snapshot.volume}%`);
		lines.push(dim("─".repeat(width)));

		const termHeight = Math.max(12, (process.stdout.rows ?? 40) - 1);
		const chromeLines = 7;
		const listHeight = Math.max(3, termHeight - chromeLines);
		// Scroll only when selection goes outside visible window
		// Keep scroll position stable otherwise (no re-centering on every frame)
		if (snapshot.selectedIndex < this.scrollTop) {
			this.scrollTop = snapshot.selectedIndex;
		} else if (snapshot.selectedIndex >= this.scrollTop + listHeight) {
			this.scrollTop = snapshot.selectedIndex - listHeight + 1;
		}
		// Clamp scroll bounds
		this.scrollTop = Math.max(0, Math.min(this.scrollTop, Math.max(0, snapshot.files.length - listHeight)));
		const visibleFiles = snapshot.files.slice(this.scrollTop, this.scrollTop + listHeight);

		for (let row = 0; row < listHeight; row += 1) {
			const name = visibleFiles[row];
			if (!name) {
				lines.push("");
				continue;
			}
			const absoluteIndex = this.scrollTop + row;
			const isSelected = absoluteIndex === snapshot.selectedIndex;
			const isPlaying = name === snapshot.fileName && snapshot.state !== "stopped";
			const prefix = isPlaying ? green(" ♫ ") : "   ";
			const label = isSelected ? inverse(` ${name} `) : ` ${name}`;
			lines.push(truncateToWidth(`${prefix}${label}`, width));
		}

		lines.push(dim("─".repeat(width)));
		lines.push(
			dim(
				` ${yellow("space")} play/pause  ${yellow("s")} stop  ${yellow("←→")} scrub  ${yellow("+-")} vol  ${yellow("↑↓")} select  ${yellow("⏎")} load  ${yellow("q")} close`,
			),
		);

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}

	destroy(): void {
		if (this.escapeTimer) {
			clearTimeout(this.escapeTimer);
			this.escapeTimer = null;
		}
		this.pendingEscape = "";
		this.unsubscribe?.();
		this.unsubscribe = null;
	}
}

function splitInputChunks(data: string): string[] {
	const chunks: string[] = [];
	for (let index = 0; index < data.length; ) {
		if (data[index] === "\x1b" && data[index + 1] === "[" && index + 2 < data.length) {
			const chunk = data.slice(index, index + 3);
			if (chunk === "\x1b[A" || chunk === "\x1b[B" || chunk === "\x1b[C" || chunk === "\x1b[D") {
				chunks.push(chunk);
				index += 3;
				continue;
			}
		}
		chunks.push(data[index] ?? "");
		index += 1;
	}
	return chunks;
}

function renderInlineState(
	details: { state: PlayState; fileName: string; filePath?: string; volume: number },
	theme: {
		fg(token: string, text: string): string;
		bold(text: string): string;
	},
): Container {
	const icon =
		details.state === "playing"
			? theme.fg("success", "▶")
			: details.state === "paused"
				? theme.fg("warning", "⏸")
				: theme.fg("muted", "■");
	const name = details.fileName || "(no file)";
	const line =
		icon +
		" " +
		theme.fg("accent", name) +
		" " +
		theme.fg("muted", `[${details.state}, ${details.volume}%]`);
	const container = new Container();
	container.addChild(new Text(line, 0, 0));
	if (details.filePath) {
		container.addChild(new Text(theme.fg("dim", details.filePath), 0, 1));
	}
	return container;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_shutdown", async () => {
		await playerController.stop();
	});

	pi.registerTool({
		name: "play_music",
		label: "Play Music",
		description:
			"Play audio from scratch/compositions in the background via ffplay, or stop the current track.",
		parameters: PlayMusicParams,
		async execute(_toolCallId, params) {
			if (params.action === "stop") {
				const snapshot = await playerController.stop();
				return {
					content: [{ type: "text", text: "Stopped music playback." }],
					details: {
						action: "stop",
						state: snapshot.state,
						fileName: snapshot.fileName,
						filePath: snapshot.filePath,
						volume: snapshot.volume,
					},
				};
			}

			if (!params.filePath?.trim()) {
				return {
					isError: true,
					content: [{ type: "text", text: "filePath is required when action=play." }],
					details: { error: "filePath is required when action=play." },
				};
			}

			try {
				const snapshot = await playerController.playFile(params.filePath);
				return {
					content: [{ type: "text", text: `Playing ${snapshot.fileName}.` }],
					details: {
						action: "play",
						state: snapshot.state,
						fileName: snapshot.fileName,
						filePath: snapshot.filePath,
						volume: snapshot.volume,
					},
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					isError: true,
					content: [{ type: "text", text: message }],
					details: { error: message },
				};
			}
		},
		renderCall(args, theme) {
			const action = typeof args.action === "string" ? args.action : "play";
			if (action === "stop") {
				return new Text(
					theme.fg("toolTitle", theme.bold("♫ player ")) + theme.fg("muted", "stop"),
					0,
					0,
				);
			}

			const label = typeof args.filePath === "string" ? path.basename(args.filePath) : "(missing file)";
			return new Text(
				theme.fg("toolTitle", theme.bold("♫ player ")) +
					theme.fg("muted", "play ") +
					theme.fg("accent", label),
				0,
				0,
			);
		},
		renderResult(result, _options, theme) {
			const details = result.details as
				| {
						action?: "play" | "stop";
						state: PlayState;
						fileName: string;
						filePath?: string;
						volume: number;
						error?: string;
				  }
				| undefined;
			if (result.isError || details?.error) {
				const message =
					details?.error ??
					(result.content[0]?.type === "text" ? result.content[0].text : "Music command failed.");
				return new Text(theme.fg("error", `✗ ${message}`), 0, 0);
			}
			if (!details) {
				const message = result.content[0]?.type === "text" ? result.content[0].text : "";
				return new Text(message, 0, 0);
			}
			if (details.action === "stop") {
				const hasFile = Boolean(details.filePath);
				if (!hasFile) {
					return new Text(theme.fg("muted", "■ stopped"), 0, 0);
				}

				return renderInlineState(
					{
						...details,
						fileName: details.fileName || path.basename(details.filePath ?? ""),
					},
					theme,
				);
			}
			return renderInlineState(details, theme);
		},
	});

	pi.registerCommand("play", {
		description: "Open the fullscreen music player overlay",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Player requires interactive mode", "error");
				return;
			}

			const startFile = args?.trim() || undefined;
			await ctx.ui.custom<void>((tui, _theme, _kb, done) => {
				const overlay = new MusicPlayerOverlay(tui, () => done(undefined), startFile);
				return {
					render: (width) => overlay.render(width),
					invalidate: () => overlay.invalidate(),
					handleInput: (data) => {
						overlay.handleInput(data);
					},
				};
			});
		},
	});

	pi.registerCommand("stop", {
		description: "Stop any playing audio",
		handler: async (_args, ctx) => {
			const snapshot = await playerController.stop();
			const message =
				snapshot.fileName && snapshot.fileName !== "(no file)"
					? `Stopped ${snapshot.fileName}.`
					: "Stopped.";
			ctx.ui.notify(message, "info");
		},
	});
}
