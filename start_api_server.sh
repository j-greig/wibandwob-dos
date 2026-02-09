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
    source venv/bin/activate
    pip install -q -r requirements.txt
    cd ../..
    echo "✅ Dependencies installed"
fi

# Run the server
echo "🔌 Server starting (Ctrl+C to stop)"
echo ""
./tools/api_server/venv/bin/python -m tools.api_server.main --port=8089
