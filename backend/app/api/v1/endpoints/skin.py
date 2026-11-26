"""Legacy import-compatible endpoint wrapper; not included in the current v1 router."""

from fastapi import APIRouter, UploadFile, File, HTTPException, status

from app.core.config import settings
from app.services.skin_pipeline import skin_pipeline
from app.services.ai_provider_manager import AIProvidersUnavailable

router = APIRouter()
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/analyze", summary="Analyze skin image")
async def analyze_skin(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=415, detail="Please upload a JPEG, PNG, or WebP image.")
    contents = await file.read(settings.MAX_UPLOAD_SIZE_BYTES + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded image file is empty.")
    if len(contents) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded image exceeds the permitted size.")
    try:
        return await skin_pipeline.process_image(contents, image_mime_type=file.content_type)
    except AIProvidersUnavailable as exc:
        raise HTTPException(status_code=503, detail="Skin image assessment is temporarily unavailable.") from exc
