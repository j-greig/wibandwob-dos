/**
 * Signls Extension — manage the signls generative MIDI sequencer from pi.
 *
 * Tools:
 *   signls — install, launch, stop, and inspect the signls TUI sequencer
 *
 * Signls is a non-linear, node-based MIDI sequencer (Go/Bubbletea TUI).
 * This extension handles binary installation, tmux-based launching, process
 * lifecycle, and bank file inspection — all from within pi.
 *
 * @see https://github.com/emprcl/signls
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { Container, Text } from "@mariozechner/pi-tui";
import { execSync, execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ── Constants ────────────────────────────────────────────────────────────────

const SIGNLS_VERSION = "v0.7.1";
const SIGNLS_DIR = path.join(process.cwd(), "vendor", "signls");
const SIGNLS_BIN = path.join(SIGNLS_DIR, "signls");
const SIGNLS_BANKS_DIR = path.join(SIGNLS_DIR, "banks");
const SIGNLS_CONFIG = path.join(SIGNLS_DIR, "config.json");
const SIGNLS_TMUX_SESSION = "signls";
const SIGNLS_DEFAULT_BANK = "default.json";

const RELEASE_URL_DARWIN = `https://github.com/emprcl/signls/releases/download/${SIGNLS_VERSION}/signls_${SIGNLS_VERSION}_macOS.tar.gz`;
const RELEASE_URL_LINUX = `https://github.com/emprcl/signls/releases/download/${SIGNLS_VERSION}/signls_${SIGNLS_VERSION}_Linux.tar.gz`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function isInstalled(): boolean {
	return fs.existsSync(SIGNLS_BIN);
}

function platformUrl(): string {
	return process.platform === "darwin" ? RELEASE_URL_DARWIN : RELEASE_URL_LINUX;
}

function install(): string {
	fs.mkdirSync(SIGNLS_DIR, { recursive: true });
	fs.mkdirSync(SIGNLS_BANKS_DIR, { recursive: true });

	const url = platformUrl();
	const tarball = path.join(SIGNLS_DIR, "signls.tar.gz");

	try {
		execSync(`curl -sL "${url}" -o "${tarball}"`, { timeout: 60_000 });
		execSync(`tar -xzf "${tarball}" -C "${SIGNLS_DIR}"`, { timeout: 10_000 });
		fs.unlinkSync(tarball);

		// The tarball extracts a `signls` binary directly
		if (!fs.existsSync(SIGNLS_BIN)) {
			// Some releases nest in a directory — check for that
			const entries = fs.readdirSync(SIGNLS_DIR);
			for (const entry of entries) {
				const nested = path.join(SIGNLS_DIR, entry, "signls");
				if (fs.existsSync(nested)) {
					fs.renameSync(nested, SIGNLS_BIN);
					break;
				}
			}
		}

		fs.chmodSync(SIGNLS_BIN, 0o755);
		return `Installed signls ${SIGNLS_VERSION} to ${SIGNLS_BIN}`;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw new Error(`Failed to install signls: ${msg}`);
	}
}

function hasTmux(): boolean {
	try {
		execFileSync("tmux", ["-V"], { stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

function isRunning(): boolean {
	try {
		const result = spawnSync("tmux", ["has-session", "-t", SIGNLS_TMUX_SESSION], {
			stdio: "pipe",
		});
		return result.status === 0;
	} catch {
		return false;
	}
}

function resolveBankPath(bankName?: string): string {
	const name = bankName?.trim() || SIGNLS_DEFAULT_BANK;
	const withExt = name.endsWith(".json") ? name : `${name}.json`;
	return path.join(SIGNLS_BANKS_DIR, withExt);
}

function launchSignls(bankName?: string): string {
	if (!isInstalled()) {
		install();
	}

	if (!hasTmux()) {
		throw new Error("tmux is required to launch signls in the background. Install tmux first.");
	}

	if (isRunning()) {
		return "signls is already running in tmux session 'signls'. Use action 'attach' to connect.";
	}

	const bankPath = resolveBankPath(bankName);
	// Ensure parent dir exists
	fs.mkdirSync(path.dirname(bankPath), { recursive: true });

	const cmd = [
		"tmux", "new-session", "-d", "-s", SIGNLS_TMUX_SESSION,
		SIGNLS_BIN,
		"--config", SIGNLS_CONFIG,
		"--bank", bankPath,
		"--keyboard", process.platform === "darwin" ? "qwerty-mac" : "qwerty",
	];

	try {
		execFileSync(cmd[0]!, cmd.slice(1), { stdio: "pipe", cwd: SIGNLS_DIR });
		return `Launched signls in tmux session '${SIGNLS_TMUX_SESSION}' with bank ${path.basename(bankPath)}. Use 'tmux attach -t ${SIGNLS_TMUX_SESSION}' or action 'attach' to interact.`;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw new Error(`Failed to launch signls: ${msg}`);
	}
}

function stopSignls(): string {
	if (!isRunning()) {
		return "signls is not running.";
	}
	try {
		// Send ctrl+q (quit) to signls so it saves state gracefully
		execFileSync("tmux", ["send-keys", "-t", SIGNLS_TMUX_SESSION, "C-q", ""], {
			stdio: "pipe",
		});
		// Give it a moment to quit
		spawnSync("sleep", ["1"]);
		// If still alive, kill the session
		if (isRunning()) {
			execFileSync("tmux", ["kill-session", "-t", SIGNLS_TMUX_SESSION], {
				stdio: "pipe",
			});
		}
		return "signls stopped.";
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw new Error(`Failed to stop signls: ${msg}`);
	}
}

function getStatus(): {
	installed: boolean;
	version: string;
	running: boolean;
	bankFiles: string[];
} {
	const bankFiles: string[] = [];
	if (fs.existsSync(SIGNLS_BANKS_DIR)) {
		for (const f of fs.readdirSync(SIGNLS_BANKS_DIR)) {
			if (f.endsWith(".json")) bankFiles.push(f);
		}
	}

	return {
		installed: isInstalled(),
		version: SIGNLS_VERSION,
		running: isRunning(),
		bankFiles: bankFiles.sort(),
	};
}

type GridSummary = {
	index: number;
	tempo: number;
	key: number;
	scale: number;
	nodeCount: number;
	width: number;
	height: number;
	device: string;
	empty: boolean;
};

type BankSummary = {
	file: string;
	activeGrid: number;
	gridCount: number;
	grids: GridSummary[];
};

function inspectBank(bankName?: string): BankSummary {
	const bankPath = resolveBankPath(bankName);
	if (!fs.existsSync(bankPath)) {
		throw new Error(`Bank file not found: ${bankPath}`);
	}

	const raw = JSON.parse(fs.readFileSync(bankPath, "utf-8"));
	const grids: GridSummary[] = [];

	for (let i = 0; i < (raw.grids?.length ?? 0); i++) {
		const g = raw.grids[i];
		grids.push({
			index: i,
			tempo: g.tempo ?? 120,
			key: g.key ?? 60,
			scale: g.scale ?? 0,
			nodeCount: g.nodes?.length ?? 0,
			width: g.width ?? 20,
			height: g.height ?? 20,
			device: g.device ?? "",
			empty: (g.nodes?.length ?? 0) === 0,
		});
	}

	return {
		file: path.basename(bankPath),
		activeGrid: raw.active ?? 0,
		gridCount: grids.length,
		grids,
	};
}

// MIDI note number to name
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function midiNoteName(n: number): string {
	const octave = Math.floor(n / 12) - 1;
	const name = NOTE_NAMES[n % 12] ?? "?";
	return `${name}${octave}`;
}

// ── Extension ────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "signls",
		label: "Signls",
		description:
			"Manage the signls generative MIDI sequencer. Install, launch in tmux, stop, check status, and inspect bank files.",
		promptSnippet:
			"Install, launch, stop, and inspect the signls node-based MIDI sequencer (runs in tmux).",
		promptGuidelines: [
			"Use signls to manage the generative MIDI sequencer. Launch starts it in a tmux session; the user interacts with its TUI directly.",
			"Bank files live in vendor/signls/banks/. Each bank has 32 grids with tempo, key, scale, and node placements.",
			"signls outputs MIDI — connect a DAW or software synth to hear output.",
		],
		parameters: Type.Object({
			action: StringEnum(
				["install", "launch", "stop", "attach", "status", "inspect"] as const,
				{
					description:
						"install: download binary. launch: start in tmux (auto-installs). stop: graceful shutdown. attach: print attach command. status: installed/running/banks. inspect: read a bank file.",
				},
			),
			bank: Type.Optional(
				Type.String({
					description:
						'Bank file name for launch/inspect (default: "default.json"). Resolved from vendor/signls/banks/.',
				}),
			),
		}),

		async execute(_toolCallId, params) {
			const action = params.action;

			try {
				switch (action) {
					case "install": {
						const msg = install();
						return {
							content: [{ type: "text", text: msg }],
							details: { action, ...getStatus() },
						};
					}

					case "launch": {
						const msg = launchSignls(params.bank);
						return {
							content: [{ type: "text", text: msg }],
							details: { action, ...getStatus() },
						};
					}

					case "stop": {
						const msg = stopSignls();
						return {
							content: [{ type: "text", text: msg }],
							details: { action, ...getStatus() },
						};
					}

					case "attach": {
						const running = isRunning();
						const msg = running
							? `tmux attach -t ${SIGNLS_TMUX_SESSION}`
							: "signls is not running. Use action 'launch' first.";
						return {
							content: [{ type: "text", text: msg }],
							details: { action, running },
						};
					}

					case "status": {
						const status = getStatus();
						const lines = [
							`Installed: ${status.installed ? "yes" : "no"}`,
							`Version: ${status.version}`,
							`Running: ${status.running ? "yes" : "no"}`,
							`Banks: ${status.bankFiles.length > 0 ? status.bankFiles.join(", ") : "(none)"}`,
						];
						return {
							content: [{ type: "text", text: lines.join("\n") }],
							details: { action, ...status },
						};
					}

					case "inspect": {
						const bank = inspectBank(params.bank);
						const nonEmpty = bank.grids.filter((g) => !g.empty);
						const lines = [
							`Bank: ${bank.file} (${bank.gridCount} grids, active: ${bank.activeGrid})`,
							"",
							...nonEmpty.map((g) => {
								const key = midiNoteName(g.key);
								return `  Grid ${g.index}: ${g.nodeCount} nodes, ${g.tempo} BPM, key ${key}, ${g.width}×${g.height}${g.device ? ` [${g.device}]` : ""}`;
							}),
						];
						if (nonEmpty.length === 0) {
							lines.push("  (all grids empty)");
						}
						return {
							content: [{ type: "text", text: lines.join("\n") }],
							details: { action, ...bank },
						};
					}

					default:
						return {
							content: [{ type: "text", text: `Unknown action: ${action}` }],
							details: { action },
						};
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				throw new Error(message);
			}
		},

		renderCall(args, theme) {
			const action = typeof args.action === "string" ? args.action : "?";
			const bank = typeof args.bank === "string" ? ` ${args.bank}` : "";
			return new Text(
				theme.fg("toolTitle", theme.bold("🎵 signls ")) +
					theme.fg("accent", action) +
					theme.fg("muted", bank),
				0,
				0,
			);
		},

		renderResult(result, _options, theme) {
			const details = result.details as Record<string, unknown> | undefined;
			if (result.isError) {
				const msg =
					result.content[0]?.type === "text" ? result.content[0].text : "signls error";
				return new Text(theme.fg("error", `✗ ${msg}`), 0, 0);
			}

			const action = (details?.action as string) ?? "";
			const text = result.content[0]?.type === "text" ? result.content[0].text : "";

			// Status gets a formatted multi-line render
			if (action === "status" || action === "inspect") {
				const lines = text.split("\n");
				const container = new Container();
				for (let i = 0; i < lines.length; i++) {
					container.addChild(new Text(lines[i]!, 0, i));
				}
				return container;
			}

			const icon = details?.running ? theme.fg("success", "▶") : theme.fg("muted", "■");
			return new Text(`${icon} ${text}`, 0, 0);
		},
	});

	// Convenience commands
	pi.registerCommand("signls", {
		description: "Launch or manage signls MIDI sequencer (usage: /signls [launch|stop|status|attach])",
		handler: async (args, ctx) => {
			const action = args?.trim() || "status";
			const valid = ["install", "launch", "stop", "attach", "status", "inspect"];
			if (!valid.includes(action)) {
				ctx.ui.notify(`Unknown action: ${action}. Try: ${valid.join(", ")}`, "error");
				return;
			}

			// For launch/stop/status, run the tool inline
			if (action === "launch") {
				try {
					const msg = launchSignls();
					ctx.ui.notify(msg, "success");
				} catch (err) {
					ctx.ui.notify(err instanceof Error ? err.message : String(err), "error");
				}
			} else if (action === "stop") {
				try {
					const msg = stopSignls();
					ctx.ui.notify(msg, "info");
				} catch (err) {
					ctx.ui.notify(err instanceof Error ? err.message : String(err), "error");
				}
			} else if (action === "attach") {
				if (isRunning()) {
					ctx.ui.notify(`tmux attach -t ${SIGNLS_TMUX_SESSION}`, "info");
				} else {
					ctx.ui.notify("signls is not running.", "error");
				}
			} else if (action === "install") {
				try {
					const msg = install();
					ctx.ui.notify(msg, "success");
				} catch (err) {
					ctx.ui.notify(err instanceof Error ? err.message : String(err), "error");
				}
			} else {
				const status = getStatus();
				ctx.ui.notify(
					`signls: ${status.installed ? "installed" : "not installed"}, ${status.running ? "running" : "stopped"}, ${status.bankFiles.length} bank(s)`,
					"info",
				);
			}
		},
	});

	// Cleanup on session shutdown
	pi.on("session_shutdown", async () => {
		// Don't auto-stop signls — it may be intentionally running for music
	});
}
