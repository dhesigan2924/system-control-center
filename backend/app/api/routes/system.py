from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from typing import List, Optional
from datetime import datetime

from app.services import systemd_service
from app.services.audit_service import AuditService, get_audit_service
from app.models.system import ServiceResponse, ServiceAction, ServiceActionResponse
from app.models.audit import AuditFilter, AuditLogResponse, AuditStats

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/services", response_model=List[ServiceResponse])
async def list_services(
    all: bool = Query(True, description="Include inactive services"),
    state: Optional[str] = Query(None, description="Filter by state"),
):
    services = await systemd_service.list_units(all_units=all)
    if state:
        services = [s for s in services if s.state.value == state]
    return services


@router.get("/services/{name}", response_model=ServiceResponse)
async def get_service(name: str):
    return await systemd_service.get_unit(name)


@router.post("/services/{name}/action", response_model=ServiceActionResponse)
async def service_action(
    name: str,
    action: ServiceAction,
    audit: AuditService = Depends(get_audit_service),
):
    result = await systemd_service.execute_action(name, action)
    await audit.log_action(
        resource_type="service",
        resource_name=name,
        resource_id=name,
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


@router.get("/services/{name}/logs")
async def get_service_logs(
    name: str,
    lines: int = Query(100, ge=1, le=5000),
    since: Optional[str] = Query(None),
):
    logs = await systemd_service.get_logs(name, lines=lines, since=since)
    return {"service": name, "logs": logs}


@router.get("/audit", response_model=List[AuditLogResponse])
async def get_audit_logs(
    resource_type: Optional[str] = Query(None),
    resource_name: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    result: Optional[str] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    audit: AuditService = Depends(get_audit_service),
):
    filter = AuditFilter(
        resource_type=resource_type,
        resource_name=resource_name,
        action=action,
        result=result,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
        offset=offset,
    )
    return await audit.get_logs(filter)


@router.get("/audit/stats", response_model=AuditStats)
async def get_audit_stats(audit: AuditService = Depends(get_audit_service)):
    return await audit.get_stats()


@router.websocket("/ws/services")
async def websocket_services(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            services = await systemd_service.list_units(all_units=True)
            await websocket.send_json({
                "type": "services_update",
                "data": [s.model_dump() for s in services],
                "timestamp": datetime.now().isoformat(),
            })
            await asyncio.sleep(15)
    except WebSocketDisconnect:
        pass
    except Exception:
        await websocket.close()