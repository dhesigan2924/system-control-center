import asyncio
import psutil
import platform
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.models.metrics import (
    CPUMetrics, MemoryMetrics, DiskMetrics, NetworkMetrics,
    SystemMetrics, SystemOverview, ServiceMetrics
)
from app.models.docker import ContainerState
from app.services.systemd import systemd_service
from app.services.docker_service import docker_service
from app.services.driver_service import driver_service
from app.services.network_service import network_service


class MetricsService:
    def __init__(self):
        self._cpu_history: List[Dict[str, Any]] = []
        self._memory_history: List[Dict[str, Any]] = []
        self._disk_history: List[Dict[str, Any]] = []
        self._network_history: List[Dict[str, Any]] = []
        self._max_history = 100
        self._overview_cache: Optional[SystemOverview] = None
        self._overview_cache_time: Optional[datetime] = None
        self._overview_cache_ttl = 5
        self._overview_lock = asyncio.Lock()

    def get_cpu_metrics(self) -> CPUMetrics:
        cpu_percent = psutil.cpu_percent(interval=0.1, percpu=True)
        freq = psutil.cpu_freq()
        load = psutil.getloadavg()

        return CPUMetrics(
            percent=sum(cpu_percent) / len(cpu_percent),
            per_cpu=cpu_percent,
            count_logical=psutil.cpu_count(logical=True),
            count_physical=psutil.cpu_count(logical=False),
            freq_current=freq.current if freq else None,
            freq_min=freq.min if freq else None,
            freq_max=freq.max if freq else None,
            load_1m=load[0],
            load_5m=load[1],
            load_15m=load[2],
            ctx_switches=psutil.cpu_stats().ctx_switches,
            interrupts=psutil.cpu_stats().interrupts,
            soft_interrupts=psutil.cpu_stats().soft_interrupts,
            syscalls=psutil.cpu_stats().syscalls,
        )

    def get_memory_metrics(self) -> MemoryMetrics:
        mem = psutil.virtual_memory()
        swap = psutil.swap_memory()

        return MemoryMetrics(
            total=mem.total,
            available=mem.available,
            used=mem.used,
            free=mem.free,
            percent=mem.percent,
            active=mem.active,
            inactive=mem.inactive,
            buffers=mem.buffers,
            cached=mem.cached,
            shared=mem.shared,
            slab=mem.slab,
            swap_total=swap.total,
            swap_used=swap.used,
            swap_free=swap.free,
            swap_percent=swap.percent,
        )

    def get_disk_metrics(self) -> List[DiskMetrics]:
        disks = []
        for partition in psutil.disk_partitions():
            try:
                usage = psutil.disk_usage(partition.mountpoint)
                io = psutil.disk_io_counters(perdisk=True).get(partition.device.split('/')[-1], None)

                disks.append(DiskMetrics(
                    device=partition.device,
                    mountpoint=partition.mountpoint,
                    fstype=partition.fstype,
                    total=usage.total,
                    used=usage.used,
                    free=usage.free,
                    percent=usage.percent,
                    read_count=io.read_count if io else 0,
                    write_count=io.write_count if io else 0,
                    read_bytes=io.read_bytes if io else 0,
                    write_bytes=io.write_bytes if io else 0,
                    read_time=io.read_time if io else 0,
                    write_time=io.write_time if io else 0,
                    busy_time=0,
                ))
            except (PermissionError, OSError):
                continue
        return disks

    def get_network_metrics(self) -> List[NetworkMetrics]:
        networks = []
        io_counters = psutil.net_io_counters(pernic=True)

        for name, counters in io_counters.items():
            networks.append(NetworkMetrics(
                interface=name,
                bytes_sent=counters.bytes_sent,
                bytes_recv=counters.bytes_recv,
                packets_sent=counters.packets_sent,
                packets_recv=counters.packets_recv,
                errin=counters.errin,
                errout=counters.errout,
                dropin=counters.dropin,
                dropout=counters.dropout,
            ))
        return networks

    def get_system_metrics(self) -> SystemMetrics:
        cpu = self.get_cpu_metrics()
        memory = self.get_memory_metrics()
        disks = self.get_disk_metrics()
        networks = self.get_network_metrics()

        boot_time = datetime.fromtimestamp(psutil.boot_time())
        uptime = (datetime.now() - boot_time).total_seconds()

        self._cpu_history.append({"timestamp": datetime.now(), "percent": cpu.percent})
        self._memory_history.append({"timestamp": datetime.now(), "percent": memory.percent})
        for disk in disks:
            self._disk_history.append({"timestamp": datetime.now(), "device": disk.device, "percent": disk.percent})
        for net in networks:
            self._network_history.append({"timestamp": datetime.now(), "interface": net.interface, "bytes_sent": net.bytes_sent, "bytes_recv": net.bytes_recv})

        for history in [self._cpu_history, self._memory_history, self._disk_history, self._network_history]:
            if len(history) > self._max_history:
                history.pop(0)

        return SystemMetrics(
            timestamp=datetime.now(),
            cpu=cpu,
            memory=memory,
            disks=disks,
            networks=networks,
            uptime=uptime,
            boot_time=boot_time,
            process_count=len(psutil.pids()),
            thread_count=sum(p.num_threads() for p in psutil.process_iter(['num_threads'])),
            file_descriptors=0,
        )

    async def get_overview(self) -> SystemOverview:
        # Reuse a recent result, the overview aggregates several expensive calls
        cached = self._overview_cache
        cached_at = self._overview_cache_time
        if cached is not None and cached_at is not None:
            if (datetime.now() - cached_at).total_seconds() < self._overview_cache_ttl:
                return cached

        async with self._overview_lock:
            cached = self._overview_cache
            cached_at = self._overview_cache_time
            if cached is not None and cached_at is not None:
                if (datetime.now() - cached_at).total_seconds() < self._overview_cache_ttl:
                    return cached

            overview = await self._collect_overview()
            self._overview_cache = overview
            self._overview_cache_time = datetime.now()
            return overview

    async def _collect_overview(self) -> SystemOverview:
        # Only the counts are needed here, the summary avoids the expensive
        # `systemctl show` round trip for every unit.
        service_counts = await systemd_service.list_units_summary()
        running_containers = docker_service.count_containers(ContainerState.RUNNING)
        modules = await driver_service.list_modules()
        ports = await network_service.list_listening_ports()

        cpu = self.get_cpu_metrics()
        memory = self.get_memory_metrics()
        disks = self.get_disk_metrics()
        disk_percent = max((d.percent for d in disks), default=0)
        uptime = (datetime.now() - datetime.fromtimestamp(psutil.boot_time())).total_seconds()

        return SystemOverview(
            total_services=service_counts["total"],
            running_services=service_counts["active"],
            stopped_services=service_counts["inactive"],
            failed_services=service_counts["failed"],
            active_ports=len(ports),
            running_containers=running_containers,
            loaded_modules=len(modules),
            recent_failures=service_counts["failed"],
            cpu_percent=cpu.percent,
            memory_percent=memory.percent,
            disk_percent=disk_percent,
            uptime=self._format_uptime(uptime),
        )

    async def get_service_metrics(self, service_name: str) -> Optional[ServiceMetrics]:
        try:
            service = await systemd_service.get_unit(service_name)
            if service.pid:
                proc = psutil.Process(service.pid)
                io = proc.io_counters()
                return ServiceMetrics(
                    service_name=service_name,
                    service_type="systemd",
                    timestamp=datetime.now(),
                    cpu_percent=proc.cpu_percent(),
                    memory_kb=proc.memory_info().rss // 1024,
                    memory_percent=proc.memory_percent(),
                    read_bytes=io.read_bytes,
                    write_bytes=io.write_bytes,
                    read_count=io.read_count,
                    write_count=io.write_count,
                    connections=len(proc.net_connections(kind='inet')),
                    threads=proc.num_threads(),
                    open_files=len(proc.open_files()),
                    uptime_seconds=service.uptime_seconds,
                )
        except Exception:
            pass
        return None

    def _format_uptime(self, seconds: float) -> str:
        days = int(seconds // 86400)
        hours = int((seconds % 86400) // 3600)
        minutes = int((seconds % 3600) // 60)
        if days > 0:
            return f"{days}d {hours}h {minutes}m"
        elif hours > 0:
            return f"{hours}h {minutes}m"
        else:
            return f"{minutes}m"

    def get_history(self) -> Dict[str, Any]:
        return {
            "cpu_history": self._cpu_history[-60:],
            "memory_history": self._memory_history[-60:],
            "disk_history": self._disk_history[-60:],
            "network_history": self._network_history[-60:],
        }


metrics_service = MetricsService()