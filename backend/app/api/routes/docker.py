import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional

from app.services import docker_service
from app.services.audit_service import AuditService, get_audit_service
from app.models.docker import (
    ContainerBase, ContainerAction, ContainerActionResponse,
    DockerNetwork, DockerVolume, DockerInfo
)

router = APIRouter(prefix="/api/docker", tags=["docker"])


@router.get("/containers", response_model=List[ContainerBase])
async def list_containers(all: bool = Query(True)):
    # The docker stats calls block for a second per container, so they run in a
    # worker thread instead of stalling the event loop.
    return await asyncio.to_thread(docker_service.list_containers, all)


@router.get("/containers/{container_id}", response_model=ContainerBase)
async def get_container(container_id: str):
    return docker_service.get_container(container_id)


@router.post("/containers/{container_id}/action", response_model=ContainerActionResponse)
async def container_action(
    container_id: str,
    action: ContainerAction,
    audit: AuditService = Depends(get_audit_service),
):
    result = await docker_service.execute_action(container_id, action)
    await audit.log_action(
        resource_type="container",
        resource_name=container_id,
        resource_id=container_id,
        action=action.action,
        previous_state=result.previous_state,
        resulting_state=result.new_state,
        result="success" if result.success else "failed",
        error_details=result.error,
        user_identity="local",
        interface="api",
    )
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result


@router.get("/containers/{container_id}/logs")
async def get_container_logs(
    container_id: str,
    tail: int = Query(100, ge=1, le=5000),
    since: Optional[str] = Query(None),
    until: Optional[str] = Query(None),
):
    logs = await docker_service.get_logs(container_id, tail=tail, since=since, until=until)
    return {"container": container_id, "logs": logs}


@router.post("/containers/{container_id}/restart-policy")
async def update_restart_policy(
    container_id: str,
    policy: str,
    audit: AuditService = Depends(get_audit_service),
):
    from app.models.docker import RestartPolicy
    result = await docker_service.update_restart_policy(container_id, RestartPolicy(policy))
    await audit.log_action(
        resource_type="container",
        resource_name=container_id,
        resource_id=container_id,
        action="update",
        previous_state=None,
        resulting_state=policy,
        result="success" if result.success else "failed",
        error_details=result.error,
        user_identity="local",
        interface="api",
    )
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result


@router.get("/networks", response_model=List[DockerNetwork])
async def list_networks():
    return docker_service.list_networks()


@router.get("/volumes", response_model=List[DockerVolume])
async def list_volumes():
    return docker_service.list_volumes()


@router.get("/info", response_model=DockerInfo)
async def get_info():
    return docker_service.get_info()