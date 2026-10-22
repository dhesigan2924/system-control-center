from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class CPUMetrics(BaseModel):
    percent: float
    per_cpu: List[float] = []
    count_logical: int
    count_physical: int
    freq_current: Optional[float] = None
    freq_min: Optional[float] = None
    freq_max: Optional[float] = None
    load_1m: float
    load_5m: float
    load_15m: float
    ctx_switches: int
    interrupts: int
    soft_interrupts: int
    syscalls: int


class MemoryMetrics(BaseModel):
    total: int
    available: int
    used: int
    free: int
    percent: float
    active: int
    inactive: int
    buffers: int
    cached: int
    shared: int
    slab: int
    swap_total: int
    swap_used: int
    swap_free: int
    swap_percent: float


class DiskMetrics(BaseModel):
    device: str
    mountpoint: str
    fstype: str
    total: int
    used: int
    free: int
    percent: float
    read_count: int
    write_count: int
    read_bytes: int
    write_bytes: int
    read_time: int
    write_time: int
    busy_time: int


class NetworkMetrics(BaseModel):
    interface: str
    bytes_sent: int
    bytes_recv: int
    packets_sent: int
    packets_recv: int
    errin: int
    errout: int
    dropin: int
    dropout: int
    speed: Optional[int] = None


class SystemMetrics(BaseModel):
    timestamp: datetime
    cpu: CPUMetrics
    memory: MemoryMetrics
    disks: List[DiskMetrics] = []
    networks: List[NetworkMetrics] = []
    uptime: float
    boot_time: datetime
    process_count: int
    thread_count: int
    file_descriptors: int


class ServiceMetrics(BaseModel):
    service_name: str
    service_type: str
    timestamp: datetime
    cpu_percent: Optional[float] = None
    memory_kb: Optional[int] = None
    memory_percent: Optional[float] = None
    read_bytes: Optional[int] = None
    write_bytes: Optional[int] = None
    read_count: Optional[int] = None
    write_count: Optional[int] = None
    connections: Optional[int] = None
    threads: Optional[int] = None
    open_files: Optional[int] = None
    uptime_seconds: Optional[int] = None


class MetricsHistory(BaseModel):
    cpu_history: List[Dict[str, Any]] = []
    memory_history: List[Dict[str, Any]] = []
    disk_history: List[Dict[str, Any]] = []
    network_history: List[Dict[str, Any]] = []
    service_history: Dict[str, List[Dict[str, Any]]] = {}


class SystemOverview(BaseModel):
    total_services: int
    running_services: int
    stopped_services: int
    failed_services: int
    active_ports: int
    running_containers: int
    loaded_modules: int
    recent_failures: int
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    uptime: str