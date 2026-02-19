#!/bin/bash
# Start the TUI Control API server for programmatic window management
# This enables MCP integration for Claude Code and other AI tools

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting TUI Control API Server"
echo "   Port: 8089"
echo "   MCP Endpoint: http://127.0.0.1:8089/mcp"
echo ""

# Check if venv exists
if [ ! -d "tools/api_server/venv" ]; then
    echo "📦 Virtual environment not found. Creating..."
    cd tools/api_server
    python3 -m venv venv
    cd ../..
fi

echo "📦 Ensuring API server dependencies are installed..."
./tools/api_server/venv/bin/pip install -q -r tools/api_server/requirements.txt
echo "✅ Dependencies ready"

# Run the server
echo "🔌 Server starting (Ctrl+C to stop)"
echo ""
WIBWOB_REPO_ROOT="$SCRIPT_DIR" ./tools/api_server/venv/bin/python -m tools.api_server.main --port=8089
