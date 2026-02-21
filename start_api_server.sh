#!/bin/bash
# Start the TUI Control API server for programmatic window management
# This enables MCP integration for Claude Code and other AI tools

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${WIBWOB_API_PORT:-8089}"

# Kill any stale server on this port
STALE_PID=$(lsof -ti :"$PORT" 2>/dev/null || true)
if [ -n "$STALE_PID" ]; then
    echo "🧹 Killing stale process on port $PORT (PID: $STALE_PID)"
    kill $STALE_PID 2>/dev/null || true
    sleep 1
fi

echo "🚀 Starting TUI Control API Server"
echo "   Port: $PORT"
echo "   MCP Endpoint: http://127.0.0.1:$PORT/mcp"
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
WIBWOB_REPO_ROOT="$SCRIPT_DIR" ./tools/api_server/venv/bin/python -m tools.api_server.main --port="$PORT"
