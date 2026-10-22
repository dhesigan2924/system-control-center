import asyncio
import os
import subprocess
import shlex
from typing import Optional, List, Dict, Any
from pathlib import Path
import json
import re

from app.core.exceptions import AppException, OperationFailedError


def running_in_container() -> bool:
    """True when the app runs inside a container instead of directly on the host."""
    if os.path.exists("/.dockerenv"):
        return True
    try:
        with open("/proc/1/comm", "r") as f:
            return f.read().strip() not in ("systemd", "init")
    except OSError:
        return False


def host_command(cmd: List[str]) -> List[str]:
    """Run systemd tooling against the host when the app runs in a container.

    Inside a container `systemctl` talks to the container's own (empty) systemd.
    With the host PID namespace the real systemd is reachable through nsenter.
    """
    if not running_in_container():
        return cmd
    if not cmd or os.path.basename(cmd[0]) not in ("systemctl", "journalctl"):
        return cmd
    return ["nsenter", "-t", "1", "-m", "-u", "-i", "-n", "-p", "--"] + cmd


async def run_command(
    cmd: List[str],
    timeout: int = 30,
    capture_output: bool = True,
    check: bool = False,
    input_data: Optional[str] = None
) -> subprocess.CompletedProcess:
    """Run a command asynchronously with timeout."""
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE if input_data else None,
            stdout=asyncio.subprocess.PIPE if capture_output else None,
            stderr=asyncio.subprocess.PIPE if capture_output else None,
        )
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input_data.encode() if input_data else None),
            timeout=timeout
        )
        result = subprocess.CompletedProcess(
            args=cmd,
            returncode=proc.returncode,
            stdout=stdout.decode() if stdout else "",
            stderr=stderr.decode() if stderr else "",
        )
        if check and result.returncode != 0:
            raise OperationFailedError(
                " ".join(cmd),
                f"Command failed with exit code {result.returncode}: {result.stderr}"
            )
        return result
    except asyncio.TimeoutError:
        raise OperationFailedError(" ".join(cmd), f"Command timed out after {timeout}s")
    except FileNotFoundError:
        raise OperationFailedError(" ".join(cmd), "Command not found")
    except Exception as e:
        raise OperationFailedError(" ".join(cmd), str(e))


def run_command_sync(
    cmd: List[str],
    timeout: int = 30,
    capture_output: bool = True,
    check: bool = False,
    input_data: Optional[str] = None
) -> subprocess.CompletedProcess:
    """Run a command synchronously with timeout."""
    try:
        result = subprocess.run(
            cmd,
            input=input_data,
            capture_output=capture_output,
            text=True,
            timeout=timeout,
            check=check,
        )
        return result
    except subprocess.TimeoutExpired:
        raise OperationFailedError(" ".join(cmd), f"Command timed out after {timeout}s")
    except FileNotFoundError:
        raise OperationFailedError(" ".join(cmd), "Command not found")
    except subprocess.CalledProcessError as e:
        raise OperationFailedError(" ".join(cmd), f"Command failed: {e.stderr}")
    except Exception as e:
        raise OperationFailedError(" ".join(cmd), str(e))


def parse_systemd_output(output: str) -> List[Dict[str, Any]]:
    """Parse systemctl list-units output."""
    lines = output.strip().split('\n')
    if len(lines) < 2:
        return []
    headers = lines[0].split()
    units = []
    for line in lines[1:]:
        if not line.strip():
            continue
        parts = line.split(None, len(headers) - 1)
        if len(parts) >= len(headers):
            units.append(dict(zip(headers, parts)))
    return units


def parse_ps_output(output: str) -> List[Dict[str, Any]]:
    """Parse ps aux output."""
    lines = output.strip().split('\n')
    if len(lines) < 2:
        return []
    headers = lines[0].split()
    processes = []
    for line in lines[1:]:
        if not line.strip():
            continue
        parts = line.split(None, len(headers) - 1)
        if len(parts) >= len(headers):
            processes.append(dict(zip(headers, parts)))
    return processes


def parse_ss_output(output: str) -> List[Dict[str, Any]]:
    """Parse ss -tulnp output."""
    lines = output.strip().split('\n')
    if len(lines) < 2:
        return []
    headers = lines[0].split()
    connections = []
    for line in lines[1:]:
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) >= 6:
            conn = {
                "state": parts[0],
                "recv_q": parts[1],
                "send_q": parts[2],
                "local_address": parts[3],
                "peer_address": parts[4],
                "process": parts[5] if len(parts) > 5 else "",
            }
            connections.append(conn)
    return connections


def parse_lsmod_output(output: str) -> List[Dict[str, Any]]:
    """Parse lsmod output."""
    lines = output.strip().split('\n')
    if len(lines) < 2:
        return []
    modules = []
    for line in lines[1:]:
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) >= 3:
            modules.append({
                "module": parts[0],
                "size": parts[1],
                "used_by": parts[2] if len(parts) > 2 else "",
                "dependencies": parts[3:] if len(parts) > 3 else [],
            })
    return modules


def parse_docker_ps_output(output: str) -> List[Dict[str, Any]]:
    """Parse docker ps --format json output."""
    containers = []
    for line in output.strip().split('\n'):
        if not line.strip():
            continue
        try:
            containers.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return containers


def get_pid_from_systemd_status(status_output: str) -> Optional[int]:
    """Extract PID from systemctl status output."""
    match = re.search(r'Main PID:\s+(\d+)', status_output)
    return int(match.group(1)) if match else None


def get_memory_usage(pid: int) -> Optional[Dict[str, int]]:
    """Get memory usage for a PID from /proc."""
    try:
        with open(f"/proc/{pid}/status", "r") as f:
            content = f.read()
        usage: Dict[str, int] = {}
        for line in content.split('\n'):
            if line.startswith('VmRSS:'):
                usage["rss_kb"] = int(line.split()[1])
            elif line.startswith('VmSize:'):
                usage["vms_kb"] = int(line.split()[1])
        return usage or None
    except (FileNotFoundError, PermissionError, ValueError, IndexError):
        pass
    return None


def get_cpu_usage(pid: int) -> Optional[float]:
    """Get CPU usage for a PID from /proc/stat."""
    try:
        with open(f"/proc/{pid}/stat", "r") as f:
            content = f.read()
        parts = content.split()
        if len(parts) >= 17:
            utime = int(parts[13])
            stime = int(parts[14])
            return (utime + stime) / 100.0
    except (FileNotFoundError, PermissionError, ValueError, IndexError):
        pass
    return None


def format_bytes(bytes_val: int) -> str:
    """Format bytes to human readable string."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_val < 1024:
            return f"{bytes_val:.1f} {unit}"
        bytes_val /= 1024
    return f"{bytes_val:.1f} PB"


def format_uptime(seconds: float) -> str:
    """Format uptime seconds to human readable string."""
    days = int(seconds // 86400)
    hours = int((seconds % 86400) // 3600)
    minutes = int((seconds % 3600) // 60)
    if days > 0:
        return f"{days}d {hours}h {minutes}m"
    elif hours > 0:
        return f"{hours}h {minutes}m"
    else:
        return f"{minutes}m"