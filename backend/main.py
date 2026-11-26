from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from app.core.config import settings
from app.api.v1.router import router as v1_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler — loads V1 + V2 skin AI models at startup."""
    try:
        from app.ml.skin import skin_ai_loader
        skin_ai_loader.load_models()
        logger.info("Dual-model skin AI pipeline loaded successfully.")
    except Exception as e:
        logger.warning(
            "Skin AI models could not be loaded at startup: %s. "
            "The /skin/analyze endpoint will return model_unavailable until resolved.",
            e,
        )
    yield
from app.ml.demo_router import router as demo_ai_router


app = FastAPI(
    title="DermaSathi AI",
    description="AI-powered dermatology healthcare assistant",
    version="0.1.0",
    lifespan=lifespan,
)

# Include API v1 routes
app.include_router(v1_router)



@app.get("/health")
def health_check():
    return {"status" : "healthy",
            "application_name" : settings.app_name,
            "version" : settings.app_version
            }

app.include_router(demo_ai_router, prefix="/api/v1")
