from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional

from app.services import network_service
from app.models.network import (
    NetworkPortBase, PortFilter, Protocol, PortState,
    NetworkInterface, NetworkConnection
)

router = APIRouter(prefix="/api/network", tags=["network"])


@router.get("/ports", response_model=List[NetworkPortBase])
async def list_ports(
    protocol: Optional[Protocol] = Query(None),
    state: Optional[PortState] = Query(None),
    port: Optional[int] = Query(None),
    pid: Optional[int] = Query(None),
    process_name: Optional[str] = Query(None),
    local_only: bool = Query(False),
    external_only: bool = Query(False),
):
    filter = PortFilter(
        protocol=protocol,
        state=state,
        port=port,
        pid=pid,
        process_name=process_name,
        local_only=local_only,
        external_only=external_only,
    )
    return await network_service.list_listening_ports(filter)


@router.get("/ports/{port}/{protocol}", response_model=NetworkPortBase)
async def get_port(port: int, protocol: Protocol):
    port_info = await network_service.get_port_details(port, protocol)
    if not port_info:
        raise HTTPException(status_code=404, detail="Port not found")
    return port_info


@router.get("/interfaces", response_model=List[NetworkInterface])
async def list_interfaces():
    return await network_service.list_interfaces()


@router.get("/connections", response_model=List[NetworkConnection])
async def list_connections():
    return await network_service.list_connections()