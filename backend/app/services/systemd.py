import asyncio
import re
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.core.utils import (
    run_command, run_command_sync, get_pid_from_systemd_status,
    get_memory_usage, get_cpu_usage, host_command
)
from app.core.exceptions import SystemdError, ResourceNotFoundError, OperationFailedError
from app.models.system import ServiceResponse, ServiceState, ServiceType, ServiceAction, ServiceActionResponse


class SystemdService:
    # Properties fetched for every unit in a single `systemctl show` call.
    LIST_PROPERTIES = [
        "Id", "LoadState", "ActiveState", "SubState", "MainPID",
        "ActiveEnterTimestampMonotonic", "UnitFileState", "FragmentPath",
    ]

    def __init__(self):
        self._cache: Dict[bool, List[ServiceResponse]] = {}
        self._cache_time: Dict[bool, datetime] = {}
        self._cache_ttl = 5
        self._lock = asyncio.Lock()

    async def list_units(self, all_units: bool = True) -> List[ServiceResponse]:
        # Reuse a recent result: systemctl is expensive and the websocket plus
        # the HTTP endpoints would otherwise trigger the same work repeatedly.
        cached = self._cache.get(all_units)
        cached_at = self._cache_time.get(all_units)
        if cached is not None and cached_at is not None:
            if (datetime.now() - cached_at).total_seconds() < self._cache_ttl:
                return cached

        async with self._lock:
            cached = self._cache.get(all_units)
            cached_at = self._cache_time.get(all_units)
            if cached is not None and cached_at is not None:
                if (datetime.now() - cached_at).total_seconds() < self._cache_ttl:
                    return cached

            services = await self._collect_units(all_units)
            self._cache[all_units] = services
            self._cache_time[all_units] = datetime.now()
            return services

    async def list_units_summary(self) -> Dict[str, int]:
        """Service counts per state without the expensive `systemctl show` call."""
        cmd = host_command(["systemctl", "list-units", "--no-legend", "--plain", "--all", "--type=service"])
        result = await run_command(cmd)

        counts = {"total": 0, "active": 0, "inactive": 0, "failed": 0}
        for line in result.stdout.strip().split('\n'):
            parts = line.split(None, 4)
            if len(parts) < 3:
                continue
            name, active = parts[0], parts[2].lower()
            if not name.endswith('.service'):
                continue
            counts["total"] += 1
            if active in counts:
                counts[active] += 1

        return counts

    async def _collect_units(self, all_units: bool = True) -> List[ServiceResponse]:
        cmd = host_command(["systemctl", "list-units", "--no-legend", "--plain"])
        if all_units:
            cmd.append("--all")
        cmd.extend(["--type=service"])

        result = await run_command(cmd)
        units = []

        for line in result.stdout.strip().split('\n'):
            if not line.strip():
                continue
            parts = line.split(None, 4)
            if len(parts) >= 5:
                name, load, active, sub, description = parts
                if not name.endswith('.service'):
                    continue
                units.append((name, load, active, sub, description))

        if not units:
            return []

        # One `systemctl show` call for all units instead of one call per unit.
        properties = await self._get_unit_properties(
            [unit[0] for unit in units], self.LIST_PROPERTIES
        )

        services = []

        for name, load, active, sub, description in units:
            props = properties.get(name, {})
            pid = self._parse_int(props.get('MainPID'))
            memory = get_memory_usage(pid) if pid else None
            cpu = get_cpu_usage(pid) if pid else None
            uptime = self._parse_uptime(props.get('ActiveEnterTimestampMonotonic'))
            enabled = props.get('UnitFileState', '') in ('enabled', 'enabled-runtime')

            service = ServiceResponse(
                id=name,
                name=name,
                display_name=name.replace('.service', ''),
                description=description.strip() if description else None,
                service_type=ServiceType.SYSTEMD,
                state=self._map_state(active, sub),
                enabled=enabled,
                pid=pid,
                cpu_percent=cpu,
                memory_kb=memory.get("rss_kb") if memory else None,
                uptime_seconds=uptime,
                load_state=props.get('LoadState', load),
                active_state=props.get('ActiveState', active),
                sub_state=props.get('SubState', sub),
                fragment_path=props.get('FragmentPath'),
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            services.append(service)

        return services

    async def get_unit(self, name: str) -> ServiceResponse:
        if not name.endswith('.service'):
            name += '.service'

        properties = [
            "Id", "Description", "LoadState", "ActiveState", "SubState",
            "FragmentPath", "ExecStart", "ExecStop", "Environment",
            "Wants", "Requires", "After", "Before", "UID", "GID",
            "MainPID", "ActiveEnterTimestampMonotonic", "UnitFileState",
        ]
        all_props = await self._get_unit_properties([name], properties)
        props = all_props.get(name, {})

        if not props.get('Id'):
            raise ResourceNotFoundError("Service", name)

        pid = self._parse_int(props.get('MainPID'))
        memory = get_memory_usage(pid) if pid else None
        cpu = get_cpu_usage(pid) if pid else None
        uptime = self._parse_uptime(props.get('ActiveEnterTimestampMonotonic'))
        enabled = props.get('UnitFileState', '') in ('enabled', 'enabled-runtime')

        return ServiceResponse(
            id=props.get('Id', name),
            name=name,
            display_name=name.replace('.service', ''),
            description=props.get('Description'),
            service_type=ServiceType.SYSTEMD,
            state=self._map_state(props.get('ActiveState', ''), props.get('SubState', '')),
            enabled=enabled,
            pid=pid,
            cpu_percent=cpu,
            memory_kb=memory.get("rss_kb") if memory else None,
            uptime_seconds=uptime,
            load_state=props.get('LoadState'),
            active_state=props.get('ActiveState'),
            sub_state=props.get('SubState'),
            fragment_path=props.get('FragmentPath'),
            exec_start=props.get('ExecStart'),
            exec_stop=props.get('ExecStop'),
            environment=self._parse_environment(props.get('Environment', '')),
            dependencies=self._parse_dependencies(props.get('Wants', ''), props.get('Requires', '')),
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

    async def _get_unit_properties(self, names: List[str], properties: List[str]) -> Dict[str, Dict[str, str]]:
        """Fetch properties for many units using chunked `systemctl show` calls."""
        result_map: Dict[str, Dict[str, str]] = {}
        chunk_size = 80
        chunks = [names[start:start + chunk_size] for start in range(0, len(names), chunk_size)]

        # Every chunk takes a couple of seconds, so they are queried in parallel.
        outputs = await asyncio.gather(*[
            run_command(host_command(["systemctl", "show", f"--property={','.join(properties)}"] + chunk))
            for chunk in chunks
        ], return_exceptions=True)

        for output in outputs:
            if isinstance(output, Exception):
                continue

            current: Dict[str, str] = {}

            for line in output.stdout.split('\n'):
                line = line.strip()
                if not line or '=' not in line:
                    continue
                key, value = line.split('=', 1)
                # "Id" is the first property of every unit block
                if key == 'Id' and current:
                    result_map[current['Id']] = current
                    current = {}
                current[key] = value

            if current.get('Id'):
                result_map[current['Id']] = current

        return result_map

    @staticmethod
    def _parse_int(value: Optional[str]) -> Optional[int]:
        try:
            parsed = int(value or 0)
            return parsed if parsed > 0 else None
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _parse_uptime(value: Optional[str]) -> Optional[int]:
        try:
            parsed = int(value or 0)
            return int(parsed / 1000000) if parsed > 0 else None
        except (TypeError, ValueError):
            return None

    def _map_state(self, active: str, sub: str) -> ServiceState:
        active = active.lower()
        sub = sub.lower()

        if active == "active":
            return ServiceState.ACTIVE
        elif active == "inactive":
            return ServiceState.INACTIVE
        elif active == "failed":
            return ServiceState.FAILED
        elif active == "activating":
            return ServiceState.ACTIVATING
        elif active == "deactivating":
            return ServiceState.DEACTIVATING
        elif active == "reloading":
            return ServiceState.RELOADING
        return ServiceState.UNKNOWN

    def _parse_environment(self, env_str: str) -> Dict[str, str]:
        env = {}
        if not env_str:
            return env
        for item in env_str.split():
            if '=' in item:
                key, value = item.split('=', 1)
                env[key] = value
        return env

    def _parse_dependencies(self, wants: str, requires: str) -> List[str]:
        deps = []
        for dep_str in [wants, requires]:
            if dep_str:
                deps.extend([d.strip() for d in dep_str.split() if d.strip()])
        return deps

    async def execute_action(self, name: str, action: ServiceAction, user: str = "local") -> ServiceActionResponse:
        if not name.endswith('.service'):
            name += '.service'

        if action.action in ["start", "stop", "restart", "reload"]:
            if not action.confirm:
                return ServiceActionResponse(
                    success=False,
                    message=f"Action {action.action} requires confirmation",
                    error="Confirmation required"
                )

        try:
            current = await self.get_unit(name)
            previous_state = current.state.value

            if action.action == "enable":
                result = await run_command(host_command(["systemctl", "enable", name]), check=True)
            elif action.action == "disable":
                result = await run_command(host_command(["systemctl", "disable", name]), check=True)
            else:
                result = await run_command(host_command(["systemctl", action.action, name]), check=True)

            await asyncio.sleep(0.5)
            updated = await self.get_unit(name)

            return ServiceActionResponse(
                success=True,
                message=f"Service {action.action} completed successfully",
                previous_state=previous_state,
                new_state=updated.state.value,
            )
        except Exception as e:
            return ServiceActionResponse(
                success=False,
                message=f"Failed to {action.action} service",
                error=str(e)
            )

    async def get_logs(self, name: str, lines: int = 100, since: Optional[str] = None) -> str:
        if not name.endswith('.service'):
            name += '.service'

        cmd = host_command(["journalctl", "-u", name, "-n", str(lines), "--no-pager", "--output=short-iso"])
        if since:
            cmd.extend(["--since", since])

        result = await run_command(cmd)
        return result.stdout


systemd_service = SystemdService()