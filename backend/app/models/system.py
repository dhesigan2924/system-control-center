from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ServiceState(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    FAILED = "failed"
    ACTIVATING = "activating"
    DEACTIVATING = "deactivating"
    RELOADING = "reloading"
    UNKNOWN = "unknown"


class ServiceType(str, Enum):
    SYSTEMD = "systemd"
    DOCKER = "docker"
    PROCESS = "process"
    DRIVER = "driver"


class ServiceBase(BaseModel):
    name: str
    display_name: Optional[str] = None
    description: Optional[str] = None
    service_type: ServiceType
    state: ServiceState
    enabled: Optional[bool] = None
    pid: Optional[int] = None
    cpu_percent: Optional[float] = None
    memory_kb: Optional[int] = None
    uptime_seconds: Optional[int] = None
    load_state: Optional[str] = None
    active_state: Optional[str] = None
    sub_state: Optional[str] = None
    fragment_path: Optional[str] = None
    exec_start: Optional[str] = None
    exec_stop: Optional[str] = None
    environment: Optional[Dict[str, str]] = None
    dependencies: Optional[List[str]] = None


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    state: Optional[ServiceState] = None
    enabled: Optional[bool] = None


class ServiceResponse(ServiceBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ServiceAction(BaseModel):
    action: str = Field(pattern="^(start|stop|restart|reload|enable|disable)$")
    confirm: bool = False


class ServiceActionResponse(BaseModel):
    success: bool
    message: str
    previous_state: Optional[str] = None
    new_state: Optional[str] = None
    error: Optional[str] = None