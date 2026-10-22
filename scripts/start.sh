#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Starting Local System Control Center..."

cd "$PROJECT_DIR"

# Check if docker-compose is available
if command -v docker-compose &> /dev/null; then
    echo "Starting with Docker Compose..."
    docker-compose up -d
    echo ""
    echo "Services started!"
    echo "Frontend: http://127.0.0.1:5173"
    echo "Backend API: http://127.0.0.1:8080"
    echo "API Docs: http://127.0.0.1:8080/docs"
else
    echo "Docker Compose not found. Starting manually..."
    echo ""
    echo "Please run these commands in separate terminals:"
    echo ""
    echo "Terminal 1 (Backend):"
    echo "  cd $PROJECT_DIR/backend"
    echo "  source venv/bin/activate"
    echo "  python -m uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload"
    echo ""
    echo "Terminal 2 (Frontend):"
    echo "  cd $PROJECT_DIR/frontend"
    echo "  npm run dev"
fi