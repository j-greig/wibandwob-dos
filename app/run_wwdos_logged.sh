#!/bin/bash
# Run wwdos with debug logging to file + live tail capability
#
# Usage:
#   cd app && ./run_wwdos_logged.sh         # Run with logging
#   tail -f app/logs/wwdos_*.log            # Watch logs live (separate terminal)
#
# Debug logs written to: app/logs/wwdos_<timestamp>.log
# On quit, logs will also appear in terminal

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BINARY="../build/app/wwdos"
if [[ ! -f "$BINARY" ]]; then
    # Fallback: check local build dir (if built from app/)
    BINARY="build/wwdos"
fi

if [[ ! -f "$BINARY" ]]; then
    echo "❌ Error: wwdos binary not found"
    echo "   Build first: cmake . -B ./build && cmake --build ./build --target wwdos"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Generate timestamped log filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="logs/wwdos_${TIMESTAMP}.log"

echo "🚀 Starting wwdos with debug logging"
echo "   Working dir: $(pwd)"
echo "   Debug log: $LOG_FILE"
echo "   Tip: Run 'tail -f $LOG_FILE' in another terminal to watch live"
echo ""

# Run with stderr redirected to log file AND still visible on quit
$BINARY 2> >(tee "$LOG_FILE" >&2)
