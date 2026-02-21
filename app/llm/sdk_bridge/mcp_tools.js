/**
 * MCP Tools for TUI Application Control
 * 
 * Provides custom tools for Claude Code SDK that interface
 * with the TUI application's API server for programmatic control.
 * 
 * Tools here should match the Python MCP surface in tools/api_server/mcp_tools.py.
 * Window types are NOT hardcoded — use z.string() and let the C++ registry validate.
 */

const { createSdkMcpServer, tool } = require('@anthropic-ai/claude-agent-sdk');
const { z } = require('zod');
const axios = require('axios');

// API Server base URL (assuming running on default port)
const API_BASE_URL = 'http://127.0.0.1:8089';

// HTTP client with error handling
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json'
    }
});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.code === 'ECONNREFUSED') {
            throw new Error('API server not running. Please start the TUI application first.');
        }
        throw error;
    }
);

// Helper: run a menu command via the API
async function execCommand(command, args = {}) {
    const payload = { command };
    if (Object.keys(args).length > 0) {
        payload.args = args;
    }
    const response = await apiClient.post('/menu/command', payload);
    return response.data;
}

// Helper: standard success/error response wrapper
function mcpResult(text) {
    return { content: [{ type: "text", text }] };
}
function mcpError(text) {
    return { content: [{ type: "text", text }], isError: true };
}

/**
 * Create MCP server with TUI control tools.
 * Matches Python MCP surface in tools/api_server/mcp_tools.py.
 */
function createTuiMcpServer() {
    return createSdkMcpServer({
        name: "tui-control",
        version: "1.0.0",
        description: "Tools for controlling TUI application windows and layout",
        
        tools: [
            // ── Window Management ──────────────────────────────────────

            tool(
                "tui_create_window",
                "Create a new window in the TUI application. Use /capabilities to see all available types.",
                {
                    type: z.string().describe("Window type slug (e.g. test_pattern, gradient, verse, terminal, browser, paint, text_editor, orbit, life, blocks, etc.)"),
                    title: z.string().optional().describe("Window title"),
                    x: z.number().int().optional().describe("X position"),
                    y: z.number().int().optional().describe("Y position"), 
                    width: z.number().int().optional().describe("Window width"),
                    height: z.number().int().optional().describe("Window height"),
                    props: z.record(z.any()).optional().describe("Additional window properties")
                },
                async (args) => {
                    try {
                        const payload = {
                            type: args.type,
                            title: args.title,
                            rect: (args.x !== undefined && args.y !== undefined && args.width && args.height) ? {
                                x: args.x, y: args.y, w: args.width, h: args.height
                            } : undefined,
                            props: args.props || {}
                        };
                        const response = await apiClient.post('/windows', payload);
                        console.error(`MCP TOOL: tui_create_window - created ${args.type} window ${response.data.id}`);
                        return mcpResult(`Created ${args.type} window: ${response.data.id}\nTitle: ${response.data.title}\nPosition: (${response.data.rect.x}, ${response.data.rect.y})\nSize: ${response.data.rect.w}x${response.data.rect.h}`);
                    } catch (error) {
                        return mcpError(`Error creating window: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_move_window", 
                "Move and resize a window",
                {
                    windowId: z.string().describe("ID of the window to move"),
                    x: z.number().int().optional().describe("New X position"),
                    y: z.number().int().optional().describe("New Y position"),
                    width: z.number().int().optional().describe("New width"),
                    height: z.number().int().optional().describe("New height")
                },
                async (args) => {
                    try {
                        const payload = {};
                        if (args.x !== undefined) payload.x = args.x;
                        if (args.y !== undefined) payload.y = args.y;
                        if (args.width !== undefined) payload.w = args.width;
                        if (args.height !== undefined) payload.h = args.height;
                        const response = await apiClient.post(`/windows/${args.windowId}/move`, payload);
                        console.error(`MCP TOOL: tui_move_window - moved ${args.windowId}`);
                        return mcpResult(`Moved window ${args.windowId} to (${response.data.rect.x}, ${response.data.rect.y}), size ${response.data.rect.w}x${response.data.rect.h}`);
                    } catch (error) {
                        return mcpError(`Error moving window: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_get_state",
                "Get current state of TUI application including all windows and canvas size",
                {},
                async () => {
                    try {
                        const response = await apiClient.get('/state');
                        const state = response.data;
                        console.error(`MCP TOOL: tui_get_state - ${state.windows.length} windows`);
                        const windowList = state.windows.map(w => 
                            `- ${w.id}: ${w.type} "${w.title}" at (${w.rect.x},${w.rect.y}) ${w.rect.w}x${w.rect.h}${w.focused ? ' [FOCUSED]' : ''}`
                        ).join('\n');
                        return mcpResult(`TUI State:\nCanvas: ${state.canvas.width}x${state.canvas.height} (${state.canvas.cols}x${state.canvas.rows})\nPattern Mode: ${state.pattern_mode}\nUptime: ${Math.floor(state.uptime_sec)}s\n\nWindows (${state.windows.length}):\n${windowList || '(no windows)'}`);
                    } catch (error) {
                        return mcpError(`Error getting state: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_close_window",
                "Close a specific window",
                { windowId: z.string().describe("ID of the window to close") },
                async (args) => {
                    try {
                        await apiClient.post(`/windows/${args.windowId}/close`);
                        return mcpResult(`Closed window ${args.windowId}`);
                    } catch (error) {
                        return mcpError(`Error closing window: ${error.message}`);
                    }
                }
            ),

            // ── Layout Commands ────────────────────────────────────────

            tool(
                "tui_cascade_windows",
                "Arrange all windows in cascade layout", 
                {},
                async () => {
                    try {
                        await execCommand("cascade");
                        return mcpResult("Windows cascaded");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_tile_windows", 
                "Arrange all windows in tiled layout",
                {},
                async () => {
                    try {
                        await execCommand("tile");
                        return mcpResult("Windows tiled");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_close_all_windows",
                "Close all windows",
                {},
                async () => {
                    try {
                        await execCommand("close_all");
                        return mcpResult("All windows closed");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            // ── Text Editor ────────────────────────────────────────────

            tool(
                "tui_send_text",
                "Send text to a text editor window",
                {
                    windowId: z.string().optional().describe("ID of text editor window"),
                    content: z.string().describe("Text content to send"),
                    mode: z.enum(["append", "replace", "insert"]).default("append").describe("How to insert the text")
                },
                async (args) => {
                    try {
                        const endpoint = args.windowId ? 
                            `/windows/${args.windowId}/send_text` : '/text_editor/send_text';
                        await apiClient.post(endpoint, { content: args.content, mode: args.mode });
                        return mcpResult(`Text sent to ${args.windowId || 'auto-created'} editor (${args.mode} mode)`);
                    } catch (error) {
                        return mcpError(`Error sending text: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_send_figlet",
                "Send ASCII art text using figlet to a text editor window",
                {
                    text: z.string().describe("Text to convert to ASCII art"),
                    font: z.string().default("standard").describe("Figlet font name"),
                    windowId: z.string().optional().describe("ID of text editor window")
                },
                async (args) => {
                    try {
                        const endpoint = args.windowId ?
                            `/windows/${args.windowId}/send_figlet` : '/text_editor/send_figlet';
                        await apiClient.post(endpoint, { text: args.text, font: args.font });
                        return mcpResult(`Figlet "${args.text}" (${args.font}) sent to editor`);
                    } catch (error) {
                        return mcpError(`Error sending figlet: ${error.message}`);
                    }
                }
            ),

            // ── Terminal ───────────────────────────────────────────────

            tool(
                "tui_open_terminal",
                "Open a new terminal emulator window",
                {},
                async () => {
                    try {
                        await execCommand("open_terminal");
                        return mcpResult("Terminal opened");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_terminal_write",
                "Write text/commands to the terminal window. Use a real newline character (not literal backslash-n) to press Enter.",
                { text: z.string().describe("Text to write to terminal. Include a newline to press Enter.") },
                async (args) => {
                    try {
                        // Unescape literal \n and \r that the LLM may produce
                        const text = args.text.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
                        await execCommand("terminal_write", { text });
                        return mcpResult(`Wrote to terminal: ${args.text.substring(0, 60)}`);
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_terminal_read",
                "Read current terminal output buffer",
                {},
                async () => {
                    try {
                        const result = await execCommand("terminal_read");
                        const output = result.result || '';
                        // Strip null bytes from terminal buffer
                        const clean = output.replace(/\0/g, '').trim();
                        return mcpResult(`Terminal output:\n${clean.substring(0, 2000)}`);
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            // ── Screenshot ─────────────────────────────────────────────

            tool(
                "tui_screenshot",
                "Take a screenshot of the TUI canvas",
                {},
                async () => {
                    try {
                        await execCommand("screenshot");
                        return mcpResult("Screenshot taken");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            // ── Theme ──────────────────────────────────────────────────

            tool(
                "tui_set_theme_mode",
                "Set the TUI theme mode",
                { mode: z.enum(["light", "dark"]).describe("Theme mode") },
                async (args) => {
                    try {
                        await execCommand("set_theme_mode", { mode: args.mode });
                        return mcpResult(`Theme set to ${args.mode}`);
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_set_theme_variant",
                "Set the TUI theme colour variant",
                { variant: z.string().describe("Theme variant name (e.g. monochrome, dark_pastel, neon)") },
                async (args) => {
                    try {
                        await execCommand("set_theme_variant", { variant: args.variant });
                        return mcpResult(`Theme variant set to ${args.variant}`);
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_reset_theme",
                "Reset theme to defaults",
                {},
                async () => {
                    try {
                        await execCommand("reset_theme");
                        return mcpResult("Theme reset to defaults");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            // ── Pattern Mode ───────────────────────────────────────────

            tool(
                "tui_set_pattern_mode",
                "Set background pattern animation mode",
                { mode: z.string().optional().describe("Pattern mode (e.g. continuous, static)") },
                async (args) => {
                    try {
                        await execCommand("pattern_mode", args.mode ? { mode: args.mode } : {});
                        return mcpResult("Pattern mode updated");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            // ── Scramble (cat pet) ─────────────────────────────────────

            tool(
                "tui_open_scramble",
                "Open the Scramble cat window",
                {},
                async () => {
                    try {
                        await execCommand("open_scramble");
                        return mcpResult("Scramble opened");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_scramble_say",
                "Make Scramble the cat say something",
                { text: z.string().describe("Text for Scramble to say") },
                async (args) => {
                    try {
                        await execCommand("scramble_say", { text: args.text });
                        return mcpResult(`Scramble says: ${args.text}`);
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_scramble_pet",
                "Pet Scramble the cat",
                {},
                async () => {
                    try {
                        const result = await execCommand("scramble_pet");
                        return mcpResult(`Petted Scramble: ${result.result || 'purr'}`);
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_scramble_expand",
                "Toggle Scramble window size",
                {},
                async () => {
                    try {
                        await execCommand("scramble_expand");
                        return mcpResult("Scramble toggled");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            // ── Paint ──────────────────────────────────────────────────

            tool(
                "tui_new_paint_canvas",
                "Open a new paint canvas window",
                {},
                async () => {
                    try {
                        await execCommand("new_paint_canvas");
                        return mcpResult("Paint canvas opened");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            // ── Apps & Games ───────────────────────────────────────────

            tool(
                "tui_open_micropolis",
                "Open Micropolis (SimCity) ASCII view",
                {},
                async () => {
                    try {
                        await execCommand("open_micropolis_ascii");
                        return mcpResult("Micropolis opened");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_open_quadra",
                "Open the Quadra game",
                {},
                async () => {
                    try {
                        await execCommand("open_quadra");
                        return mcpResult("Quadra opened");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_open_snake",
                "Open the Snake game",
                {},
                async () => {
                    try {
                        await execCommand("open_snake");
                        return mcpResult("Snake opened");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_open_rogue",
                "Open the Rogue-like game",
                {},
                async () => {
                    try {
                        await execCommand("open_rogue");
                        return mcpResult("Rogue opened");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_open_deep_signal",
                "Open the Deep Signal window",
                {},
                async () => {
                    try {
                        await execCommand("open_deep_signal");
                        return mcpResult("Deep Signal opened");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_open_apps",
                "Open the apps launcher",
                {},
                async () => {
                    try {
                        await execCommand("open_apps");
                        return mcpResult("Apps launcher opened");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            // ── Chat ───────────────────────────────────────────────────

            tool(
                "tui_chat_receive",
                "Send a message to the chat window from an external source",
                {
                    sender: z.string().describe("Sender name"),
                    text: z.string().describe("Message text")
                },
                async (args) => {
                    try {
                        await execCommand("chat_receive", { sender: args.sender, text: args.text });
                        return mcpResult(`Chat message sent from ${args.sender}`);
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            // ── Workspace ──────────────────────────────────────────────

            tool(
                "tui_save_workspace",
                "Save current window layout (note: may show a dialog in TUI)",
                {},
                async () => {
                    try {
                        await execCommand("save_workspace");
                        return mcpResult("Workspace saved");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_open_workspace",
                "Load a saved workspace layout",
                { path: z.string().optional().describe("Path to workspace JSON file") },
                async (args) => {
                    try {
                        await execCommand("open_workspace", args.path ? { path: args.path } : {});
                        return mcpResult("Workspace loaded");
                    } catch (error) {
                        return mcpError(`Error: ${error.message}`);
                    }
                }
            )
        ]
    });
}

module.exports = {
    createTuiMcpServer,
    API_BASE_URL
};
