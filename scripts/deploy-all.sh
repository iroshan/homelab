#!/usr/bin/env bash
# =============================================================================
# Homelab Deployment Script
# =============================================================================
# Usage:
#   ./scripts/deploy-all.sh                  # Deploy all active stacks in order
#   ./scripts/deploy-all.sh --build          # Build local images (needed on fresh server)
#   ./scripts/deploy-all.sh --pull           # Pull latest registry images first
#   ./scripts/deploy-all.sh --force-recreate # Force recreate containers
#   ./scripts/deploy-all.sh --skip-backup    # Skip 10-backup (e.g. during DR)
#   ./scripts/deploy-all.sh --stack 05-pkm   # Deploy a single stack
#   ./scripts/deploy-all.sh --stop-all       # Stop all active stacks cleanly
# =============================================================================

set -euo pipefail

HOMELAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Active stacks in strict dependency order
STACKS=(
  "01-core-infrastructure"
  "02-network-access"
  "03-monitoring"
  "04-productivity"
  "05-pkm"
  "06-documentation"
  "06-media"
  "10-backup"
  "11-security"
)

# Stacks containing locally built Dockerfiles (docker compose builds them automatically if missing)
FORCE_RECREATE=""
PULL_IMAGES="false"
BUILD_ALL="false"
SKIP_BACKUP="false"
STOP_ALL="false"
SPECIFIC_STACK=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force-recreate) FORCE_RECREATE="--force-recreate"; shift ;;
    --pull)           PULL_IMAGES="true"; shift ;;
    --build)          BUILD_ALL="true"; shift ;;
    --skip-backup)    SKIP_BACKUP="true"; shift ;;
    --stop-all)       STOP_ALL="true"; shift ;;
    --stack)          SPECIFIC_STACK="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,15p' "$0"
      exit 0
      ;;
    *)
      echo "❌ Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker is not running or current user lacks Docker permissions." >&2
  exit 1
fi

if [ "$STOP_ALL" = "true" ]; then
  echo "🛑 Stopping all homelab stacks (reverse order)..."
  for (( idx=${#STACKS[@]}-1 ; idx>=0 ; idx-- )); do
    stack="${STACKS[$idx]}"
    stack_dir="${HOMELAB_DIR}/${stack}"
    if [ -f "${stack_dir}/docker-compose.yml" ]; then
      echo "  → Stopping ${stack}..."
      (cd "$stack_dir" && docker compose stop) || true
    fi
  done
  echo "✅ All stacks stopped."
  exit 0
fi

# Always ensure external Docker networks exist first
"${HOMELAB_DIR}/shared/create_networks.sh"

deploy_stack() {
  local stack="$1"
  local stack_dir="${HOMELAB_DIR}/${stack}"

  if [ ! -f "${stack_dir}/docker-compose.yml" ]; then
    echo "⚠️  Skipping ${stack} (no docker-compose.yml)"
    return
  fi

  if [ "$SKIP_BACKUP" = "true" ] && [ "$stack" = "10-backup" ]; then
    echo "⏭️  Skipping 10-backup (--skip-backup)"
    return
  fi

  echo ""
  echo "🚀 Deploying ${stack}..."
  local build_flag=""
  if [ "$BUILD_ALL" = "true" ]; then
    build_flag="--build"
  fi

  (
    cd "$stack_dir"
    if [ "$PULL_IMAGES" = "true" ]; then
      docker compose pull --ignore-buildable || true
    fi
    docker compose up -d ${build_flag} ${FORCE_RECREATE}
  )
  echo "✅ ${stack} is up."
}

if [ -n "$SPECIFIC_STACK" ]; then
  deploy_stack "$SPECIFIC_STACK"
else
  for stack in "${STACKS[@]}"; do
    deploy_stack "$stack"
  done
fi

echo ""
echo "📋 Running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | sort
