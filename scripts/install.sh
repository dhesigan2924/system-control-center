#!/bin/bash
set -e

echo "=========================================="
echo "Local System Control Center - Installation"
echo "=========================================="

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "Checking system requirements..."

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    exit 1
fi
PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo "✓ Python $PYTHON_VERSION found"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed"
    exit 1
fi
NODE_VERSION=$(node --version)
echo "✓ Node.js $NODE_VERSION found"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed"
    exit 1
fi
NPM_VERSION=$(npm --version)
echo "✓ npm $NPM_VERSION found"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "WARNING: Docker is not installed. Docker management features will not work."
else
    DOCKER_VERSION=$(docker --version)
    echo "✓ Docker $DOCKER_VERSION found"
fi

# Check systemd
if ! command -v systemctl &> /dev/null; then
    echo "WARNING: systemctl not found. Service management features will be limited."
else
    echo "✓ systemd found"
fi

echo ""
echo "Setting up backend..."

cd "$BACKEND_DIR"

# Create virtual environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✓ Virtual environment created"
fi

# Activate and install dependencies
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
echo "✓ Backend dependencies installed"

# Create data directory
mkdir -p data
echo "✓ Data directory created"

echo ""
echo "Setting up frontend..."

cd "$FRONTEND_DIR"

# Install dependencies
npm install
echo "✓ Frontend dependencies installed"

echo ""
echo "=========================================="
echo "Installation complete!"
echo "=========================================="
echo ""
echo "To start the application:"
echo ""
echo "Option 1: Using Docker Compose (recommended)"
echo "  cd $PROJECT_DIR"
echo "  docker-compose up -d"
echo ""
echo "Option 2: Manual start"
echo "  Terminal 1 (Backend):"
echo "    cd $BACKEND_DIR"
echo "    source venv/bin/activate"
echo "    python -m uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload"
echo ""
echo "  Terminal 2 (Frontend):"
echo "    cd $FRONTEND_DIR"
echo "    npm run dev"
echo ""
echo "Access the dashboard at: http://127.0.0.1:5173"
echo "API available at: http://127.0.0.1:8080"
echo "API docs at: http://127.0.0.1:8080/docs"
echo ""