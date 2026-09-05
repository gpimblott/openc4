#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=== Starting OpenC4 Enterprise Architecture Platform (TypeScript) ==="

# Check backend dependencies
if [ ! -d "backend/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
fi

# Ensure frontend is built
if [ ! -d "frontend/dist" ]; then
    echo "Building Web Studio frontend..."
    cd frontend
    npm install
    npm run build
    cd ..
fi

echo "Serving OpenC4 at http://localhost:8000"
echo "MCP endpoint active at http://localhost:8000/mcp"

exec npm --prefix backend run dev
