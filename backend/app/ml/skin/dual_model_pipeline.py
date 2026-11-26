"""
DermaSathiAI — Dual-Model Inference Pipeline
==============================================
Implements the two-stage skin analysis architecture:

  IMAGE
    → image quality validation (ImageQualityGate)
    → V2 open-set model (15 classes incl. OTHER_UNSUPPORTED)
    → if V2 predicts OTHER_UNSUPPORTED  →  abstain / unsupported response
    → otherwise V1 disease classifier (14 classes)
    → confidence + safety policy
    → structured response

Safety guarantees:
- Unsupported conditions (e.g. acne) are caught by V2 and do NOT fall
  through to a forced disease prediction.
- High-risk classes (BCC, Melanoma, SCC) apply a conservative confidence
  threshold; insufficient confidence → abstain.
- The system can always abstain — no silent forced classification.

This module is pure Python / NumPy and calls the loaded Keras models
via the singleton from skin_ai_loader. It does NOT touch the training
infrastructure (model_factory, base_model, calibrator, etc.).
"""

from __future__ import annotations

import io
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import numpy as np
from PIL import Image

from app.ml.skin import skin_ai_loader
from app.ml.skin.quality.image_quality_gate import ImageQualityGate
from app.ml.skin.resnet_preprocess import preprocess_image
from app.ml.skin.schemas.prediction_schema import (
    ImageQualityResult,
    QualityStatus,
)

logger = logging.getLogger(__name__)


# ── Constants ─────────────────────────────────────────────────────────────────

#: V2 class name used to signal an unsupported / out-of-distribution image.
OTHER_UNSUPPORTED_CLASS = "OTHER_UNSUPPORTED"

#: Minimum V2 max probability required to accept the image as supported.
#: Derived from the raw-probability validation sweep already completed.
V2_MIN_ACCEPT_PROBABILITY: float = 0.30

#: High-risk disease names that require extra-conservative confidence policy.
HIGH_RISK_CLASSES: frozenset[str] = frozenset(
    {
        "Basal cell carcinoma",
        "Melanoma",
        "Squamous cell carcinoma",
    }
)

# Confidence thresholds (all calibrated via temperature scaling)
#: Minimum calibrated confidence to report any supported prediction.
DEFAULT_CONFIDENCE_THRESHOLD: float = 0.50

#: Higher bar for high-risk classes.
HIGH_RISK_CONFIDENCE_THRESHOLD: float = 0.60

#: Below this, we always abstain regardless of class.
ABSOLUTE_ABSTENTION_THRESHOLD: float = 0.35

#: Temperature for post-hoc calibration (softens raw softmax).
DEFAULT_TEMPERATURE: float = 1.0

#: Maximum normalised predictive entropy before we abstain.
# This remains conservative and is evaluated again below.
MAX_ENTROPY_THRESHOLD: float = 0.80


# ── Result types ──────────────────────────────────────────────────────────────

class AnalysisStatus(str, Enum):
    """Status of the dual-model analysis."""
    ASSESSMENT_AVAILABLE = "assessment_available"
    ASSESSMENT_UNAVAILABLE = "assessment_unavailable"   # abstain / uncertain
    UNSUPPORTED_CONDITION = "unsupported_condition"     # V2 → OTHER
    IMAGE_REJECTED = "image_rejected"
    MODEL_UNAVAILABLE = "model_unavailable"


@dataclass
class TopPrediction:
    """A single ranked prediction from V1."""
    class_name: str
    class_index: int
    raw_probability: float
    calibrated_probability: float


@dataclass
class DualModelResult:
    """Complete structured result from the dual-model pipeline."""
    status: AnalysisStatus
    # Populated when status == ASSESSMENT_AVAILABLE
    predicted_class: Optional[str] = None
    top_predictions: list[TopPrediction] = field(default_factory=list)
    raw_probability: Optional[float] = None
    calibrated_confidence: Optional[float] = None
    uncertainty: Optional[float] = None
    is_high_risk: bool = False
    # Diagnostic info (always present)
    reason: Optional[str] = None
    quality_result: Optional[ImageQualityResult] = None
    # V2 gate info
    v2_predicted_class: Optional[str] = None
    v2_confidence: Optional[float] = None
    # Timing
    processing_time_ms: Optional[float] = None
    # Safety flag
    requires_professional_review: bool = True


# ── Quality gate (lazy singleton) ─────────────────────────────────────────────

_quality_gate: Optional[ImageQualityGate] = None


def _get_quality_gate() -> ImageQualityGate:
    global _quality_gate  # noqa: PLW0603
    if _quality_gate is None:
        _quality_gate = ImageQualityGate()
    return _quality_gate


# ── Calibration helpers ───────────────────────────────────────────────────────

def _temperature_scale(proba: np.ndarray, temperature: float = DEFAULT_TEMPERATURE) -> np.ndarray:
    """Apply temperature scaling to a softmax probability vector."""
    clipped = np.clip(proba, 1e-10, 1.0)
    logits = np.log(clipped) / temperature
    exp_l = np.exp(logits - logits.max())
    return (exp_l / exp_l.sum()).astype(np.float32)


def _predictive_entropy(proba: np.ndarray) -> float:
    """Normalised predictive entropy in [0, 1]. Higher = more uncertain."""
    clipped = np.clip(proba, 1e-10, 1.0)
    entropy = -float(np.sum(clipped * np.log(clipped)))
    max_entropy = float(np.log(len(clipped)))
    return entropy / max_entropy if max_entropy > 0 else 0.0


# ── Main pipeline ─────────────────────────────────────────────────────────────

def run_dual_model_pipeline(
    image_input: bytes | Image.Image,
    top_k: int = 3,
    skip_quality_check: bool = False,
) -> DualModelResult:
    """
    Execute the full two-stage inference pipeline.

    Parameters
    ----------
    image_input : bytes | PIL.Image
        Raw image data (bytes from upload) or a pre-loaded PIL image.
    top_k : int
        Number of top V1 predictions to include in result.
    skip_quality_check : bool
        Skip the quality gate (useful for batch evaluation / testing).

    Returns
    -------
    DualModelResult
        Fully structured analysis result.
    """
    t0 = time.perf_counter()

    # ── 0. Models availability ────────────────────────────────────────────────
    if not skin_ai_loader.is_ready():
        return DualModelResult(
            status=AnalysisStatus.MODEL_UNAVAILABLE,
            reason="ML models are not loaded. Please check server configuration.",
            processing_time_ms=_elapsed_ms(t0),
        )

    v1_model, v2_model, v1_idx2cls, v2_idx2cls, v2_other_idx = skin_ai_loader.get_models()

    # ── 1. Decode image ───────────────────────────────────────────────────────
    try:
        if isinstance(image_input, bytes):
            pil_image = Image.open(io.BytesIO(image_input))
            pil_image.load()
        elif isinstance(image_input, Image.Image):
            pil_image = image_input
        else:
            return DualModelResult(
                status=AnalysisStatus.IMAGE_REJECTED,
                reason="Unsupported image input type.",
                processing_time_ms=_elapsed_ms(t0),
            )
    except Exception as exc:
        logger.warning("Cannot decode image: %s", exc)
        return DualModelResult(
            status=AnalysisStatus.IMAGE_REJECTED,
            reason="Cannot read image file. Please upload a valid JPEG, PNG, or WebP image.",
            processing_time_ms=_elapsed_ms(t0),
        )

    # ── 2. Quality gate ───────────────────────────────────────────────────────
    quality_result: Optional[ImageQualityResult] = None
    if not skip_quality_check:
        gate = _get_quality_gate()
        quality_result = gate.assess(pil_image)

        if quality_result.quality_status in (
            QualityStatus.CORRUPT,
            QualityStatus.REJECTED,
        ):
            return DualModelResult(
                status=AnalysisStatus.IMAGE_REJECTED,
                reason=quality_result.user_action or "Image quality is insufficient for analysis.",
                quality_result=quality_result,
                processing_time_ms=_elapsed_ms(t0),
            )

    # ── 3. Preprocess ─────────────────────────────────────────────────────────
    try:
        tensor = preprocess_image(pil_image)    # shape (1, 224, 224, 3)
    except Exception as exc:
        logger.error("Preprocessing error: %s", exc, exc_info=True)
        return DualModelResult(
            status=AnalysisStatus.IMAGE_REJECTED,
            reason="Image could not be preprocessed. Try a different image.",
            quality_result=quality_result,
            processing_time_ms=_elapsed_ms(t0),
        )

    # ── 4. V2 open-set gating ─────────────────────────────────────────────────
    try:
        v2_raw = v2_model.predict(tensor, verbose=0)[0]  # shape (15,)
    except Exception as exc:
        logger.error("V2 inference error: %s", exc, exc_info=True)
        return DualModelResult(
            status=AnalysisStatus.MODEL_UNAVAILABLE,
            reason="V2 model inference failed.",
            quality_result=quality_result,
            processing_time_ms=_elapsed_ms(t0),
        )

    v2_calibrated = _temperature_scale(v2_raw)
    v2_top_idx = int(np.argmax(v2_calibrated))
    v2_top_class = v2_idx2cls.get(v2_top_idx, f"class_{v2_top_idx}")
    v2_top_conf = float(v2_calibrated[v2_top_idx])

    logger.debug(
        "V2 gate: top_class=%s, confidence=%.3f", v2_top_class, v2_top_conf
    )

    # ── 5. Open-set rejection ─────────────────────────────────────────────────
    if (
        (v2_other_idx is not None and v2_top_idx == v2_other_idx)
        or v2_top_conf < V2_MIN_ACCEPT_PROBABILITY
    ):
        logger.info("V2 gated as OTHER_UNSUPPORTED (conf=%.3f)", v2_top_conf)
        return DualModelResult(
            status=AnalysisStatus.UNSUPPORTED_CONDITION,
            reason=(
                "The uploaded image does not match any supported skin condition "
                "in our database. Please consult a qualified healthcare professional."
            ),
            v2_predicted_class=v2_top_class,
            v2_confidence=round(v2_top_conf, 4),
            quality_result=quality_result,
            processing_time_ms=_elapsed_ms(t0),
        )

    # ── 6. V1 disease classification ──────────────────────────────────────────
    try:
        v1_raw = v1_model.predict(tensor, verbose=0)[0]   # shape (14,)
    except Exception as exc:
        logger.error("V1 inference error: %s", exc, exc_info=True)
        return DualModelResult(
            status=AnalysisStatus.MODEL_UNAVAILABLE,
            reason="V1 model inference failed.",
            v2_predicted_class=v2_top_class,
            v2_confidence=round(v2_top_conf, 4),
            quality_result=quality_result,
            processing_time_ms=_elapsed_ms(t0),
        )

    v1_calibrated = _temperature_scale(v1_raw)
    v1_top_idx = int(np.argmax(v1_calibrated))
    v1_top_class = v1_idx2cls.get(v1_top_idx, f"class_{v1_top_idx}")
    v1_top_conf = float(v1_calibrated[v1_top_idx])
    uncertainty = _predictive_entropy(v1_calibrated)

    # ── 7. Confidence / safety policy ─────────────────────────────────────────
    is_high_risk = v1_top_class in HIGH_RISK_CLASSES
    threshold = HIGH_RISK_CONFIDENCE_THRESHOLD if is_high_risk else DEFAULT_CONFIDENCE_THRESHOLD

    should_abstain, abstain_reason = _evaluate_safety_policy(
        v1_top_conf, uncertainty, is_high_risk, threshold
    )

    # ── 8. Build top-K predictions ────────────────────────────────────────────
    top_indices = np.argsort(v1_calibrated)[::-1][:top_k]
    top_predictions = [
        TopPrediction(
            class_name=v1_idx2cls.get(int(i), f"class_{i}"),
            class_index=int(i),
            raw_probability=round(float(v1_raw[i]), 4),
            calibrated_probability=round(float(v1_calibrated[i]), 4),
        )
        for i in top_indices
    ]

    elapsed = _elapsed_ms(t0)

    if should_abstain:
        logger.info(
            "Abstaining: class=%s conf=%.3f uncertainty=%.3f reason=%s",
            v1_top_class, v1_top_conf, uncertainty, abstain_reason,
        )
        return DualModelResult(
            status=AnalysisStatus.ASSESSMENT_UNAVAILABLE,
            predicted_class=None,
            top_predictions=[],
            raw_probability=None,
            calibrated_confidence=None,
            uncertainty=round(uncertainty, 4),
            is_high_risk=is_high_risk,
            reason=abstain_reason,
            v2_predicted_class=None,
            v2_confidence=None,
            quality_result=quality_result,
            processing_time_ms=elapsed,
        )

    logger.info(
        "Assessment available: class=%s conf=%.3f uncertainty=%.3f high_risk=%s",
        v1_top_class, v1_top_conf, uncertainty, is_high_risk,
    )
    return DualModelResult(
        status=AnalysisStatus.ASSESSMENT_AVAILABLE,
        predicted_class=v1_top_class,
        top_predictions=top_predictions,
        raw_probability=round(float(v1_raw[v1_top_idx]), 4),
        calibrated_confidence=round(v1_top_conf, 4),
        uncertainty=round(uncertainty, 4),
        is_high_risk=is_high_risk,
        reason=None,
        v2_predicted_class=v2_top_class,
        v2_confidence=round(v2_top_conf, 4),
        quality_result=quality_result,
        processing_time_ms=elapsed,
    )


# ── Safety policy ─────────────────────────────────────────────────────────────

def _evaluate_safety_policy(
    confidence: float,
    uncertainty: float,
    is_high_risk: bool,
    threshold: float,
) -> tuple[bool, str]:
    """
    Decide whether to abstain given confidence, uncertainty, and risk level.

    Returns
    -------
    tuple[bool, str]
        (should_abstain, human_readable_reason)
    """
    if confidence < ABSOLUTE_ABSTENTION_THRESHOLD:
        return (
            True,
            "Model confidence is too low to provide a reliable assessment. "
            "Please consult a qualified healthcare professional.",
        )

    if uncertainty > MAX_ENTROPY_THRESHOLD:
        return (
            True,
            "Prediction uncertainty is too high. The image may show an ambiguous "
            "or complex presentation. Please consult a qualified healthcare professional.",
        )

    if confidence < threshold:
        if is_high_risk:
            return (
                True,
                "This image shows features that may be associated with a serious "
                "skin condition, but model confidence is insufficient for a reliable "
                "assessment. Immediate professional evaluation is strongly recommended.",
            )
        return (
            True,
            "Model confidence is below the required threshold for this prediction. "
            "Please consult a qualified healthcare professional.",
        )

    return False, ""


def _elapsed_ms(t0: float) -> float:
    """Return elapsed milliseconds since t0."""
    return round((time.perf_counter() - t0) * 1000, 1)

def run_full_skin_analysis(
    image_input: bytes | Image.Image,
    top_k: int = 3,
    skip_quality_check: bool = False,
) -> dict:
    """
    Complete DermaSathiAI skin-analysis pipeline.

    Flow:
        image
        -> quality gate
        -> V2 open-set
        -> V1 disease classifier
        -> safety / abstention
        -> recommendation profile

    Returns one JSON-serializable dictionary for downstream application use.
    """

    result = run_dual_model_pipeline(
        image_input=image_input,
        top_k=top_k,
        skip_quality_check=skip_quality_check,
    )

    from app.ml.skin.recommendation_engine import (
        build_recommendation,
    )

    recommendation = build_recommendation(
        status=result.status.value,
        predicted_class=result.predicted_class,
        confidence=result.calibrated_confidence,
    )

    return {
        "status": result.status.value,
        "prediction": result.predicted_class,
        "confidence": result.calibrated_confidence,
        "uncertainty": result.uncertainty,
        "high_risk": result.is_high_risk,
        "v2_class": result.v2_predicted_class,
        "v2_confidence": result.v2_confidence,
        "reason": result.reason,
        "quality": (
            {
                "status": str(result.quality_result.quality_status),
                "score": result.quality_result.quality_score,
                "issues": [
                    str(x) for x in result.quality_result.issues
                ],
                "user_action": result.quality_result.user_action,
            }
            if result.quality_result is not None
            else None
        ),
        "recommendation": recommendation,
        "requires_professional_review": True,
        "processing_time_ms": result.processing_time_ms,
    }
