#!/bin/bash
set -e

VPS_HOST="192.250.230.178"
VPS_USER="deploy"
PROJECT_DIR="/home/deploy/projects/devoq-ai"

echo "=== Deploying devoq-ai to VPS ==="

echo ">> Building..."
bash "$(dirname "$0")/build.sh"

echo ">> Syncing files..."
rsync -avz --exclude='node_modules' --exclude='.git' \
  "$(dirname "$0")/../" "${VPS_USER}@${VPS_HOST}:${PROJECT_DIR}/"

echo ">> Starting on VPS..."
ssh "${VPS_USER}@${VPS_HOST}" "cd ${PROJECT_DIR} && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"

echo "=== Deploy complete ==="
