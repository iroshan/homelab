#!/usr/bin/env bash
# Wrapper kept for backwards compatibility — canonical script lives in scripts/deploy-all.sh
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/deploy-all.sh" "$@"
