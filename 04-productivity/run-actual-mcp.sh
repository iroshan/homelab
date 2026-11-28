#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/finance-bot.env"
DATA_DIR="${SCRIPT_DIR}/actual_mcp_data"
if [ -d "${HOME}/.nvm/versions/node/v22.23.5/bin" ]; then
  NODE_BIN="${HOME}/.nvm/versions/node/v22.23.5/bin"
else
  NODE_BIN="$(dirname "$(command -v node)")"
fi

mkdir -p "$DATA_DIR"
chmod 700 "$DATA_DIR"

# Parse .env literally without shell expansion (safe for passwords containing $)
while IFS= read -r line || [ -n "$line" ]; do
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  if [[ "$line" == *=* ]]; then
    key="${line%%=*}"
    val="${line#*=}"
    case "$key" in
      ACTUAL_PASSWORD|ACTUAL_SYNC_ID|ACTUAL_ENCRYPTION_PASSWORD)
        export "$key=$val"
        ;;
    esac
  fi
done < "$ENV_FILE"

export PATH="$NODE_BIN:$PATH"
export ACTUAL_SERVER_URL="http://127.0.0.1:5006"
export ACTUAL_BUDGET_SYNC_ID="${ACTUAL_SYNC_ID}"
if [ -n "${ACTUAL_ENCRYPTION_PASSWORD:-}" ]; then
  export ACTUAL_BUDGET_PASSWORD="${ACTUAL_ENCRYPTION_PASSWORD}"
  export ALLOW_INSECURE_UPSTREAM="true"
fi
export MCP_BRIDGE_DATA_DIR="$DATA_DIR"
export MCP_BRIDGE_LOG_LEVEL="error"

if [ $# -eq 0 ]; then
  exec "$NODE_BIN/actual-mcp-server" --stdio
else
  exec "$NODE_BIN/actual-mcp-server" "$@"
fi
