from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class AuditAction(str, Enum):
    START = "start"
    STOP = "stop"
    RESTART = "restart"
    ENABLE = "enable"
    DISABLE = "disable"
    RELOAD = "reload"
    PAUSE = "pause"
    UNPAUSE = "unpause"
    KILL = "kill"
    TERMINATE = "terminate"
    LOAD = "load"
    UNLOAD = "unload"
    CREATE = "create"
    REMOVE = "remove"
    UPDATE = "update"


class AuditResult(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    DENIED = "denied"
    PARTIAL = "partial"


class AuditLogBase(BaseModel):
    resource_type: str
    resource_name: str
    resource_id: Optional[str] = None
    action: AuditAction
    previous_state: Optional[str] = None
    resulting_state: Optional[str] = None
    result: AuditResult
    error_details: Optional[str] = None
    user_identity: Optional[str] = None
    interface: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    pass


class AuditLogResponse(AuditLogBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class AuditFilter(BaseModel):
    resource_type: Optional[str] = None
    resource_name: Optional[str] = None
    action: Optional[AuditAction] = None
    result: Optional[AuditResult] = None
    user_identity: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    limit: int = 100
    offset: int = 0


class AuditStats(BaseModel):
    total_events: int
    success_count: int
    failed_count: int
    denied_count: int
    by_action: Dict[str, int]
    by_resource_type: Dict[str, int]
    by_user: Dict[str, int]
    recent_failures: List[AuditLogResponse] = []