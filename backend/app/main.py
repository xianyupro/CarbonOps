"""CarbonOps FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.db.base import Base
from app.db.session import engine
from app.mock.seed import run_seed

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s | %(message)s")
logger = logging.getLogger("carbonops")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Import models so they register on Base.metadata
    from app import models  # noqa: F401

    logger.info("Creating database tables if needed ...")
    Base.metadata.create_all(bind=engine)

    if settings.SEED_ON_STARTUP:
        logger.info("Seeding database (RBAC + presets + time-series) ...")
        from app.db.session import SessionLocal
        db = SessionLocal()
        try:
            run_seed(db)
        finally:
            db.close()
        logger.info("Seed finished.")
    yield


app = FastAPI(
    title="全流程低碳运行智能监测与调控系统平台",
    version="1.0.0",
    description="全流程低碳运行智能监测与调控系统平台 — 后端 API 接口",
    lifespan=lifespan,
)

# CORS
# Use allow_origin_regex when wildcard is set, since Starlette disallows
# allow_origins=["*"] with allow_credentials=True.
_cors_args = {
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if "*" in settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r".*",
        **_cors_args,
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        **_cors_args,
    )

# Exception handlers
register_exception_handlers(app)

# REST routers
from app.api.v1 import router as v1_router  # noqa: E402
app.include_router(v1_router, prefix=settings.API_V1_PREFIX)

# WebSocket routers
from app.ws.realtime import router as ws_router  # noqa: E402
app.include_router(ws_router, prefix="/ws")


@app.get("/", tags=["health"])
def root():
    return {"app": settings.APP_NAME, "status": "running", "docs": "/docs"}


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
