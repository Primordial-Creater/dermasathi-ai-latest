"""Canonical FastAPI application for DermaSathiAI.

Alembic is the sole schema migration mechanism. This module deliberately does
not load local ML weights during startup; optional AI providers are initialized
lazily by their service layer so the API can start without model artifacts.
"""

import importlib
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import logger
from app.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Import every ORM module so Base.metadata is complete for Alembic and
    # runtime metadata inspection. Never call create_all() here.
    for module_name in (
        "app.models.audit",
        "app.models.consultation",
        "app.models.persistence",
        "app.models.platform",
        "app.models.prescription",
        "app.models.user",
    ):
        importlib.import_module(module_name)

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        app.state.database_ready = True
        logger.info("%s database connectivity verified.", settings.PROJECT_NAME)
    except Exception:
        app.state.database_ready = False
        logger.exception(
            "%s database connectivity check failed at startup.",
            settings.PROJECT_NAME,
        )

    logger.info(
        "%s backend started in %s mode.",
        settings.PROJECT_NAME,
        settings.ENVIRONMENT,
    )
    yield
    logger.info("Shutting down %s...", settings.PROJECT_NAME)
    engine.dispose()


app = FastAPI(
    title="DERMASATHIAI - Clinical Support & Triage API",
    description=(
        "Multilingual AI healthcare companion. Assistive information only; "
        "not a replacement for qualified medical professionals."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Do not return exception text, secrets, SQL, or stack traces to clients.
    logger.exception(
        "Unhandled server error on %s %s",
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal service error occurred. Please try again later.",
            "error_code": "INTERNAL_SERVER_ERROR",
        },
    )


app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "platform": settings.PROJECT_NAME,
        "purpose": "Multilingual AI healthcare companion initially focused on Indian users",
        "api_v1_docs": "/docs",
        "health_check": f"{settings.API_V1_STR}/health/status",
        "safety_disclaimer": (
            "This service provides assistive information and does not provide formal diagnoses."
        ),
    }
