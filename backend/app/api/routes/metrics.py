from fastapi import APIRouter, Depends
from typing import List

from app.services import metrics_service
from app.services.audit_service import AuditService, get_audit_service
from app.models.metrics import SystemMetrics, SystemOverview, MetricsHistory

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


@router.get("/system", response_model=SystemMetrics)
async def get_system_metrics():
    return metrics_service.get_system_metrics()


@router.get("/overview", response_model=SystemOverview)
async def get_overview():
    return await metrics_service.get_overview()


@router.get("/history", response_model=MetricsHistory)
async def get_history():
    return metrics_service.get_history()


@router.get("/service/{service_name}")
async def get_service_metrics(service_name: str):
    metrics = await metrics_service.get_service_metrics(service_name)
    if not metrics:
        return {"error": "Service metrics not available"}
    return metrics