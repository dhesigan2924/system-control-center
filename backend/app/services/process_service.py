import asyncio
import psutil
import os
from collections import defaultdict
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.core.exceptions import ResourceNotFoundError, OperationFailedError
from app.models.processes import ProcessBase, ProcessState, ProcessAction, ProcessActionResponse, ProcessFilter


# Attributes that psutil exposes through Process.as_dict(). Names such as
# "connections", "rlimit" or "children" are methods, not attributes, and are
# rejected by psutil (>=7) as invalid attr names, so they are fetched separately.
PROCESS_ATTRS = [
    'pid', 'ppid', 'name', 'cmdline', 'username', 'status',
    'cpu_percent', 'memory_percent', 'memory_info', 'memory_full_info',
    'create_time', 'num_threads', 'open_files', 'environ',
    'cwd', 'exe', 'nice', 'ionice', 'io_counters',
    'cpu_times', 'cpu_affinity',
]

# The list endpoint only renders a few columns. Reading `environ`, `open_files`
# or `cpu_affinity` for every process is expensive, so they are only fetched
# for the single process detail endpoint.
LIST_ATTRS = [
    'pid', 'ppid', 'name', 'cmdline', 'username', 'status',
    'cpu_percent', 'memory_percent', 'memory_info',
    'create_time', 'num_threads',
]


class ProcessService:
    def __init__(self):
        self._cache: Dict[int, ProcessBase] = {}

    def list_processes(self, filter: Optional[ProcessFilter] = None) -> List[ProcessBase]:
        processes = []

        for proc in psutil.process_iter(LIST_ATTRS):
            try:
                info = proc.info
                pid = info.get('pid')
                if not pid:
                    continue

                if filter:
                    if filter.name and filter.name.lower() not in info.get('name', '').lower():
                        continue
                    if filter.username and filter.username != info.get('username'):
                        continue
                    if filter.state and self._map_state(info.get('status')) != filter.state:
                        continue
                    if filter.min_cpu and (info.get('cpu_percent') or 0) < filter.min_cpu:
                        continue
                    if filter.min_memory and (info.get('memory_percent') or 0) < filter.min_memory:
                        continue
                    if filter.pid and filter.pid != pid:
                        continue

                process = self._build_process(
                    info,
                    connections=[],
                    children=None,
                    rlimit=None,
                )
                processes.append(process)
                self._cache[pid] = process
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
            except Exception:
                continue

        self._attach_children(processes)
        return processes

    def get_process(self, pid: int) -> ProcessBase:
        try:
            proc = psutil.Process(pid)
            info = proc.as_dict(attrs=PROCESS_ATTRS)

            return self._build_process(
                info,
                connections=self._connections_by_pid().get(pid, []),
                children=self._children_pids(proc),
                rlimit=self._read_rlimit(pid),
            )
        except psutil.NoSuchProcess:
            raise ResourceNotFoundError("Process", str(pid))
        except psutil.AccessDenied:
            raise OperationFailedError("process", f"Access denied to process {pid}")
        except Exception as e:
            raise OperationFailedError("process", str(e))

    def get_processes_by_port(self, port: int) -> List[ProcessBase]:
        processes = []
        connections_map = self._connections_by_pid()

        for pid, connections in connections_map.items():
            for conn in connections:
                if conn.laddr and conn.laddr.port == port:
                    try:
                        processes.append(self.get_process(pid))
                    except (ResourceNotFoundError, OperationFailedError):
                        continue
                    break

        return processes

    def _build_process(
        self,
        info: Dict[str, Any],
        connections: List[Any],
        children: Optional[List[int]],
        rlimit: Optional[Dict[str, int]],
    ) -> ProcessBase:
        mem_info = info.get('memory_info')
        mem_full = info.get('memory_full_info')
        io_counters = info.get('io_counters')
        cpu_times = info.get('cpu_times')
        cpu_affinity = info.get('cpu_affinity')
        # psutil returns an ionice namedtuple (ioclass, value); the model wants the value
        ionice = info.get('ionice')
        ionice_value = getattr(ionice, 'value', ionice)

        return ProcessBase(
            pid=info.get('pid'),
            ppid=info.get('ppid'),
            name=info.get('name', ''),
            cmdline=info.get('cmdline') or [],
            username=info.get('username'),
            state=self._map_state(info.get('status')),
            cpu_percent=info.get('cpu_percent'),
            memory_percent=info.get('memory_percent'),
            memory_rss=mem_info.rss if mem_info else None,
            memory_vms=mem_info.vms if mem_info else None,
            create_time=datetime.fromtimestamp(info['create_time']) if info.get('create_time') else None,
            num_threads=info.get('num_threads'),
            open_files=len(info['open_files']) if info.get('open_files') is not None else None,
            connections=self._serialize_connections(connections),
            environ=dict(info.get('environ') or {}),
            cwd=info.get('cwd'),
            exe=info.get('exe'),
            status=info.get('status'),
            nice=info.get('nice'),
            ionice=ionice_value,
            rlimit=rlimit,
            io_counters={
                'read_count': io_counters.read_count,
                'write_count': io_counters.write_count,
                'read_bytes': io_counters.read_bytes,
                'write_bytes': io_counters.write_bytes,
            } if io_counters else None,
            cpu_times={
                'user': cpu_times.user,
                'system': cpu_times.system,
                'children_user': cpu_times.children_user,
                'children_system': cpu_times.children_system,
            } if cpu_times else None,
            cpu_affinity=cpu_affinity,
            memory_info={
                'rss': mem_info.rss,
                'vms': mem_info.vms,
                'shared': getattr(mem_info, 'shared', 0),
                'text': getattr(mem_info, 'text', 0),
                'lib': getattr(mem_info, 'lib', 0),
                'data': getattr(mem_info, 'data', 0),
                'dirty': getattr(mem_info, 'dirty', 0),
            } if mem_info else None,
            memory_full_info={
                'uss': getattr(mem_full, 'uss', 0),
                'pss': getattr(mem_full, 'pss', 0),
                'swap': getattr(mem_full, 'swap', 0),
            } if mem_full else None,
            children=children,
        )

    def _connections_by_pid(self) -> Dict[int, List[Any]]:
        """Single global socket scan, grouped by pid (per-process scans are O(n^2))."""
        mapping: Dict[int, List[Any]] = defaultdict(list)
        try:
            for conn in psutil.net_connections(kind='inet'):
                if conn.pid:
                    mapping[conn.pid].append(conn)
        except (psutil.AccessDenied, PermissionError, OSError):
            pass
        return mapping

    def _serialize_connections(self, connections: List[Any]) -> List[Dict[str, Any]]:
        result = []
        for conn in connections:
            try:
                result.append({
                    'fd': conn.fd,
                    'family': conn.family.name if hasattr(conn.family, 'name') else str(conn.family),
                    'type': conn.type.name if hasattr(conn.type, 'name') else str(conn.type),
                    'laddr': f"{conn.laddr.ip}:{conn.laddr.port}" if conn.laddr else None,
                    'raddr': f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else None,
                    'status': conn.status,
                })
            except Exception:
                continue
        return result

    def _children_pids(self, proc: psutil.Process) -> Optional[List[int]]:
        try:
            return [c.pid for c in proc.children(recursive=False)]
        except (psutil.AccessDenied, psutil.NoSuchProcess, psutil.ZombieProcess):
            return None

    def _attach_children(self, processes: List[ProcessBase]) -> None:
        """Build the children map from already collected ppid values."""
        children_map: Dict[int, List[int]] = defaultdict(list)
        for process in processes:
            if process.ppid:
                children_map[process.ppid].append(process.pid)
        for process in processes:
            process.children = children_map.get(process.pid, [])

    def _read_rlimit(self, pid: int) -> Optional[Dict[str, int]]:
        """Read resource limits from /proc/<pid>/limits (psutil 7 requires a resource arg)."""
        try:
            with open(f"/proc/{pid}/limits", "r") as f:
                content = f.read()
        except (OSError, PermissionError):
            return None

        limits: Dict[str, int] = {}
        for line in content.split('\n')[1:]:
            parts = line.split()
            if len(parts) < 2:
                continue
            name, soft = parts[0], parts[1]
            if soft == 'unlimited':
                limits[name] = -1
            else:
                try:
                    limits[name] = int(soft)
                except ValueError:
                    continue
        return limits or None

    def _map_state(self, status: Optional[str]) -> ProcessState:
        if not status:
            return ProcessState.UNKNOWN
        status = status.lower()
        mapping = {
            'running': ProcessState.RUNNING,
            'sleeping': ProcessState.SLEEPING,
            'disk-sleep': ProcessState.DISK_SLEEP,
            'stopped': ProcessState.STOPPED,
            'tracing-stop': ProcessState.TRACING_STOP,
            'zombie': ProcessState.ZOMBIE,
            'dead': ProcessState.DEAD,
            'wake-kill': ProcessState.WAKE_KILL,
            'waking': ProcessState.WAKING,
            'idle': ProcessState.IDLE,
        }
        return mapping.get(status, ProcessState.UNKNOWN)

    async def execute_action(self, pid: int, action: ProcessAction) -> ProcessActionResponse:
        if not action.confirm:
            return ProcessActionResponse(
                success=False,
                message="Process termination requires confirmation",
                pid=pid,
                error="Confirmation required"
            )

        try:
            proc = psutil.Process(pid)
            previous_state = self._map_state(proc.status()).value

            if action.action == "stop":
                proc.terminate()
                await asyncio.sleep(0.5)
                if proc.is_running():
                    proc.kill()
            elif action.action == "kill":
                proc.kill()
            elif action.action == "terminate":
                proc.send_signal(action.signal or 15)

            return ProcessActionResponse(
                success=True,
                message=f"Process {action.action} sent successfully",
                pid=pid,
                previous_state=previous_state,
            )
        except psutil.NoSuchProcess:
            raise ResourceNotFoundError("Process", str(pid))
        except psutil.AccessDenied:
            return ProcessActionResponse(
                success=False,
                message="Access denied",
                pid=pid,
                error="Permission denied"
            )
        except Exception as e:
            return ProcessActionResponse(
                success=False,
                message=f"Failed to {action.action} process",
                pid=pid,
                error=str(e)
            )

    def get_process_tree(self, pid: int) -> Dict[str, Any]:
        try:
            proc = psutil.Process(pid)
            return self._build_tree(proc, self._children_map())
        except psutil.NoSuchProcess:
            raise ResourceNotFoundError("Process", str(pid))

    def _children_map(self) -> Dict[int, List[int]]:
        """Build the pid -> children map in a single pass over all processes."""
        children_map: Dict[int, List[int]] = defaultdict(list)
        for proc in psutil.process_iter(['pid', 'ppid']):
            try:
                info = proc.info
                pid = info.get('pid')
                ppid = info.get('ppid')
                if pid and ppid:
                    children_map[ppid].append(pid)
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
            except Exception:
                continue
        return children_map

    def _build_tree(self, proc: psutil.Process, children_map: Dict[int, List[int]], depth: int = 0) -> Dict[str, Any]:
        try:
            children = [psutil.Process(child_pid) for child_pid in children_map.get(proc.pid, [])]
            return {
                "pid": proc.pid,
                "name": proc.name(),
                "cmdline": proc.cmdline(),
                "username": proc.username(),
                "status": proc.status(),
                "cpu_percent": proc.cpu_percent(),
                "memory_percent": proc.memory_percent(),
                "depth": depth,
                "children": [self._build_tree(c, children_map, depth + 1) for c in children],
            }
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return {"pid": proc.pid, "error": "Access denied"}


process_service = ProcessService()
