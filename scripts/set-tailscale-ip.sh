#!/usr/bin/env bash
# =============================================================================
# Set TAILSCALE_IP across homelab .env files
# =============================================================================
# Usage:
#   ./scripts/set-tailscale-ip.sh                  # Auto-detect via tailscale ip -4
#   ./scripts/set-tailscale-ip.sh 100.x.y.z        # Set explicit IP
# =============================================================================

set -euo pipefail

HOMELAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TS_IP="${1:-}"

if [ -z "${TS_IP}" ]; then
    if command -v tailscale >/dev/null 2>&1; then
        TS_IP="$(tailscale ip -4 2>/dev/null | head -n 1 || true)"
    fi
fi

if [ -z "${TS_IP}" ]; then
    echo "⚠️  Could not detect a Tailscale IPv4 address."
    echo "    Either connect Tailscale first ('sudo tailscale up') or pass an IP explicitly:"
    echo "    $0 100.x.y.z"
    echo "    Falling back to 127.0.0.2 (localhost-only, stacks will still start)."
    TS_IP="127.0.0.2"
fi

update_env_var() {
    local env_file="$1"
    local key="TAILSCALE_IP"
    local val="$2"

    touch "$env_file"
    if grep -qE "^${key}=" "$env_file"; then
        sed -i "s|^${key}=.*|${key}=${val}|" "$env_file"
    else
        printf "\n# Auto-managed by scripts/set-tailscale-ip.sh\n%s=%s\n" "$key" "$val" >> "$env_file"
    fi
    echo "✅ Updated ${env_file}: ${key}=${val}"
}

update_env_var "${HOMELAB_DIR}/02-network-access/.env" "${TS_IP}"
update_env_var "${HOMELAB_DIR}/04-productivity/.env" "${TS_IP}"
