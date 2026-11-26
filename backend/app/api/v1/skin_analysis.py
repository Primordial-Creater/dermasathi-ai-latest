"""
DermaSathiAI — Skin Analysis API Endpoint
============================================
POST /api/v1/skin/analyze

Accepts an image upload and returns a structured skin disease assessment.
This is NOT a medical diagnosis endpoint.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.skin_analysis import (
    SkinAnalysisErrorResponse,
    SkinAnalysisQualityInfo,
    SkinAnalysisResponse,
    SkinAnalysisTopPrediction,
)
from app.services.skin_analysis_service import skin_analysis_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/skin", tags=["Skin Analysis"])

# Maximum upload size: 50 MB
MAX_FILE_SIZE = 50 * 1024 * 1024


@router.post(
    "/analyze",
    response_model=SkinAnalysisResponse,
    responses={
        400: {"model": SkinAnalysisErrorResponse},
        503: {"model": SkinAnalysisErrorResponse},
    },
    summary="Analyze skin image",
    description=(
        "Upload a skin image for AI-assisted analysis. "
        "Returns a structured assessment with confidence scores and uncertainty. "
        "This is NOT a medical diagnosis. Professional review is always required."
    ),
)
async def analyze_skin_image(
    file: UploadFile = File(..., description="Skin image to analyze"),
):
    """
    Analyze a skin image for potential conditions.

    The response always includes:
    - requires_professional_review: True (always)
    - disclaimer: Medical disclaimer text

    The response will abstain from prediction when:
    - Image quality is insufficient
    - Model confidence is too low
    - Model is unavailable
    """
    # --- Validate upload ---
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Please upload an image.",
        )

    # Read file bytes
    image_bytes = await file.read()

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(image_bytes)} bytes). Maximum: {MAX_FILE_SIZE} bytes.",
        )

    # --- Run analysis ---
    try:
        result = await skin_analysis_service.analyze_image(image_bytes)
    except Exception as e:
        logger.error("Skin analysis error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal error during image analysis. Please try again.",
        )

    # --- Build response ---
    quality_info = None
    if result.quality_result is not None:
        quality_info = SkinAnalysisQualityInfo(
            quality_status=result.quality_result.quality_status,
            quality_score=result.quality_result.quality_score,
            issues=[str(i) for i in result.quality_result.issues],
            user_action=result.quality_result.user_action,
        )

    top_preds = [
        SkinAnalysisTopPrediction(
            class_name=p.class_name,
            class_index=p.class_index,
            raw_probability=p.raw_probability,
        )
        for p in result.top_predictions
    ]

    return SkinAnalysisResponse(
        status=result.status,
        model_name=result.model_name,
        model_version=result.model_version,
        prediction=result.prediction,
        top_predictions=top_preds,
        raw_probability=result.raw_probability,
        calibrated_confidence=result.calibrated_confidence,
        uncertainty=result.uncertainty,
        requires_professional_review=True,
        reason=result.reason,
        quality=quality_info,
        processing_time_ms=result.processing_time_ms,
    )


@router.get(
    "/status",
    summary="Check skin analysis service status",
)
async def get_service_status():
    """Check whether the ML model is loaded and ready."""
    return {
        "service_ready": skin_analysis_service.is_ready,
        "message": (
            "Model loaded and ready for inference."
            if skin_analysis_service.is_ready
            else "Model not loaded. Train and deploy a model first."
        ),
    }
