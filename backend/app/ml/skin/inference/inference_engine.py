"""
DermaSathiAI — Inference Engine
==================================
End-to-end inference: image → quality gate → preprocess → model → calibrate → response.

This is the main entry point for production inference.
It orchestrates all pipeline components and returns a structured result.
"""

from __future__ import annotations

import io
import json
import logging
import time
from pathlib import Path
from typing import Any, Optional, Union

import numpy as np
from PIL import Image

from app.ml.skin.calibration.calibrator import TemperatureCalibrator
from app.ml.skin.models.base_model import BaseSkinModel
from app.ml.skin.models.model_factory import create_model
from app.ml.skin.preprocessing.image_preprocessor import ImagePreprocessor
from app.ml.skin.quality.image_quality_gate import ImageQualityGate
from app.ml.skin.registry.model_registry import ModelRegistry
from app.ml.skin.schemas.prediction_schema import (
    ClassPrediction,
    ImageQualityResult,
    PredictionResult,
    PredictionStatus,
    QualityStatus,
)

logger = logging.getLogger(__name__)


class InferenceEngine:
    """
    Production inference engine for skin disease classification.

    Manages:
    - Model loading from registry
    - Image quality assessment
    - Preprocessing
    - Model inference
    - Confidence calibration
    - Abstention logic
    - Structured response generation
    """

    def __init__(self, config: dict[str, Any]):
        self.config = config
        inf_cfg = config.get("inference", {})

        self.default_model_name: str = inf_cfg.get("default_model", "inception_v3")
        self.top_k: int = inf_cfg.get("top_k", 3)
        self.enable_calibration: bool = inf_cfg.get("enable_calibration", True)

        # Components (lazy-loaded)
        self._quality_gate: Optional[ImageQualityGate] = None
        self._preprocessor: Optional[ImagePreprocessor] = None
        self._model: Optional[BaseSkinModel] = None
        self._calibrator: Optional[TemperatureCalibrator] = None
        self._class_mapping: dict[str, int] = {}
        self._index_to_class: dict[int, str] = {}
        self._model_version: Optional[str] = None

    @property
    def quality_gate(self) -> ImageQualityGate:
        if self._quality_gate is None:
            self._quality_gate = ImageQualityGate(
                self.config.get("quality_gate", {})
            )
        return self._quality_gate

    @property
    def preprocessor(self) -> ImagePreprocessor:
        if self._preprocessor is None:
            self._preprocessor = ImagePreprocessor(self.config)
        return self._preprocessor

    @property
    def calibrator(self) -> TemperatureCalibrator:
        if self._calibrator is None:
            self._calibrator = TemperatureCalibrator(self.config)
        return self._calibrator

    def load_model(
        self,
        model_name: Optional[str] = None,
        model_dir: Optional[Path] = None,
        registry_dir: Optional[Path] = None,
    ) -> None:
        """
        Load a trained model for inference.

        Parameters
        ----------
        model_name : str, optional
            Model to load. Defaults to config default.
        model_dir : Path, optional
            Explicit directory containing model artifacts.
        registry_dir : Path, optional
            Registry root to find latest model version.
        """
        model_name = model_name or self.default_model_name

        if model_dir is None and registry_dir is not None:
            registry = ModelRegistry(registry_dir)
            model_dir = registry.get_latest_model_dir(model_name)

        if model_dir is None:
            raise FileNotFoundError(
                f"No model found for '{model_name}'. "
                "Provide model_dir or registry_dir."
            )

        # Load class mapping
        mapping_path = model_dir / "class_mapping.json"
        if mapping_path.exists():
            with open(mapping_path) as f:
                self._class_mapping = json.load(f)
            self._index_to_class = {v: k for k, v in self._class_mapping.items()}

        # Create and load model
        self._model = create_model(model_name, self.config)
        self._model.load(model_dir)

        # Load calibration if available
        if self.enable_calibration:
            cal_path = model_dir / "calibration_params.json"
            if cal_path.exists():
                self.calibrator.load(model_dir)

        # Version
        meta_path = model_dir / "registry_meta.json"
        if meta_path.exists():
            with open(meta_path) as f:
                meta = json.load(f)
            self._model_version = meta.get("version")
        else:
            self._model_version = model_dir.name

        logger.info(
            "Inference engine ready: model=%s, version=%s, classes=%d",
            model_name,
            self._model_version,
            len(self._class_mapping),
        )

    def predict(
        self,
        image_input: Union[bytes, str, Path, Image.Image],
        skip_quality_check: bool = False,
    ) -> PredictionResult:
        """
        Run the full inference pipeline on an image.

        Parameters
        ----------
        image_input : bytes | str | Path | PIL.Image
            The image to analyze.
        skip_quality_check : bool
            If True, skip quality gate (e.g., for batch evaluation).

        Returns
        -------
        PredictionResult
            Complete structured prediction result.
        """
        start_time = time.time()

        # --- Check model availability ---
        if self._model is None:
            return PredictionResult(
                status=PredictionStatus.MODEL_UNAVAILABLE,
                reason="No model loaded. Call load_model() first.",
                requires_professional_review=True,
            )

        # --- Load image ---
        try:
            if isinstance(image_input, bytes):
                pil_image = Image.open(io.BytesIO(image_input))
                pil_image.load()
            elif isinstance(image_input, (str, Path)):
                pil_image = Image.open(image_input)
                pil_image.load()
            elif isinstance(image_input, Image.Image):
                pil_image = image_input
            else:
                return PredictionResult(
                    status=PredictionStatus.IMAGE_REJECTED,
                    reason="Unsupported image input type.",
                    requires_professional_review=True,
                )
        except Exception as exc:
            return PredictionResult(
                status=PredictionStatus.IMAGE_REJECTED,
                reason=f"Cannot read image: {exc}",
                requires_professional_review=True,
            )

        # --- Quality gate ---
        quality_result = None
        if not skip_quality_check:
            quality_result = self.quality_gate.assess(pil_image)

            if quality_result.quality_status in (
                QualityStatus.CORRUPT,
                QualityStatus.REJECTED,
            ):
                elapsed = (time.time() - start_time) * 1000
                return PredictionResult(
                    status=PredictionStatus.IMAGE_REJECTED,
                    quality_result=quality_result,
                    reason=quality_result.user_action or "Image quality insufficient.",
                    requires_professional_review=True,
                    processing_time_ms=round(elapsed, 1),
                )

        # --- Preprocess ---
        preprocessed = self.preprocessor.preprocess_for_inference(pil_image)

        # --- Model inference ---
        raw_proba = self._model.predict(preprocessed)[0]  # Remove batch dim

        # --- Calibration ---
        if self.enable_calibration:
            calibrated_proba = self.calibrator.calibrate(
                raw_proba.reshape(1, -1)
            )[0]
        else:
            calibrated_proba = raw_proba

        # --- Uncertainty ---
        uncertainty = self.calibrator.compute_uncertainty(calibrated_proba)

        # --- Top-K predictions ---
        top_indices = np.argsort(calibrated_proba)[::-1][: self.top_k]
        top_predictions = []
        for idx in top_indices:
            class_name = self._index_to_class.get(int(idx), f"class_{idx}")
            top_predictions.append(
                ClassPrediction(
                    class_name=class_name,
                    class_index=int(idx),
                    raw_probability=round(float(raw_proba[idx]), 4),
                )
            )

        # --- Abstention check ---
        should_abstain, abstain_reason = self.calibrator.should_abstain(
            calibrated_proba, uncertainty
        )

        # --- Build result ---
        primary_idx = int(np.argmax(calibrated_proba))
        primary_class = self._index_to_class.get(primary_idx, f"class_{primary_idx}")
        elapsed = (time.time() - start_time) * 1000

        if should_abstain:
            return PredictionResult(
                status=PredictionStatus.ASSESSMENT_UNAVAILABLE,
                model_name=self._model.model_name,
                model_version=self._model_version,
                prediction=primary_class,
                top_predictions=top_predictions,
                raw_probability=round(float(raw_proba[primary_idx]), 4),
                calibrated_confidence=round(float(calibrated_proba[primary_idx]), 4),
                uncertainty=round(uncertainty, 4),
                requires_professional_review=True,
                reason=abstain_reason,
                quality_result=quality_result,
                processing_time_ms=round(elapsed, 1),
            )

        return PredictionResult(
            status=PredictionStatus.ASSESSMENT_AVAILABLE,
            model_name=self._model.model_name,
            model_version=self._model_version,
            prediction=primary_class,
            top_predictions=top_predictions,
            raw_probability=round(float(raw_proba[primary_idx]), 4),
            calibrated_confidence=round(float(calibrated_proba[primary_idx]), 4),
            uncertainty=round(uncertainty, 4),
            requires_professional_review=True,  # Always true — not a diagnostic tool
            quality_result=quality_result,
            processing_time_ms=round(elapsed, 1),
        )
