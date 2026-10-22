from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ProcessState(str, Enum):
    RUNNING = "running"
    SLEEPING = "sleeping"
    DISK_SLEEP = "disk_sleep"
    STOPPED = "stopped"
    TRACING_STOP = "tracing_stop"
    ZOMBIE = "zombie"
    DEAD = "dead"
    WAKE_KILL = "wake_kill"
    WAKING = "waking"
    IDLE = "idle"
    UNKNOWN = "unknown"


class ProcessBase(BaseModel):
    pid: int
    ppid: Optional[int] = None
    name: str
    cmdline: List[str] = []
    username: Optional[str] = None
    state: ProcessState = ProcessState.UNKNOWN
    cpu_percent: Optional[float] = None
    memory_percent: Optional[float] = None
    memory_rss: Optional[int] = None
    memory_vms: Optional[int] = None
    create_time: Optional[datetime] = None
    num_threads: Optional[int] = None
    open_files: Optional[int] = None
    connections: List[Dict[str, Any]] = []
    environ: Dict[str, str] = {}
    cwd: Optional[str] = None
    exe: Optional[str] = None
    status: Optional[str] = None
    nice: Optional[int] = None
    ionice: Optional[int] = None
    rlimit: Optional[Dict[str, int]] = None
    io_counters: Optional[Dict[str, int]] = None
    cpu_times: Optional[Dict[str, float]] = None
    cpu_affinity: Optional[List[int]] = None
    memory_info: Optional[Dict[str, int]] = None
    memory_full_info: Optional[Dict[str, int]] = None
    children: Optional[List[int]] = None


class ProcessCreate(ProcessBase):
    pass


class ProcessResponse(ProcessBase):
    class Config:
        from_attributes = True


class ProcessAction(BaseModel):
    action: str = Field(pattern="^(stop|kill|terminate)$")
    confirm: bool = True
    signal: Optional[int] = 15


class ProcessActionResponse(BaseModel):
    success: bool
    message: str
    pid: int
    previous_state: Optional[str] = None
    error: Optional[str] = None


class ProcessFilter(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    state: Optional[ProcessState] = None
    min_cpu: Optional[float] = None
    min_memory: Optional[float] = None
    pid: Optional[int] = None
    port: Optional[int] = None