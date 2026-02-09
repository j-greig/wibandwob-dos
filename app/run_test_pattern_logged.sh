#!/bin/bash
# Run test_pattern with debug logging to file + live tail capability
#
# Usage:
#   cd test-tui && ./run_test_pattern_logged.sh    # Run with logging
#   tail -f test-tui/test_pattern_debug.log        # Watch logs live (separate terminal)
#
# IMPORTANT: Must be run from test-tui directory (where .env and wibandwob.prompt.md are located)
#
# Debug logs written to: test_pattern_debug.log
# On quit, logs will also appear in terminal

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check we're in the right directory
if [[ ! -f "wibandwob.prompt.md" ]] || [[ ! -f "../.env" ]]; then
    echo "❌ Error: Must run from test-tui directory"
    echo "   Usage: cd test-tui && ./run_test_pattern_logged.sh"
    exit 1
fi

if [[ ! -f "build/test_pattern" ]]; then
    echo "❌ Error: build/test_pattern not found"
    echo "   Build first: cmake . -B ./build && cmake --build ./build"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Generate timestamped log filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="logs/test_pattern_${TIMESTAMP}.log"

echo "🚀 Starting test_pattern with debug logging"
echo "   Working dir: $(pwd)"
echo "   Debug log: $LOG_FILE"
echo "   Tip: Run 'tail -f $LOG_FILE' in another terminal to watch live"
echo ""

# Run with stderr redirected to log file AND still visible on quit
# The process substitution ensures logs are written immediately to file
# while still being available in terminal when app exits
./build/test_pattern 2> >(tee "$LOG_FILE" >&2)
