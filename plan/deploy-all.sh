#!/bin/bash
# =============================================================================
# Homelab Deployment Script
# =============================================================================
# Usage: ./deploy-all.sh [options]
# Options:
#   --force-recreate  Force recreate all containers
#   --pull            Pull latest images first
#   --stack <name>    Deploy only specific stack (e.g., --stack 03-monitoring)
# =============================================================================

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Stack deployment order (CRITICAL - don't change!)
STACKS=(
  "01-core-infrastructure"
  "02-network-access"
  "03-monitoring"
  "04-productivity"
  "05-knowledge-base"
  "06-media"
  "07-documents"
  "08-utilities"
  "09-communication"
  "10-backup"
)

# Parse arguments
FORCE_RECREATE=""
PULL_IMAGES=""
SPECIFIC_STACK=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --force-recreate)
      FORCE_RECREATE="--force-recreate"
      shift
      ;;
    --pull)
      PULL_IMAGES="true"
      shift
      ;;
    --stack)
      SPECIFIC_STACK="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Function to print colored messages
print_info() {
  echo -e "${BLUE}ℹ ${1}${NC}"
}

print_success() {
  echo -e "${GREEN}✅ ${1}${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  ${1}${NC}"
}

print_error() {
  echo -e "${RED}❌ ${1}${NC}"
}

# Function to deploy a stack
deploy_stack() {
  local stack=$1
  local stack_dir="$HOME/homelab/$stack"
  
  if [ ! -d "$stack_dir" ]; then
    print_warning "Stack directory not found: $stack_dir (skipping)"
    return
  fi
  
  print_info "Deploying $stack..."
  
  cd "$stack_dir"
  
  # Pull images if requested
  if [ "$PULL_IMAGES" = "true" ]; then
    print_info "Pulling latest images for $stack..."
    docker compose pull || print_warning "Some images couldn't be pulled"
  fi
  
  # Deploy the stack
  if docker compose up -d $FORCE_RECREATE; then
    print_success "$stack deployed successfully"
  else
    print_error "$stack deployment failed!"
    read -p "Continue with next stack? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
  
  # Wait a bit for services to stabilize
  sleep 5
  
  cd - > /dev/null
}

# Function to check if Docker is running
check_docker() {
  if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running!"
    exit 1
  fi
}

# Function to show stack health
show_health() {
  print_info "Checking stack health..."
  echo ""
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | head -n 20
  echo ""
  print_info "Total containers running: $(docker ps -q | wc -l)"
}

# Main deployment logic
main() {
  print_info "=== Homelab Deployment Script ==="
  echo ""
  
  # Check Docker
  check_docker
  print_success "Docker is running"
  echo ""
  
  # Deploy specific stack or all stacks
  if [ -n "$SPECIFIC_STACK" ]; then
    print_info "Deploying single stack: $SPECIFIC_STACK"
    deploy_stack "$SPECIFIC_STACK"
  else
    print_info "Deploying all stacks in order..."
    echo ""
    
    for stack in "${STACKS[@]}"; do
      deploy_stack "$stack"
      echo ""
    done
  fi
  
  echo ""
  print_success "🎉 Deployment complete!"
  echo ""
  
  # Show health status
  show_health
  
  echo ""
  print_info "Access your services:"
  echo "  • Nginx Proxy Manager: http://your-ip:81"
  echo "  • Portainer:           http://your-ip:9000"
  echo "  • Homepage Dashboard:  http://your-ip:3005"
  echo "  • AdGuard Home:        http://your-ip:3000"
  echo ""
  print_info "Check logs with:"
  echo "  docker compose -f ~/homelab/[stack-name]/docker-compose.yml logs -f [service]"
  echo ""
}

# Run main function
main
