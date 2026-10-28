# ⚡ System Control Center
**The visual, voice-activated Agentic OS controller.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)
[![MCP Powered](https://img.shields.io/badge/Architecture-Model_Context_Protocol-blue.svg)](#architecture)

---

## 🛑 The Problem: Terminal Fatigue
Tools like Open Interpreter brought Agentic AI to the local machine, but they left it trapped in the terminal. Managing an operating system shouldn't require reading endless lines of stdout or typing complex CLI commands when you just want a quick overview of your system's health. 

## 💡 The Solution: GUI + Voice + MCP
**System Control Center** bridges the gap between terminal automation and user experience. It provides a centralized React-based dashboard for real-time system monitoring, paired with an AI agent that listens to natural language and executes OS-level commands securely.

### 🔥 Why This Beats Terminal-Only Agents:
1. **Total Visual Oversight:** Monitor CPU, RAM, active processes, and rogue ports in a clean, modern UI without switching contexts.
2. **Hands-Free Voice Control:** Speak directly to your system. The integrated Speech-to-Text engine captures intent instantly.
3. **Secure Execution via MCP:** Instead of giving an LLM raw terminal access (which is highly dangerous), this system uses the **Model Context Protocol (MCP)**. The AI can only execute predefined, sandboxed tools, ensuring it cannot accidentally wipe your hard drive or kill critical OS services.

---

## 🏗️ Architecture & Data Flow
System Control Center operates on a strict separation of concerns, ensuring the AI cannot execute arbitrary destructive code.

1. **User Input:** User speaks a command or types a prompt in the Dashboard UI.
2. **Intent Parsing:** The local LLM (e.g., Ollama) processes the natural language to determine the required action.
3. **MCP Tool Call:** The LLM requests execution of a specific, whitelisted tool via the Model Context Protocol server.
4. **OS Execution:** The MCP server securely executes the system-level command (e.g., `kill <PID>`, `systemctl restart <service>`).
5. **State Sync:** The OS state changes, and the visual dashboard updates in real-time to reflect the new system environment.

---

# Local System Control Center

A modern, self-hosted web dashboard for discovering, monitoring, managing, and auditing system services, device information, background processes, development servers, Docker containers, and active network ports on your local machine.

#
>> # **Note >> The MCP Option is Not Build Yet , I Will Update it as Soon as Possible !**

## Features

- **System Services Management** - View, start, stop, restart, enable/disable systemd services with real-time status
- **Process Monitoring** - Discover and manage running processes with CPU/memory usage
- **Device Drivers** - List kernel modules and hardware devices with load/unload capabilities
- **Docker Management** - Full container lifecycle management (start, stop, restart, pause, logs, inspect)
- **Network Port Monitor** - View listening ports with process/container association
- **Audit Logging** - Complete audit trail of all management actions
- **Real-time Metrics** - CPU, memory, disk, and network utilization
- **Dark Theme** - Professional system-monitoring aesthetic
- **MCP** Access LLM via the Model Context Protocol server.


**Demo Video**
 https://github.com/dhesigan2924/system-control-center/blob/main/systemcontrolcenter.mp4

## Requirements

- Linux (tested on Kali/Debian/Ubuntu)
- Python 3.11+
- Node.js 20+
- Docker (optional, for container management)
- systemd (for service management)

## Quick Start

### Using Docker Compose (Recommended)

```bash
git clone https://github.com/dhesigan2924/system-control-center.git
cd system-control-center
docker-compose up -d
```

Access at:
- **Dashboard**: http://127.0.0.1:5173
- **API**: http://127.0.0.1:8080
- **API Docs**: http://127.0.0.1:8080/docs

### Manual Installation

```bash
# Run installation script
./scripts/install.sh

# Start services
./scripts/start.sh
```

Or manually:

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Architecture

```
local-system-control-center/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/routes/      # REST API endpoints
│   │   ├── services/        # Business logic
│   │   ├── models/          # Pydantic models
│   │   ├── core/            # Core utilities
│   │   └── database/        # SQLite + SQLAlchemy
│   └── requirements.txt
├── frontend/                # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API client
│   │   └── types/           # TypeScript types
│   └── package.json
├── docker-compose.yml
└── scripts/
    ├── install.sh
    └── start.sh
```

## API Endpoints

### System Services
- `GET /api/system/services` - List all services
- `GET /api/system/services/{name}` - Get service details
- `POST /api/system/services/{name}/action` - Perform action (start/stop/restart/reload/enable/disable)
- `GET /api/system/services/{name}/logs` - Get service logs

### Docker
- `GET /api/docker/containers` - List containers
- `GET /api/docker/containers/{id}` - Get container details
- `POST /api/docker/containers/{id}/action` - Container action
- `GET /api/docker/containers/{id}/logs` - Get container logs
- `GET /api/docker/networks` - List networks
- `GET /api/docker/volumes` - List volumes
- `GET /api/docker/info` - Docker daemon info

### Processes
- `GET /api/processes` - List processes
- `GET /api/processes/{pid}` - Get process details
- `GET /api/processes/{pid}/tree` - Get process tree
- `POST /api/processes/{pid}/action` - Process action

### Drivers
- `GET /api/drivers/modules` - List kernel modules
- `GET /api/drivers/modules/{name}` - Get module details
- `POST /api/drivers/modules/{name}/action` - Module action (load/unload/info)
- `GET /api/drivers/hardware` - List hardware devices

### Network
- `GET /api/network/ports` - List listening ports
- `GET /api/network/interfaces` - List network interfaces
- `GET /api/network/connections` - List active connections

### Metrics
- `GET /api/metrics/system` - System metrics
- `GET /api/metrics/overview` - System overview
- `GET /api/metrics/history` - Metrics history

### Audit
- `GET /api/system/audit` - Get audit logs
- `GET /api/system/audit/stats` - Audit statistics

### WebSocket
- `WS /ws/metrics` - Real-time metrics (every 5s)
- `WS /ws/overview` - Real-time overview (every 15s)

## Configuration

Backend configuration via environment variables or `.env` file:

```env
API_HOST=127.0.0.1
API_PORT=8080
DATABASE_URL=sqlite+aiosqlite:///./data/app.db
DOCKER_SOCKET=unix:///var/run/docker.sock
ENABLE_AUTH=false
SECRET_KEY=your-secret-key
```

## Security

- Binds to 127.0.0.1 by default
- No authentication required for local access (enable via `ENABLE_AUTH=true`)
- All privileged operations through validated backend functions
- Audit logging for all management actions
- Confirmation required for destructive operations

## Notes

- The Docker Compose setup runs both services in host network mode. The backend
  talks to the host systemd through `nsenter`, so the container needs
  `pid: host` plus the `/run/systemd` and `/run/dbus` mounts (already set in
  `docker-compose.yml`).
- If a firewall blocks traffic between the Docker bridge and the host, keep
  `network_mode: host` for the frontend as well.

## Development

### Backend Tests
```bash
cd backend
source venv/bin/activate
pytest
```

### Frontend Linting
```bash
cd frontend
npm run lint
```

### Building for Production
```bash
# Backend
cd backend
docker build -t lsc-backend .

# Frontend
cd frontend
npm run build
docker build -t lsc-frontend .
```

## License

MIT License - See LICENSE file for details.
