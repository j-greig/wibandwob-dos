/**
 * MCP Tools for TUI Application Control
 * 
 * Provides type-safe custom tools for Claude Code SDK that interface
 * with the TUI application's API server for programmatic control.
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

// Add response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.code === 'ECONNREFUSED') {
            throw new Error('API server not running. Please start the TUI application first.');
        }
        throw error;
    }
);

/**
 * Create MCP server with TUI control tools
 */
function createTuiMcpServer() {
    return createSdkMcpServer({
        name: "tui-control",
        version: "1.0.0",
        description: "Tools for controlling TUI application windows and layout",
        
        tools: [
            // Window Management Tools
            tool(
                "tui_create_window",
                "Create a new window in the TUI application",
                {
                    type: z.enum(["test_pattern", "gradient", "frame_player", "text_view", "text_editor"]).describe("Window type to create"),
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
                                x: args.x,
                                y: args.y,
                                w: args.width,
                                h: args.height
                            } : undefined,
                            props: args.props || {}
                        };
                        
                        const response = await apiClient.post('/windows', payload);
                        
                        // Log MCP tool usage for debugging
                        console.error(`MCP TOOL: tui_create_window called - created ${args.type} window ${response.data.id}`);
                        
                        return {
                            content: [{
                                type: "text",
                                text: `✨ MCP: Created ${args.type} window: ${response.data.id}\nTitle: ${response.data.title}\nPosition: (${response.data.rect.x}, ${response.data.rect.y})\nSize: ${response.data.rect.w}x${response.data.rect.h}`
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: "text",
                                text: `Error creating window: ${error.message}`
                            }],
                            isError: true
                        };
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
                        
                        console.error(`MCP TOOL: tui_move_window called - moved window ${args.windowId}`);
                        
                        return {
                            content: [{
                                type: "text", 
                                text: `✨ MCP: Moved window ${args.windowId} to position (${response.data.rect.x}, ${response.data.rect.y}), size ${response.data.rect.w}x${response.data.rect.h}`
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: "text",
                                text: `Error moving window: ${error.message}`
                            }],
                            isError: true
                        };
                    }
                }
            ),

            tool(
                "tui_get_state",
                "Get current state of TUI application including all windows and canvas size",
                {},
                async (args) => {
                    try {
                        const response = await apiClient.get('/state');
                        const state = response.data;
                        
                        console.error(`MCP TOOL: tui_get_state called - found ${state.windows.length} windows`);
                        
                        const windowList = state.windows.map(w => 
                            `- ${w.id}: ${w.type} "${w.title}" at (${w.rect.x},${w.rect.y}) ${w.rect.w}x${w.rect.h}${w.focused ? ' [FOCUSED]' : ''}`
                        ).join('\n');
                        
                        return {
                            content: [{
                                type: "text",
                                text: `✨ MCP: TUI Application State:\n\nCanvas: ${state.canvas.width}x${state.canvas.height} (${state.canvas.cols}x${state.canvas.rows})\nPattern Mode: ${state.pattern_mode}\nUptime: ${Math.floor(state.uptime_sec)}s\n\nWindows (${state.windows.length}):\n${windowList || '(no windows)'}`
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: "text",
                                text: `Error getting TUI state: ${error.message}`
                            }],
                            isError: true
                        };
                    }
                }
            ),

            tool(
                "tui_close_window",
                "Close a specific window",
                {
                    windowId: z.string().describe("ID of the window to close")
                },
                async (args) => {
                    try {
                        await apiClient.post(`/windows/${args.windowId}/close`);
                        return {
                            content: [{
                                type: "text",
                                text: `Closed window ${args.windowId}`
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: "text", 
                                text: `Error closing window: ${error.message}`
                            }],
                            isError: true
                        };
                    }
                }
            ),

            tool(
                "tui_cascade_windows",
                "Arrange all windows in cascade layout", 
                {},
                async (args) => {
                    try {
                        await apiClient.post('/windows/cascade');
                        return {
                            content: [{
                                type: "text",
                                text: "Windows arranged in cascade layout"
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: "text",
                                text: `Error cascading windows: ${error.message}`
                            }],
                            isError: true
                        };
                    }
                }
            ),

            tool(
                "tui_tile_windows", 
                "Arrange all windows in tiled layout",
                {
                    columns: z.number().int().optional().describe("Number of columns for tiling")
                },
                async (args) => {
                    try {
                        const payload = args.columns ? { cols: args.columns } : {};
                        await apiClient.post('/windows/tile', payload);
                        return {
                            content: [{
                                type: "text",
                                text: `Windows arranged in tiled layout${args.columns ? ` with ${args.columns} columns` : ''}`
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: "text",
                                text: `Error tiling windows: ${error.message}`
                            }],
                            isError: true
                        };
                    }
                }
            ),

            tool(
                "tui_send_text",
                "Send text to a text editor window",
                {
                    windowId: z.string().optional().describe("ID of text editor window (if not provided, creates one)"),
                    content: z.string().describe("Text content to send"),
                    mode: z.enum(["append", "replace", "insert"]).default("append").describe("How to insert the text")
                },
                async (args) => {
                    try {
                        const endpoint = args.windowId ? 
                            `/windows/${args.windowId}/send_text` : 
                            '/text_editor/send_text';
                        
                        const payload = {
                            content: args.content,
                            mode: args.mode
                        };
                        
                        await apiClient.post(endpoint, payload);
                        return {
                            content: [{
                                type: "text",
                                text: `Text sent to ${args.windowId || 'auto-created'} text editor window (${args.mode} mode)`
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: "text",
                                text: `Error sending text: ${error.message}`
                            }],
                            isError: true
                        };
                    }
                }
            ),

            tool(
                "tui_send_figlet",
                "Send ASCII art text using figlet to a text editor window",
                {
                    text: z.string().describe("Text to convert to ASCII art"),
                    font: z.string().default("standard").describe("Figlet font name"),
                    windowId: z.string().optional().describe("ID of text editor window (if not provided, creates one)")
                },
                async (args) => {
                    try {
                        const endpoint = args.windowId ?
                            `/windows/${args.windowId}/send_figlet` :
                            '/text_editor/send_figlet';
                        
                        const payload = {
                            text: args.text,
                            font: args.font
                        };
                        
                        await apiClient.post(endpoint, payload);
                        return {
                            content: [{
                                type: "text",
                                text: `ASCII art "${args.text}" (${args.font} font) sent to ${args.windowId || 'auto-created'} text editor window`
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: "text",
                                text: `Error sending figlet: ${error.message}`
                            }],
                            isError: true
                        };
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
