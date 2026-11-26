"""
DermaSathiAI — Skin Analysis Service
=======================================
Business logic layer orchestrating the ML inference pipeline.
Separates API concerns from ML implementation.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

from app.ml.skin.config_loader import load_model_config, resolve_path
from app.ml.skin.inference.inference_engine import InferenceEngine
from app.ml.skin.schemas.prediction_schema import PredictionResult

logger = logging.getLogger(__name__)


class SkinAnalysisService:
    """
    Service layer for skin disease analysis.

    Manages model lifecycle and provides the interface
    that API endpoints call.
    """

    def __init__(self):
        self._engine: Optional[InferenceEngine] = None
        self._is_ready: bool = False

    @property
    def is_ready(self) -> bool:
        """Check if the service has a loaded model."""
        return self._is_ready

    def initialize(
        self,
        model_name: str = "inception_v3",
        model_dir: Optional[Path] = None,
    ) -> None:
        """
        Initialize the inference engine with a trained model.

        Parameters
        ----------
        model_name : str
            Model architecture to load.
        model_dir : Path, optional
            Explicit model directory. If None, uses registry.
        """
        try:
            config = load_model_config(model_name)
            self._engine = InferenceEngine(config)

            registry_dir = resolve_path(config["paths"]["trained_models_dir"])

            self._engine.load_model(
                model_name=model_name,
                model_dir=model_dir,
                registry_dir=registry_dir,
            )
            self._is_ready = True
            logger.info("Skin analysis service initialized: model=%s", model_name)

        except FileNotFoundError as e:
            logger.warning(
                "Could not load model '%s': %s. "
                "Service will return model_unavailable until a model is trained.",
                model_name,
                e,
            )
            self._is_ready = False

        except Exception as e:
            logger.error("Failed to initialize skin analysis service: %s", e)
            self._is_ready = False

    async def analyze_image(self, image_bytes: bytes) -> PredictionResult:
        """
        Analyze a skin image.

        Parameters
        ----------
        image_bytes : bytes
            Raw image file bytes.

        Returns
        -------
        PredictionResult
            Structured prediction result.
        """
        if not self._is_ready or self._engine is None:
            from app.ml.skin.schemas.prediction_schema import PredictionStatus
            return PredictionResult(
                status=PredictionStatus.MODEL_UNAVAILABLE,
                reason="ML model not loaded. Please check server logs.",
                requires_professional_review=True,
            )

        return self._engine.predict(image_bytes)


# Singleton instance for the application
skin_analysis_service = SkinAnalysisService()
