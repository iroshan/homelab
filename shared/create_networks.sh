#!/usr/bin/env bash
# =============================================================================
# Create all external Docker networks used by the homelab stacks
# =============================================================================
set -euo pipefail

ensure_net() {
    local name="$1"
    shift
    if docker network inspect "$name" >/dev/null 2>&1; then
        echo "✓ Network already exists: $name"
    else
        docker network create "$@" "$name" >/dev/null
        echo "✅ Created network: $name"
    fi
}

# Core Infrastructure (Internal, Static Subnet)
ensure_net infrastructure_net --driver bridge --internal --subnet=172.18.0.0/24

# Public / reverse proxy
ensure_net proxy_net --driver bridge

# Application stack networks
ensure_net monitoring_net --driver bridge
ensure_net productivity_net --driver bridge
ensure_net finance_net --driver bridge
ensure_net pkm_net --driver bridge
ensure_net knowledge_net --driver bridge
ensure_net docs_net --driver bridge
ensure_net media_net --driver bridge
ensure_net documents_net --driver bridge
ensure_net utilities_net --driver bridge
ensure_net communication_net --driver bridge
ensure_net backup_net --driver bridge
ensure_net security_net --driver bridge

echo "All homelab Docker networks are ready."
