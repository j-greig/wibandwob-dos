/**
 * Codex Subagent — delegate tasks to OpenAI Codex CLI as an isolated subagent.
 *
 * Reads agent definitions from .pi/agents/codex-*.md
 * Spawns `codex exec` with appropriate flags based on agent mode.
 *
 * Two modes:
 *   - analysis: read-only (default sandbox)
 *   - implementation: workspace-write, -a never (unattended)
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

interface CodexAgentConfig {
	name: string;
	description: string;
	mode: "analysis" | "implementation";
	model: string;
	systemPrompt: string;
	filePath: string;
}

function loadCodexAgents(cwd: string): CodexAgentConfig[] {
	const agents: CodexAgentConfig[] = [];
	const dirs = [
		path.join(os.homedir(), ".pi", "agent", "agents"),
		path.join(cwd, ".pi", "agents"),
	];

	for (const dir of dirs) {
		if (!fs.existsSync(dir)) continue;
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (!entry.name.startsWith("codex-") || !entry.name.endsWith(".md")) continue;
			const filePath = path.join(dir, entry.name);
			const content = fs.readFileSync(filePath, "utf-8");

			// Simple frontmatter parser
			const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
			if (!fmMatch) continue;

			const fm: Record<string, string> = {};
			for (const line of fmMatch[1].split("\n")) {
				const m = line.match(/^(\w+):\s*(.+)$/);
				if (m) fm[m[1]] = m[2].trim();
			}

			if (!fm.name || !fm.description) continue;

			agents.push({
				name: fm.name,
				description: fm.description,
				mode: fm.mode === "implementation" ? "implementation" : "analysis",
				model: fm.model || "gpt-5.3-codex",
				systemPrompt: fmMatch[2].trim(),
				filePath,
			});
		}
	}
	return agents;
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "codex",
		label: "Codex",
		description: [
			"Delegate tasks to OpenAI Codex CLI as an isolated subagent.",
			"Agents: codex-standard (general-purpose, gpt-5.3-codex) or codex-heavy (complex tasks, gpt-5.4).",
			"Codex runs in a separate process with its own context.",
			"USAGE RESTRICTION: Codex budget is limited. Do NOT use proactively.",
			"Only use when the human explicitly requests Codex. Ask permission first.",
		].join(" "),
		parameters: Type.Object({
			agent: Type.String({
				description: 'Codex agent name: "codex-standard" (general-purpose) or "codex-heavy" (complex tasks)',
			}),
			task: Type.String({ description: "Task to delegate to Codex" }),
			files: Type.Optional(
				Type.Array(Type.String(), {
					description: "Key files to focus on (added to prompt context)",
				})
			),
			cwd: Type.Optional(
				Type.String({ description: "Working directory (defaults to repo root)" })
			),
		}),

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const agents = loadCodexAgents(ctx.cwd);
			const agent = agents.find((a) => a.name === params.agent);

			if (!agent) {
				const available = agents.map((a) => `${a.name}: ${a.description}`).join("\n") || "none found";
				return {
					content: [{ type: "text", text: `Unknown agent "${params.agent}". Available:\n${available}` }],
				};
			}

			// Build prompt
			let prompt = agent.systemPrompt + "\n\n";
			if (params.files && params.files.length > 0) {
				prompt += `Focus files: ${params.files.join(", ")}\n\n`;
			}
			prompt += `TASK: ${params.task}`;

			// Build codex args
			const args: string[] = ["-m", agent.model];
			if (agent.mode === "implementation") {
				args.push("-s", "workspace-write", "-a", "never");
			}
			args.push("exec", "-C", params.cwd || ctx.cwd, prompt);

			// Log setup
			const logDir = path.join(ctx.cwd, ".codex-logs", new Date().toISOString().slice(0, 10));
			fs.mkdirSync(logDir, { recursive: true });
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
			const slug = params.task.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
			const logPath = path.join(logDir, `codex-${slug}-${timestamp}.log`);
			const logStream = fs.createWriteStream(logPath);

			let output = "";
			let stderr = "";

			// Emit initial update
			if (onUpdate) {
				onUpdate({
					content: [{ type: "text", text: `⏳ ${agent.name}: starting...\nLog: ${logPath}` }],
				});
			}

			const exitCode = await new Promise<number>((resolve) => {
				const proc = spawn("codex", args, {
					cwd: params.cwd || ctx.cwd,
					shell: false,
					stdio: ["ignore", "pipe", "pipe"],
				});

				proc.stdout.on("data", (data) => {
					const chunk = data.toString();
					output += chunk;
					logStream.write(chunk);

					if (onUpdate) {
						// Show last 500 chars of output as progress
						const preview = output.length > 500 ? `...${output.slice(-500)}` : output;
						onUpdate({
							content: [{
								type: "text",
								text: `⏳ ${agent.name}: running...\n${preview}`,
							}],
						});
					}
				});

				proc.stderr.on("data", (data) => {
					const chunk = data.toString();
					stderr += chunk;
					logStream.write(`[stderr] ${chunk}`);
				});

				proc.on("close", (code) => {
					logStream.end();
					resolve(code ?? 1);
				});

				proc.on("error", (err) => {
					logStream.write(`[error] ${err.message}\n`);
					logStream.end();
					resolve(1);
				});

				if (signal) {
					const kill = () => {
						proc.kill("SIGTERM");
						setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 5000);
					};
					if (signal.aborted) kill();
					else signal.addEventListener("abort", kill, { once: true });
				}
			});

			const isError = exitCode !== 0;
			const icon = isError ? "✗" : "✓";

			return {
				content: [{
					type: "text",
					text: [
						`${icon} ${agent.name} (exit ${exitCode})`,
						`Log: ${logPath}`,
						isError && stderr ? `\nStderr: ${stderr.slice(0, 500)}` : "",
						`\n${output || "(no output)"}`,
					].filter(Boolean).join("\n"),
				}],
				isError,
			};
		},

		renderCall(args, theme) {
			const agentName = args.agent || "codex";
			const preview = args.task
				? (args.task.length > 60 ? `${args.task.slice(0, 60)}...` : args.task)
				: "...";
			let text = theme.fg("toolTitle", theme.bold("codex "))
				+ theme.fg("accent", agentName);
			if (args.files?.length) {
				text += theme.fg("muted", ` [${args.files.length} files]`);
			}
			text += `\n  ${theme.fg("dim", preview)}`;
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded }, theme) {
			const text = result.content[0];
			const content = text?.type === "text" ? text.text : "(no output)";

			if (expanded) {
				return new Text(content, 0, 0);
			}

			// Collapsed: show first 10 lines
			const lines = content.split("\n");
			const preview = lines.slice(0, 10).join("\n");
			const remaining = lines.length - 10;
			let display = preview;
			if (remaining > 0) {
				display += `\n${theme.fg("muted", `... +${remaining} lines (Ctrl+O to expand)`)}`;
			}
			return new Text(display, 0, 0);
		},
	});
}
