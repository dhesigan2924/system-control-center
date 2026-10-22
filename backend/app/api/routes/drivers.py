from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional

from app.services import driver_service
from app.services.audit_service import AuditService, get_audit_service
from app.models.drivers import (
    KernelModuleBase, ModuleAction, ModuleActionResponse,
    HardwareDevice, DriverInfo
)

router = APIRouter(prefix="/api/drivers", tags=["drivers"])


@router.get("/modules", response_model=List[KernelModuleBase])
async def list_modules():
    return await driver_service.list_modules()


@router.get("/modules/{name}", response_model=KernelModuleBase)
async def get_module(name: str):
    return await driver_service.get_module_info(name)


@router.get("/modules/{name}/info", response_model=DriverInfo)
async def get_module_info(name: str):
    return await driver_service.get_driver_info(name)


@router.post("/modules/{name}/action", response_model=ModuleActionResponse)
async def module_action(
    name: str,
    action: ModuleAction,
    audit: AuditService = Depends(get_audit_service),
):
    result = await driver_service.execute_action(name, action)
    await audit.log_action(
        resource_type="kernel_module",
        resource_name=name,
        resource_id=name,
        action=action.action,
        previous_state=None,
        resulting_state=None,
        result="success" if result.success else "failed",
        error_details=result.error,
        user_identity="local",
        interface="api",
    )
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result


@router.get("/hardware", response_model=List[HardwareDevice])
async def list_hardware():
    return await driver_service.list_hardware_devices()