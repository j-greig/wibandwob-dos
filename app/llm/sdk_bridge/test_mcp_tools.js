#!/usr/bin/env node
/**
 * Unit tests for mcp_tools.js — terminal_write and terminal_read tools.
 *
 * AC coverage (issue #80, Node.js MCP bridge layer):
 *   - tui_terminal_write registered in tool list
 *   - tui_terminal_read registered in tool list
 *   - tui_terminal_write calls POST /menu/command with correct payload
 *   - tui_terminal_write with windowId passes window_id in args
 *   - tui_terminal_read calls GET /terminal/active/output when no windowId
 *   - tui_terminal_read calls GET /terminal/{windowId}/output when windowId given
 *   - tui_terminal_read returns text from response
 */

const assert = require('assert');

// --- Minimal mock of axios and SDK ---
const calls = [];

const fakeClient = {
    post: async (url, payload) => {
        calls.push({ method: 'POST', url, payload });
        return { data: { ok: true } };
    },
    get: async (url) => {
        calls.push({ method: 'GET', url });
        return { data: { text: 'HELLO_FROM_WIBWOB\n$ ', window_id: 'active' } };
    },
    interceptors: {
        response: { use: () => {} }
    }
};

// Stub axios before requiring mcp_tools
const Module = require('module');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
    if (request === 'axios') {
        return {
            create: () => fakeClient,
            interceptors: { response: { use: () => {} } }
        };
    }
    if (request === '@anthropic-ai/claude-agent-sdk') {
        return {
            createSdkMcpServer: (config) => config,
            tool: (name, desc, schema, fn) => ({ name, desc, schema, fn })
        };
    }
    if (request === 'zod') {
        const stub = () => stub;
        stub.optional = () => stub;
        stub.describe = () => stub;
        stub.int = () => stub;
        stub.default = () => stub;
        const z = { string: () => stub, enum: () => stub, number: () => stub,
                    record: () => stub, any: () => stub };
        return { z };
    }
    return originalLoad.apply(this, arguments);
};

const { createTuiMcpServer } = require('./mcp_tools');

async function run() {
    const server = createTuiMcpServer();
    const tools = server.tools;
    const toolMap = {};
    for (const t of tools) toolMap[t.name] = t;

    // AC: tools are registered
    assert(toolMap['tui_terminal_write'], 'tui_terminal_write must be registered');
    assert(toolMap['tui_terminal_read'], 'tui_terminal_read must be registered');

    // AC: tui_terminal_write calls POST /menu/command
    calls.length = 0;
    await toolMap['tui_terminal_write'].fn({ text: 'echo HELLO_FROM_WIBWOB\n' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].url, '/menu/command');
    assert.equal(calls[0].payload.command, 'terminal_write');
    assert.equal(calls[0].payload.args.text, 'echo HELLO_FROM_WIBWOB\n');
    assert(!calls[0].payload.args.window_id, 'window_id should not be set when omitted');

    // AC: tui_terminal_write with windowId passes window_id
    calls.length = 0;
    await toolMap['tui_terminal_write'].fn({ text: 'ls\n', windowId: 'win_3' });
    assert.equal(calls[0].payload.args.window_id, 'win_3');

    // AC: tui_terminal_read calls GET /terminal/active/output when no windowId
    calls.length = 0;
    const result = await toolMap['tui_terminal_read'].fn({});
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'GET');
    assert.equal(calls[0].url, '/terminal/active/output');
    assert(result.content[0].text.includes('HELLO_FROM_WIBWOB'), 'result must contain terminal text');

    // AC: tui_terminal_read with windowId calls correct URL
    calls.length = 0;
    await toolMap['tui_terminal_read'].fn({ windowId: 'win_5' });
    assert.equal(calls[0].url, '/terminal/win_5/output');

    console.log('PASS: tui_terminal_write and tui_terminal_read registered and dispatch correctly');
}

run().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
