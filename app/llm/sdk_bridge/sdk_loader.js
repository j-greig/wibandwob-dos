/**
 * SDK loader for the Agent SDK (@anthropic-ai/claude-agent-sdk).
 * Returns a query function and source label for diagnostics.
 */

function loadSdk() {
    let pkg = null;
    let source = null;

    try {
        pkg = require('@anthropic-ai/claude-agent-sdk');
        source = 'claude-agent-sdk';
    } catch (_) {
        // ignore
    }

    if (!pkg) {
        throw new Error('No Claude SDK found. Install @anthropic-ai/claude-agent-sdk.');
    }

    // The agent SDK exposes query(); if this changes, guard here.
    const queryFn = pkg.query;
    if (typeof queryFn !== 'function') {
        throw new Error(`Loaded SDK (${source}) does not expose a query() function`);
    }

    return { query: queryFn, source };
}

module.exports = {
    loadSdk,
};
