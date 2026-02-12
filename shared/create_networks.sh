#!/bin/bash
# Create shared networks manually since docker compose up requires services

# Core Infrastructure (Internal, Static IP)
docker network create --driver bridge --internal --subnet=172.18.0.0/24 infrastructure_net || true

# Public facing
docker network create --driver bridge proxy_net || true

# Application stacks
docker network create --driver bridge monitoring_net || true
docker network create --driver bridge productivity_net || true
docker network create --driver bridge knowledge_net || true
docker network create --driver bridge media_net || true
docker network create --driver bridge documents_net || true
docker network create --driver bridge utilities_net || true
docker network create --driver bridge communication_net || true
docker network create --driver bridge backup_net || true

echo "Networks created successfully."
