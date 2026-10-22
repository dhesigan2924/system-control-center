from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ContainerState(str, Enum):
    CREATED = "created"
    RUNNING = "running"
    PAUSED = "paused"
    RESTARTING = "restarting"
    REMOVING = "removing"
    EXITED = "exited"
    DEAD = "dead"
    UNKNOWN = "unknown"


class ContainerHealth(str, Enum):
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    STARTING = "starting"
    NONE = "none"


class RestartPolicy(str, Enum):
    NO = "no"
    ON_FAILURE = "on-failure"
    ALWAYS = "always"
    UNLESS_STOPPED = "unless-stopped"


class ContainerBase(BaseModel):
    id: str
    name: str
    image: str
    image_id: Optional[str] = None
    state: ContainerState
    status: str
    created: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    ports: List[Dict[str, Any]] = []
    mounts: List[Dict[str, Any]] = []
    networks: List[str] = []
    labels: Dict[str, str] = {}
    env: List[str] = []
    command: Optional[str] = None
    working_dir: Optional[str] = None
    restart_policy: RestartPolicy = RestartPolicy.NO
    restart_count: int = 0
    health: ContainerHealth = ContainerHealth.NONE
    cpu_percent: Optional[float] = None
    memory_usage: Optional[int] = None
    memory_limit: Optional[int] = None
    network_rx: Optional[int] = None
    network_tx: Optional[int] = None
    block_read: Optional[int] = None
    block_write: Optional[int] = None
    pids: Optional[int] = None


class ContainerCreate(BaseModel):
    image: str
    name: Optional[str] = None
    command: Optional[str] = None
    environment: Optional[Dict[str, str]] = None
    ports: Optional[Dict[str, str]] = None
    volumes: Optional[Dict[str, Dict[str, str]]] = None
    network: Optional[str] = None
    restart_policy: RestartPolicy = RestartPolicy.NO
    labels: Optional[Dict[str, str]] = None
    working_dir: Optional[str] = None
    entrypoint: Optional[str] = None
    user: Optional[str] = None
    detach: bool = True


class ContainerUpdate(BaseModel):
    restart_policy: Optional[RestartPolicy] = None


class ContainerAction(BaseModel):
    action: str = Field(pattern="^(start|stop|restart|pause|unpause|kill|remove)$")
    confirm: bool = False
    timeout: Optional[int] = 10


class ContainerActionResponse(BaseModel):
    success: bool
    message: str
    previous_state: Optional[str] = None
    new_state: Optional[str] = None
    error: Optional[str] = None


class ContainerLogs(BaseModel):
    container_id: str
    logs: str
    timestamps: bool = False
    tail: int = 100
    since: Optional[datetime] = None
    until: Optional[datetime] = None
    follow: bool = False


class DockerNetwork(BaseModel):
    id: str
    name: str
    driver: str
    scope: str
    internal: bool
    attachable: bool
    containers: List[str] = []
    labels: Dict[str, str] = {}


class DockerVolume(BaseModel):
    name: str
    driver: str
    mountpoint: str
    labels: Dict[str, str] = {}
    scope: str = "local"
    created_at: Optional[datetime] = None
    size: Optional[int] = None


class DockerInfo(BaseModel):
    containers: int
    containers_running: int
    containers_paused: int
    containers_stopped: int
    images: int
    server_version: str
    storage_driver: str
    logging_driver: str
    cgroup_driver: str
    kernel_version: str
    operating_system: str
    architecture: str
    cpus: int
    memory_total: int
    memory_available: int