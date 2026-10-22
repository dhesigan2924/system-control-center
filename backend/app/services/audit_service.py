from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.database.session import get_db, AuditLog, ServiceSnapshot
from app.models.audit import (
    AuditLogCreate, AuditLogResponse, AuditFilter, AuditStats,
    AuditAction, AuditResult
)


class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log_action(self, log: AuditLogCreate) -> AuditLogResponse:
        audit_log = AuditLog(
            resource_type=log.resource_type,
            resource_name=log.resource_name,
            resource_id=log.resource_id,
            action=log.action.value,
            previous_state=log.previous_state,
            resulting_state=log.resulting_state,
            result=log.result.value,
            error_details=log.error_details,
            user_identity=log.user_identity,
            interface=log.interface,
        )
        self.db.add(audit_log)
        await self.db.commit()
        await self.db.refresh(audit_log)
        return AuditLogResponse.model_validate(audit_log)

    async def get_logs(self, filter: AuditFilter) -> List[AuditLogResponse]:
        query = select(AuditLog)

        conditions = []
        if filter.resource_type:
            conditions.append(AuditLog.resource_type == filter.resource_type)
        if filter.resource_name:
            conditions.append(AuditLog.resource_name.ilike(f"%{filter.resource_name}%"))
        if filter.action:
            conditions.append(AuditLog.action == filter.action.value)
        if filter.result:
            conditions.append(AuditLog.result == filter.result.value)
        if filter.user_identity:
            conditions.append(AuditLog.user_identity == filter.user_identity)
        if filter.start_time:
            conditions.append(AuditLog.timestamp >= filter.start_time)
        if filter.end_time:
            conditions.append(AuditLog.timestamp <= filter.end_time)

        if conditions:
            query = query.where(and_(*conditions))

        query = query.order_by(AuditLog.timestamp.desc())
        query = query.limit(filter.limit).offset(filter.offset)

        result = await self.db.execute(query)
        logs = result.scalars().all()
        return [AuditLogResponse.model_validate(log) for log in logs]

    async def get_stats(self) -> AuditStats:
        total = await self.db.scalar(select(func.count(AuditLog.id)))
        success = await self.db.scalar(
            select(func.count(AuditLog.id)).where(AuditLog.result == AuditResult.SUCCESS.value)
        )
        failed = await self.db.scalar(
            select(func.count(AuditLog.id)).where(AuditLog.result == AuditResult.FAILED.value)
        )
        denied = await self.db.scalar(
            select(func.count(AuditLog.id)).where(AuditLog.result == AuditResult.DENIED.value)
        )

        action_result = await self.db.execute(
            select(AuditLog.action, func.count(AuditLog.id))
            .group_by(AuditLog.action)
        )
        by_action = dict(action_result.all())

        resource_result = await self.db.execute(
            select(AuditLog.resource_type, func.count(AuditLog.id))
            .group_by(AuditLog.resource_type)
        )
        by_resource_type = dict(resource_result.all())

        user_result = await self.db.execute(
            select(AuditLog.user_identity, func.count(AuditLog.id))
            .group_by(AuditLog.user_identity)
        )
        by_user = dict(user_result.all())

        recent_failures_result = await self.db.execute(
            select(AuditLog)
            .where(AuditLog.result == AuditResult.FAILED.value)
            .order_by(AuditLog.timestamp.desc())
            .limit(10)
        )
        recent_failures = [
            AuditLogResponse.model_validate(log)
            for log in recent_failures_result.scalars().all()
        ]

        return AuditStats(
            total_events=total or 0,
            success_count=success or 0,
            failed_count=failed or 0,
            denied_count=denied or 0,
            by_action=by_action,
            by_resource_type=by_resource_type,
            by_user=by_user,
            recent_failures=recent_failures,
        )

    async def snapshot_service(self, service_name: str, service_type: str, status: str,
                               pid: Optional[int] = None, cpu_percent: Optional[float] = None,
                               memory_kb: Optional[int] = None, uptime_seconds: Optional[int] = None):
        snapshot = ServiceSnapshot(
            service_name=service_name,
            service_type=service_type,
            status=status,
            pid=pid,
            cpu_percent=int(cpu_percent) if cpu_percent else None,
            memory_kb=memory_kb,
            uptime_seconds=uptime_seconds,
        )
        self.db.add(snapshot)
        await self.db.commit()

    async def cleanup_old_logs(self, days: int = 90):
        cutoff = datetime.utcnow() - timedelta(days=days)
        await self.db.execute(
            select(AuditLog).where(AuditLog.timestamp < cutoff)
        )
        await self.db.commit()


async def get_audit_service(db: AsyncSession = Depends(get_db)) -> AuditService:
    return AuditService(db)