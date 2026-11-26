"""Database readiness and backend health endpoint."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.db.session import get_db

router = APIRouter()


@router.get("/status", summary="Backend and database health")
def system_health_status(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        logger.exception("Database health check failed.")

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "degraded",
                "service": settings.PROJECT_NAME,
                "database": "unhealthy",
            },
        ) from exc

    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "database": "healthy",
        "ml_subsystem": {
            "model_path": None,
            "weights_loaded": False,
            "status_message": (
                "Local model execution is disabled. "
                "External AI provider integration is being configured."
            ),
        },
    }
