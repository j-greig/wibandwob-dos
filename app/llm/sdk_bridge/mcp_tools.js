/**
 * MCP Tools for TUI Application Control (SDK Bridge)
 *
 * ARCHITECTURE:
 *   Two tools. That's it.
 *   - tui_list_commands: discovers all available commands from the C++ registry
 *   - tui_menu_command: executes any command by name with args
 *
 *   New C++ commands are instantly available. Never touch this file.
 */

const { createSdkMcpServer, tool } = require('@anthropic-ai/claude-agent-sdk');
const { z } = require('zod');
const axios = require('axios');

const API_BASE_URL = 'http://127.0.0.1:8089';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 5000,
    headers: { 'Content-Type': 'application/json' }
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

function mcpResult(text) {
    return { content: [{ type: "text", text }] };
}
function mcpError(text) {
    return { content: [{ type: "text", text }], isError: true };
}

function createTuiMcpServer() {
    return createSdkMcpServer({
        name: "tui-control",
        version: "3.0.0",
        description: "Two tools to discover and execute any TUI command",

        tools: [
            tool(
                "tui_list_commands",
                "Discover ALL available TUI commands with descriptions and parameter hints. Call this FIRST to see what you can do, then use tui_menu_command to execute any command by name. Returns the full live C++ command registry.",
                {},
                async () => {
                    try {
                        const response = await apiClient.get('/commands');
                        return mcpResult(JSON.stringify(response.data, null, 2));
                    } catch (error) {
                        return mcpError(`Error listing commands: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_menu_command",
                "Execute any TUI command by name. Use tui_list_commands first to discover available commands. Covers everything: window management (cascade, tile, close_all), apps (open_gallery, open_terminal, open_scramble), text (send_text, send_figlet), paint canvas, screenshots, themes, and more. For resize_window: pass aspect param (16:9, 4:3, square, portrait, golden, A4, or W:H) with w or h to auto-compute proportions.",
                {
                    command: z.string().describe("Command name from tui_list_commands"),
                    args: z.record(z.string()).optional().describe("Command arguments as key-value pairs")
                },
                async (params) => {
                    try {
                        const payload = { command: params.command };
                        if (params.args && Object.keys(params.args).length > 0) {
                            payload.args = params.args;
                        }
                        const response = await apiClient.post('/menu/command', payload);
                        return mcpResult(JSON.stringify(response.data, null, 2));
                    } catch (error) {
                        const detail = error.response?.data?.detail || error.message;
                        return mcpError(`Command '${params.command}' failed: ${detail}`);
                    }
                }
            ),

            tool(
                "tui_get_state",
                "Get the current desktop state: all open windows with id/type/rect/z-order, desktop dimensions (w, h, cell_aspect for layout maths), theme, and pattern mode. Use this to plan window arrangements before moving/resizing.",
                {},
                async () => {
                    try {
                        const response = await apiClient.get('/state');
                        return mcpResult(JSON.stringify(response.data, null, 2));
                    } catch (error) {
                        return mcpError(`Error getting state: ${error.message}`);
                    }
                }
            ),

            tool(
                "tui_batch_layout",
                "Move, resize, create, or close multiple windows in a single call. Much faster than individual commands for arranging many windows. Each op: {op: 'move_resize', window_id, bounds: {x,y,w,h}} or {op: 'create', view_type, bounds: {x,y,w,h}} or {op: 'close', window_id}. Also supports macro.create_grid for spawning N windows in a grid pattern.",
                {
                    request_id: z.string().describe("Unique ID for idempotency"),
                    ops: z.array(z.object({
                        op: z.enum(["create", "move_resize", "close"]).describe("Operation type"),
                        window_id: z.string().optional().describe("Target window ID (for move_resize/close)"),
                        view_type: z.string().optional().describe("Window type to create (for create op)"),
                        bounds: z.object({
                            x: z.number().describe("X position"),
                            y: z.number().describe("Y position"),
                            w: z.number().describe("Width in cells"),
                            h: z.number().describe("Height in cells")
                        }).optional().describe("Position and size")
                    })).describe("Array of operations to execute atomically"),
                    dry_run: z.boolean().optional().describe("If true, validate but don't apply")
                },
                async (params) => {
                    try {
                        const response = await apiClient.post('/windows/batch_layout', params);
                        return mcpResult(JSON.stringify(response.data, null, 2));
                    } catch (error) {
                        const detail = error.response?.data?.detail || error.message;
                        return mcpError(`Batch layout failed: ${detail}`);
                    }
                }
            ),
        ]
    });
}

module.exports = {
    createTuiMcpServer,
    API_BASE_URL
};
