#!/bin/bash
set -e

echo "=== Building devoq-ai ==="

echo ">> Building backend..."
cd "$(dirname "$0")/../backend"
npm run build

echo ">> Building frontend..."
cd "$(dirname "$0")/../frontend"
npm run build

echo "=== Build complete ==="
