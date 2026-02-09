#!/usr/bin/env node
/**
 * SDK Smoke Test - Minimal test of Claude Code SDK
 * Run: node smoke_test.js
 */

const { query } = require('@anthropic-ai/claude-agent-sdk');

async function main() {
    console.log('=== Claude Code SDK Smoke Test ===');
    console.log('Time:', new Date().toISOString());

    // Check environment
    console.log('\n--- Environment ---');
    console.log('ANTHROPIC_API_KEY set:', !!process.env.ANTHROPIC_API_KEY);
    console.log('Key prefix:', process.env.ANTHROPIC_API_KEY?.substring(0, 10) + '...');

    // Simple message generator
    async function* messageGenerator() {
        yield {
            type: "user",
            message: {
                role: "user",
                content: "Say hello in exactly 5 words."
            }
        };
    }

    console.log('\n--- Sending Query ---');
    console.log('Prompt: "Say hello in exactly 5 words."');
    console.log('Model: sonnet');

    let messageCount = 0;
    let fullResponse = '';

    try {
        for await (const message of query({
            prompt: messageGenerator(),  // Call the generator!
            options: {
                customSystemPrompt: "You are a helpful assistant. Be brief.",
                maxTurns: 1,
                allowedTools: [],  // No tools for simple test
                model: 'sonnet'
            }
        })) {
            messageCount++;
            console.log('\n--- Message', messageCount, '---');
            console.log('Type:', message.type);
            console.log('Full message:', JSON.stringify(message, null, 2));

            if (message.type === 'assistant') {
                fullResponse += message.message.content;
                console.log('Content:', message.message.content);
            } else if (message.type === 'result') {
                console.log('Result:', message.result);
                if (message.error) {
                    console.log('Error:', message.error);
                }
            }
        }

        console.log('\n--- Summary ---');
        console.log('Total messages:', messageCount);
        console.log('Full response:', fullResponse || '(empty)');
        console.log('Test:', fullResponse ? 'PASSED' : 'FAILED - no response');

    } catch (error) {
        console.error('\n--- ERROR ---');
        console.error('Error type:', error.constructor.name);
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Load .env from repo root if running from sdk_bridge dir
const path = require('path');
const fs = require('fs');

const envPaths = [
    path.join(__dirname, '../../../.env'),  // repo root from sdk_bridge
    path.join(__dirname, '../../.env'),
    path.join(process.cwd(), '.env')
];

for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        console.log('Loading .env from:', envPath);
        require('dotenv').config({ path: envPath });
        break;
    }
}

main().catch(console.error);
