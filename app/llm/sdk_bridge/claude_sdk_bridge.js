#!/usr/bin/env node
/**
 * Claude Code SDK Bridge for C++ TUI Applications
 * 
 * Provides streaming interface between C++ and Claude Code SDK
 * Supports customSystemPrompt and real-time response streaming
 */

const process = require('process');
const readline = require('readline');
const { createTuiMcpServer } = require('./mcp_tools');
const { loadSdk } = require('./sdk_loader');

class ClaudeSDKBridge {
    constructor() {
        this.activeSession = null;
        this.sessionId = null;           // Our internal session ID
        this.sdkSessionId = null;        // SDK session ID for resume
        this.systemPrompt = null;        // Agent SDK uses 'systemPrompt' not 'customSystemPrompt'
        // this.allowedTools = ['Read', 'Write', 'Grep', 'Bash', 'LS', 'WebSearch', 'WebFetch'];
        this.allowedTools = ['Read', 'Write', 'Grep', 'WebSearch', 'WebFetch'];
        this.maxTurns = 50;
        this.sdkSource = 'unknown';
        this.queryFn = null;
        this.enableMcpServer = true; // MCP server is the primary tool path

        try {
            const sdk = loadSdk();
            this.queryFn = sdk.query;
            this.sdkSource = sdk.source;
            console.error('🔧 Loaded SDK:', this.sdkSource);
        } catch (err) {
            console.error('💥 SDK load failed:', err.message);
        }
        
        // Always initialize MCP server (primary tool path)
        try {
            console.error('🔧 Creating MCP server...');
            this.mcpServer = createTuiMcpServer();
            console.error('🔧 MCP server created successfully');
            console.error('🔧 MCP server name:', this.mcpServer.name);
            console.error('🔧 MCP server object keys:', Object.keys(this.mcpServer));
            console.error('🔧 MCP server tools property:', typeof this.mcpServer.tools);
            console.error('🔧 MCP server tools count:', this.mcpServer.tools ? Object.keys(this.mcpServer.tools).length : 'NO TOOLS');
            if (this.mcpServer.tools) {
                console.error('🔧 Tool names:', Object.keys(this.mcpServer.tools));
            }
        } catch (error) {
            console.error('💥 MCP server creation FAILED:', error.message);
            console.error('💥 Stack:', error.stack);
            this.mcpServer = null;
        }
        
        this.setupInputHandler();
        this.sendResponse('BRIDGE_READY', { version: '1.0.0', mcpTools: 'enabled' });
        
        // MASSIVE DEBUG: Log bridge startup
        console.error('🚀 BRIDGE STARTED - PID:', process.pid);
        console.error('🚀 MCP Server Created:', !!this.mcpServer);
    }
    
    setupInputHandler() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false
        });
        
        rl.on('line', (line) => {
            console.error('🔥 BRIDGE INPUT RECEIVED:', line);
            
            // Only process lines that look like JSON commands
            const trimmed = line.trim();
            if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
                console.error('🔥 SKIPPING NON-JSON LINE:', trimmed.substring(0, 50) + '...');
                return;
            }
            
            try {
                const command = JSON.parse(trimmed);
                if (command.type) {
                    console.error('🔥 PARSED COMMAND:', command.type);
                    this.handleCommand(command);
                } else {
                    console.error('🔥 SKIPPING JSON WITHOUT TYPE:', command);
                }
            } catch (error) {
                console.error('🔥 PARSE ERROR:', error.message);
                // Don't send error for non-JSON lines, just ignore them
            }
        });
        
        rl.on('close', () => {
            this.cleanup();
            process.exit(0);
        });
    }
    
    async handleCommand(command) {
        try {
            switch (command.type) {
                case 'START_SESSION':
                    await this.startSession(command.data);
                    break;
                    
                case 'SEND_QUERY':
                    await this.sendQuery(command.data);
                    break;
                    
                case 'UPDATE_PROMPT':
                    await this.updateSystemPrompt(command.data);
                    break;
                    
                case 'END_SESSION':
                    await this.endSession();
                    break;
                    
                case 'CONFIGURE':
                    this.configure(command.data);
                    break;
                    
                default:
                    this.sendError('UNKNOWN_COMMAND', `Unknown command type: ${command.type}`);
            }
        } catch (error) {
            this.sendError('COMMAND_ERROR', error.message);
        }
    }
    
    async startSession(data) {
        try {
            // Agent SDK uses 'systemPrompt' - accept both for backwards compat
            this.systemPrompt = data.systemPrompt || data.customSystemPrompt;
            this.sessionId = this.generateSessionId();
            this.sdkSessionId = null;  // Reset SDK session on new session

            console.error('DEBUG: Starting session with systemPrompt length:', this.systemPrompt?.length || 0);

            // Store session configuration
            this.sessionConfig = {
                systemPrompt: this.systemPrompt,
                maxTurns: data.maxTurns || this.maxTurns,
                allowedTools: data.allowedTools || this.allowedTools,
                model: data.model || 'claude-haiku-4-5'  // Default to haiku 4.5 if not specified
            };

            this.sendResponse('SESSION_STARTED', {
                sessionId: this.sessionId,
                systemPrompt: this.systemPrompt,
                configuration: this.sessionConfig
            });

            console.error('DEBUG: Session started with model:', this.sessionConfig.model);

        } catch (error) {
            this.sendError('SESSION_START_ERROR', error.message);
        }
    }
    
    async sendQuery(data) {
        if (!this.sessionId) {
            this.sendError('NO_SESSION', 'No active session. Call START_SESSION first.');
            return;
        }
        
        try {
            // MASSIVE DEBUG: Log everything about this request
            console.error('=== BRIDGE DEBUG: sendQuery called ===');
            console.error('Query:', data.query);
            console.error('Query contains "window":', data.query.toLowerCase().includes('window'));
            console.error('Query contains "create":', data.query.toLowerCase().includes('create'));
            console.error('Session ID:', this.sessionId);
            console.error('Allowed Tools:', this.sessionConfig.allowedTools);
            console.error('MCP Server initialized:', !!this.mcpServer);
            console.error('=== END BRIDGE DEBUG ===');
            
            // Build Agent SDK messages stream. System prompt is passed via options, so only send user content.
            const messages = [{
                role: 'user',
                content: [{ type: 'text', text: data.query }]
            }];

            // Start streaming query
            this.sendResponse('QUERY_STARTED', { 
                sessionId: this.sessionId,
                query: data.query 
            });
            let fullResponse = '';
            let finishReason = null;
            
            // Use Claude Agent SDK with proper messages + MCP tools
            console.error('DEBUG: About to query with model:', this.sessionConfig.model);
            console.error('DEBUG: MCP server initialized:', !!this.mcpServer);
            
            // Build allowed tools list including MCP tool IDs
            const baseTools = this.sessionConfig.allowedTools || [];
            const mcpTools = [
                "mcp__tui-control__tui_create_window",
                "mcp__tui-control__tui_move_window", 
                "mcp__tui-control__tui_get_state",
                "mcp__tui-control__tui_close_window",
                "mcp__tui-control__tui_cascade_windows",
                "mcp__tui-control__tui_tile_windows",
                "mcp__tui-control__tui_send_text",
                "mcp__tui-control__tui_send_figlet"
            ];
            const toolList = [...new Set([...baseTools, ...mcpTools])];
            const modelId = this.normalizeModelId(this.sessionConfig.model);

            const queryOptions = {
                systemPrompt: this.systemPrompt,
                maxTurns: this.sessionConfig.maxTurns,
                model: modelId,
                allowedTools: toolList,
                includePartialMessages: true,  // Enable partial events
                stderr: (msg) => console.error('[CLAUDE STDERR]', String(msg).trim())
            };

            // Add resume option if we have a previous SDK session ID (multi-turn)
            if (this.sdkSessionId) {
                queryOptions.resume = this.sdkSessionId;
                console.error('[BRIDGE] Resuming session:', this.sdkSessionId);
            }

            // Only add MCP servers if server was successfully created
            if (this.mcpServer) {
                queryOptions.mcpServers = { "tui-control": this.mcpServer };
            }

            console.error('[BRIDGE] Query options:', JSON.stringify({
                ...queryOptions,
                systemPrompt: this.systemPrompt ? this.systemPrompt.substring(0, 50) + '...' : undefined
            }));
            console.error('[BRIDGE] About to call SDK query() using', this.sdkSource, '...');
            console.error('[BRIDGE] Allowed tools list:', toolList);

            // Helper to emit deltas and accumulate full response
            const pushDelta = (text) => {
                if (!text) return;
                this.sendResponse('CONTENT_DELTA', {
                    sessionId: this.sessionId,
                    content: text,
                    isPartial: true
                });
                fullResponse += text;
            };

            const textFromContentArray = (contentArray) => {
                if (!Array.isArray(contentArray)) {
                    return typeof contentArray === 'string' ? contentArray : '';
                }
                let text = '';
                for (const block of contentArray) {
                    if (block?.type === 'text' && typeof block.text === 'string') {
                        text += block.text;
                    }
                }
                return text;
            };

            let messageCount = 0;
            try {
                if (!this.queryFn) {
                    throw new Error('SDK query function not loaded');
                }

                const promptStream = this.buildPromptStream(messages);

                for await (const message of this.queryFn({
                    prompt: promptStream,
                    options: queryOptions
                })) {
                    messageCount++;
                    console.error('=== SDK MESSAGE DEBUG #' + messageCount + ' ===');
                    console.error('Message type:', message.type);
                    console.error('Message data:', JSON.stringify(message, null, 2));
                    console.error('=== END SDK MESSAGE DEBUG ===');

                    // Legacy partials (Agent SDK still emits these when includePartialMessages is true)
                    if (message.type === 'partial_assistant') {
                        pushDelta(message.delta?.text || message.delta?.partial_text || '');

                    } else if (message.type === 'assistant') {
                        const textContent = textFromContentArray(message.message?.content);
                        if (textContent && !fullResponse) {
                            pushDelta(textContent);
                        }

                    // Rich stream events from Agent SDK (content/message start/delta/stop)
                    } else if (message.type === 'content_block_delta') {
                        pushDelta(message.delta?.text || message.delta?.partial_text || '');

                    } else if (message.type === 'message_delta') {
                        pushDelta(message.delta?.text || message.delta?.partial_text || '');

                    } else if (message.type === 'content_block_start') {
                        // Some SDKs include initial text on start; include if present
                        pushDelta(message.content_block?.text || '');

                    } else if (message.type === 'message_stop' || message.type === 'content_block_stop') {
                        const fr = message.finish_reason || message.finishReason || message.reason;
                        finishReason = fr || finishReason;

                    } else if (message.type === 'result') {
                        // SDKResultMessage - capture session_id for multi-turn resume
                        console.error('[BRIDGE] Result message:', message.subtype, 'result:',
                                      typeof message.result === 'string' ? message.result.substring(0, 100) : message.result);

                        if (message.session_id) {
                            this.sdkSessionId = message.session_id;
                            console.error('[BRIDGE] Captured SDK session_id:', this.sdkSessionId);
                        }

                        if (message.result === 'error_max_turns') {
                            this.sendResponse('ERROR_OCCURRED', {
                                sessionId: this.sessionId,
                                error: 'MAX_TURNS_EXCEEDED',
                                message: 'Conversation turn limit reached'
                            });
                            return;
                        } else if (message.result === 'error_during_execution') {
                            this.sendResponse('ERROR_OCCURRED', {
                                sessionId: this.sessionId,
                                error: 'EXECUTION_ERROR',
                                message: message.error?.message || 'Unknown execution error'
                            });
                            return;
                        } else if (message.subtype === 'success' && typeof message.result === 'string') {
                            if (message.result && !fullResponse) {
                                fullResponse = message.result;
                            }
                        }

                    } else if (message.type === 'stream_event') {
                        // Legacy stream event handling (fallback)
                        const evt = message.event;
                        const deltaText = evt?.delta?.text || evt?.delta?.partial_text || '';
                        const isTextDelta = evt && (evt.type === 'content_block_delta' || evt.type === 'message_delta');
                        if (isTextDelta && deltaText) {
                            pushDelta(deltaText);
                        }
                    }
                } // close for await loop
                console.error('[BRIDGE] SDK loop complete. Messages:', messageCount, 'Response length:', fullResponse.length);
            } catch (sdkError) {
                console.error('[BRIDGE] SDK query() ERROR:', sdkError.message);
                console.error('[BRIDGE] SDK error stack:', sdkError.stack);
                this.sendError('SDK_ERROR', sdkError.message);
                return;
            }

            // Send completion
            console.error('[BRIDGE] Sending MESSAGE_COMPLETE with', fullResponse.length, 'chars');
            this.sendResponse('MESSAGE_COMPLETE', {
                sessionId: this.sessionId,
                fullResponse: fullResponse,
                finishReason: finishReason || 'unknown',
                isPartial: false
            });

        } catch (error) {
            console.error('[BRIDGE] Outer catch ERROR:', error.message);
            this.sendError('QUERY_ERROR', error.message);
        }
    }
    
    async* createMessageGenerator(userQuery) {
        yield {
            type: "user",
            message: {
                role: "user",
                content: userQuery
            }
        };
    }

    async* buildPromptStream(messages) {
        if (!Array.isArray(messages)) return;
        for (const msg of messages) {
            const role = msg.role || 'user';
            if (role === 'system') {
                console.error('[BRIDGE] Skipping system role in prompt stream; system prompt is sent via options.');
                continue;
            }
            const content = msg.content || [];
            yield {
                type: role === 'assistant' ? 'assistant' : 'user',
                session_id: "",
                message: {
                    role,
                    content
                },
                parent_tool_use_id: null
            };
        }
    }
    
    async updateSystemPrompt(data) {
        // Accept both old and new names for backwards compat
        this.systemPrompt = data.systemPrompt || data.customSystemPrompt;
        if (this.sessionConfig) {
            this.sessionConfig.systemPrompt = this.systemPrompt;
        }

        this.sendResponse('PROMPT_UPDATED', {
            sessionId: this.sessionId,
            systemPrompt: this.systemPrompt
        });
    }

    async endSession() {
        const oldSessionId = this.sessionId;
        const oldSdkSessionId = this.sdkSessionId;

        this.sessionId = null;
        this.sdkSessionId = null;
        this.systemPrompt = null;
        this.sessionConfig = null;

        this.sendResponse('SESSION_ENDED', {
            sessionId: oldSessionId,
            sdkSessionId: oldSdkSessionId
        });
    }
    
    configure(data) {
        if (data.allowedTools) {
            this.allowedTools = data.allowedTools;
        }
        if (data.maxTurns) {
            this.maxTurns = data.maxTurns;
        }
        
        this.sendResponse('CONFIGURED', {
            allowedTools: this.allowedTools,
            maxTurns: this.maxTurns
        });
    }
    
    normalizeModelId(model) {
        const m = (model || '').toLowerCase();
        // Map common aliases to current 4.5 IDs (avoid 3.5)
        if (m.includes('opus')) return 'claude-opus-4-5';
        if (m.includes('sonnet')) return 'claude-sonnet-4-5';
        if (m.includes('haiku')) return 'claude-haiku-4-5';
        return model || 'claude-haiku-4-5';
    }
    
    
    generateSessionId() {
        return 'wib_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    sendResponse(type, data) {
        const response = {
            type: type,
            data: data,
            timestamp: Date.now()
        };
        
        console.log(JSON.stringify(response));
    }
    
    sendError(errorType, message) {
        this.sendResponse('ERROR', {
            errorType: errorType,
            message: message
        });
    }
    
    cleanup() {
        if (this.sessionId) {
            this.endSession();
        }
    }
}

// Handle process termination
process.on('SIGINT', () => {
    process.exit(0);
});

process.on('SIGTERM', () => {
    process.exit(0);
});

// Start the bridge
new ClaudeSDKBridge();
