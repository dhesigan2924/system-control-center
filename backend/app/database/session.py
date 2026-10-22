from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.database_echo,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    resource_type = Column(String(50), index=True)
    resource_name = Column(String(255), index=True)
    resource_id = Column(String(255), index=True)
    action = Column(String(50), index=True)
    previous_state = Column(String(50), nullable=True)
    resulting_state = Column(String(50), nullable=True)
    result = Column(String(20), index=True)
    error_details = Column(Text, nullable=True)
    user_identity = Column(String(100), nullable=True)
    interface = Column(String(100), nullable=True)

    __table_args__ = (
        Index("ix_audit_timestamp_resource", "timestamp", "resource_type"),
        Index("ix_audit_user_timestamp", "user_identity", "timestamp"),
    )


class ServiceSnapshot(Base):
    __tablename__ = "service_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    service_name = Column(String(255), index=True)
    service_type = Column(String(50), index=True)
    status = Column(String(50))
    pid = Column(Integer, nullable=True)
    cpu_percent = Column(Integer, nullable=True)
    memory_kb = Column(Integer, nullable=True)
    uptime_seconds = Column(Integer, nullable=True)

    __table_args__ = (
        Index("ix_snapshot_timestamp_service", "timestamp", "service_name"),
    )


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    await engine.dispose()