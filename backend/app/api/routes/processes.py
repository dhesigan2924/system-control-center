import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional

from app.services import process_service
from app.services.audit_service import AuditService, get_audit_service
from app.models.processes import ProcessBase, ProcessAction, ProcessActionResponse, ProcessFilter, ProcessState

router = APIRouter(prefix="/api/processes", tags=["processes"])


@router.get("", response_model=List[ProcessBase])
async def list_processes(
    name: Optional[str] = Query(None),
    username: Optional[str] = Query(None),
    state: Optional[ProcessState] = Query(None),
    min_cpu: Optional[float] = Query(None),
    min_memory: Optional[float] = Query(None),
    pid: Optional[int] = Query(None),
    port: Optional[int] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
):
    filter = ProcessFilter(
        name=name,
        username=username,
        state=state,
        min_cpu=min_cpu,
        min_memory=min_memory,
        pid=pid,
        port=port,
    )
    # Collecting the process table blocks for a moment, so it runs in a worker
    # thread to keep the event loop responsive.
    processes = await asyncio.to_thread(process_service.list_processes, filter)
    return processes[:limit]


@router.get("/{pid}", response_model=ProcessBase)
async def get_process(pid: int):
    return process_service.get_process(pid)


@router.get("/{pid}/tree")
async def get_process_tree(pid: int):
    return process_service.get_process_tree(pid)


@router.get("/port/{port}", response_model=List[ProcessBase])
async def get_processes_by_port(port: int):
    return process_service.get_processes_by_port(port)


@router.post("/{pid}/action", response_model=ProcessActionResponse)
async def process_action(
    pid: int,
    action: ProcessAction,
    audit: AuditService = Depends(get_audit_service),
):
    result = await process_service.execute_action(pid, action)
    await audit.log_action(
        resource_type="process",
        resource_name=str(pid),
        resource_id=str(pid),
        action=action.action,
        previous_state=result.previous_state,
        resulting_state=None,
        result="success" if result.success else "failed",
        error_details=result.error,
        user_identity="local",
        interface="api",
    )
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result