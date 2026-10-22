from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging

from app.config import get_settings
from app.database.session import init_db, close_db
from app.api.routes import system, docker, processes, drivers, network, metrics
from app.services.metrics_service import metrics_service

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system.router)
app.include_router(docker.router)
app.include_router(processes.router)
app.include_router(drivers.router)
app.include_router(network.router)
app.include_router(metrics.router)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.app_version}


@app.websocket("/ws/metrics")
async def websocket_metrics(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # get_system_metrics is blocking, run it outside the event loop
            metrics = await asyncio.to_thread(metrics_service.get_system_metrics)
            await websocket.send_json({
                "type": "metrics_update",
                # `mode="json"` keeps the datetimes JSON serializable
                "data": metrics.model_dump(mode="json"),
            })
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WebSocket /ws/metrics failed")
        await websocket.close()


@app.websocket("/ws/overview")
async def websocket_overview(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            overview = await metrics_service.get_overview()
            await websocket.send_json({
                "type": "overview_update",
                "data": overview.model_dump(mode="json"),
            })
            await asyncio.sleep(15)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WebSocket /ws/overview failed")
        await websocket.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        workers=settings.api_workers,
        reload=settings.debug,
    )