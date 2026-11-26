"""
Unit tests — Dual-Model Inference Pipeline
===========================================
Tests safety policy, abstention, open-set gating, and end-to-end pipeline
using mocked TensorFlow models (no GPU required).
"""

from __future__ import annotations

import io
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from PIL import Image

# Ensure backend root is on path
sys.path.insert(0, str(Path(__file__).resolve().parents[2].parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_rgb_png(w: int = 256, h: int = 256, mean: int = 120) -> bytes:
    """Create a valid RGB PNG image bytes."""
    arr = np.full((h, w, 3), mean, dtype=np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr, "RGB").save(buf, format="PNG")
    return buf.getvalue()


def _uniform_proba(n: int, top_idx: int, top_val: float) -> np.ndarray:
    """
    Build a probability vector where index top_idx has value top_val
    and the rest share the remainder equally.
    """
    p = np.full(n, (1.0 - top_val) / (n - 1), dtype=np.float32)
    p[top_idx] = top_val
    return p.reshape(1, -1)


def _mock_model(proba_vector: np.ndarray):
    """Return a MagicMock that behaves like a Keras model."""
    m = MagicMock()
    m.predict.return_value = proba_vector
    return m


# ── V2 class indices (from class_mapping.json) ────────────────────────────────
V2_OTHER_IDX = 12          # OTHER_UNSUPPORTED
V2_MELANOMA_IDX = 10       # Melanoma
V1_MELANOMA_IDX = 10       # Melanoma in V1

V1_CLASSES = {
    0: "Actinic keratoses",
    1: "Basal cell carcinoma",
    2: "Benign keratosis-like lesions",
    3: "Chickenpox",
    4: "Cowpox",
    5: "Dermatofibroma",
    6: "HFMD",
    7: "Healthy",
    8: "Measles",
    9: "Melanocytic nevi",
    10: "Melanoma",
    11: "Monkeypox",
    12: "Squamous cell carcinoma",
    13: "Vascular lesions",
}

V2_CLASSES = {
    0: "Actinic keratoses",
    1: "Basal cell carcinoma",
    2: "Benign keratosis-like lesions",
    3: "Chickenpox",
    4: "Cowpox",
    5: "Dermatofibroma",
    6: "HFMD",
    7: "Healthy",
    8: "Measles",
    9: "Melanocytic nevi",
    10: "Melanoma",
    11: "Monkeypox",
    12: "OTHER_UNSUPPORTED",
    13: "Squamous cell carcinoma",
    14: "Vascular lesions",
}


# ── Fixture: patched skin_ai_loader ──────────────────────────────────────────

def _patch_loader(v1_proba, v2_proba):
    """
    Return a context-manager that patches skin_ai_loader.is_ready and
    skin_ai_loader.get_models to return mock models.
    """
    v1_mock = _mock_model(v1_proba)
    v2_mock = _mock_model(v2_proba)

    def fake_get_models():
        return v1_mock, v2_mock, V1_CLASSES, V2_CLASSES, V2_OTHER_IDX

    return (
        patch("app.ml.skin.skin_ai_loader.is_ready", return_value=True),
        patch("app.ml.skin.skin_ai_loader.get_models", side_effect=fake_get_models),
    )


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestSafetyPolicy:
    """Tests for _evaluate_safety_policy in isolation."""

    def test_abstain_below_absolute_threshold(self):
        from app.ml.skin.dual_model_pipeline import _evaluate_safety_policy
        abstain, reason = _evaluate_safety_policy(
            confidence=0.30, uncertainty=0.2, is_high_risk=False, threshold=0.50
        )
        assert abstain is True
        assert "too low" in reason.lower()

    def test_abstain_high_entropy(self):
        from app.ml.skin.dual_model_pipeline import _evaluate_safety_policy
        abstain, reason = _evaluate_safety_policy(
            confidence=0.55, uncertainty=0.90, is_high_risk=False, threshold=0.50
        )
        assert abstain is True
        assert "uncertainty" in reason.lower()

    def test_abstain_high_risk_below_high_risk_threshold(self):
        from app.ml.skin.dual_model_pipeline import _evaluate_safety_policy
        # conf=0.55 > absolute (0.35) but < high-risk threshold (0.60)
        abstain, reason = _evaluate_safety_policy(
            confidence=0.55, uncertainty=0.2, is_high_risk=True, threshold=0.60
        )
        assert abstain is True
        assert "serious" in reason.lower()

    def test_pass_normal_class_above_threshold(self):
        from app.ml.skin.dual_model_pipeline import _evaluate_safety_policy
        abstain, _ = _evaluate_safety_policy(
            confidence=0.65, uncertainty=0.3, is_high_risk=False, threshold=0.50
        )
        assert abstain is False

    def test_pass_high_risk_above_high_risk_threshold(self):
        from app.ml.skin.dual_model_pipeline import _evaluate_safety_policy
        abstain, _ = _evaluate_safety_policy(
            confidence=0.75, uncertainty=0.3, is_high_risk=True, threshold=0.60
        )
        assert abstain is False


class TestTemperatureScaling:
    """Tests for internal calibration helper."""

    def test_output_is_valid_probability_distribution(self):
        from app.ml.skin.dual_model_pipeline import _temperature_scale
        proba = np.array([0.7, 0.2, 0.1], dtype=np.float32)
        out = _temperature_scale(proba)
        assert np.isclose(out.sum(), 1.0, atol=1e-5)
        assert (out >= 0).all()

    def test_temperature_softens_distribution(self):
        from app.ml.skin.dual_model_pipeline import _temperature_scale
        proba = np.array([0.9, 0.09, 0.01], dtype=np.float32)
        scaled = _temperature_scale(proba, temperature=2.0)
        # After softening, top probability must be lower
        assert scaled[0] < proba[0]

    def test_temperature_1_preserves_argmax(self):
        from app.ml.skin.dual_model_pipeline import _temperature_scale
        proba = np.array([0.1, 0.6, 0.3], dtype=np.float32)
        scaled = _temperature_scale(proba, temperature=1.0)
        assert np.argmax(scaled) == np.argmax(proba)


class TestPredictiveEntropy:
    """Tests for predictive entropy computation."""

    def test_certain_prediction_has_low_entropy(self):
        from app.ml.skin.dual_model_pipeline import _predictive_entropy
        proba = np.zeros(14, dtype=np.float32)
        proba[3] = 1.0
        entropy = _predictive_entropy(proba)
        assert entropy < 0.05

    def test_uniform_distribution_has_max_entropy(self):
        from app.ml.skin.dual_model_pipeline import _predictive_entropy
        proba = np.full(14, 1.0 / 14, dtype=np.float32)
        entropy = _predictive_entropy(proba)
        assert entropy > 0.95


class TestPipelineModelUnavailable:
    """Pipeline returns MODEL_UNAVAILABLE when loader is not ready."""

    def test_model_unavailable_status(self):
        from app.ml.skin.dual_model_pipeline import (
            AnalysisStatus,
            run_dual_model_pipeline,
        )
        image_bytes = _make_rgb_png()
        with patch("app.ml.skin.skin_ai_loader.is_ready", return_value=False):
            result = run_dual_model_pipeline(image_bytes, skip_quality_check=True)
        assert result.status == AnalysisStatus.MODEL_UNAVAILABLE
        assert result.requires_professional_review is True


class TestPipelineUnsupportedCondition:
    """V2 predicts OTHER_UNSUPPORTED — pipeline must abstain."""

    def test_other_unsupported_triggers_rejection(self):
        from app.ml.skin.dual_model_pipeline import (
            AnalysisStatus,
            run_dual_model_pipeline,
        )
        # V2 strongly predicts OTHER_UNSUPPORTED (idx=12)
        v2_proba = _uniform_proba(15, V2_OTHER_IDX, top_val=0.90)
        v1_proba = _uniform_proba(14, V1_MELANOMA_IDX, top_val=0.90)   # doesn't matter

        image_bytes = _make_rgb_png()
        p1, p2 = _patch_loader(v1_proba, v2_proba)
        with p1, p2:
            result = run_dual_model_pipeline(image_bytes, skip_quality_check=True)

        assert result.status == AnalysisStatus.UNSUPPORTED_CONDITION
        assert result.requires_professional_review is True
        # V1 must NOT have been forced
        assert result.predicted_class is None

    def test_unsupported_condition_has_no_v1_prediction(self):
        from app.ml.skin.dual_model_pipeline import run_dual_model_pipeline
        v2_proba = _uniform_proba(15, V2_OTHER_IDX, top_val=0.85)
        v1_proba = _uniform_proba(14, 1, top_val=0.80)

        image_bytes = _make_rgb_png()
        p1, p2 = _patch_loader(v1_proba, v2_proba)
        with p1, p2:
            result = run_dual_model_pipeline(image_bytes, skip_quality_check=True)

        assert result.predicted_class is None
        assert result.top_predictions == []


class TestPipelineHighRiskAbstention:
    """High-risk class with insufficient confidence → abstain."""

    def test_high_risk_low_confidence_abstains(self):
        from app.ml.skin.dual_model_pipeline import (
            AnalysisStatus,
            run_dual_model_pipeline,
        )
        # V2: confident supported class (Melanoma, not OTHER)
        v2_proba = _uniform_proba(15, V2_MELANOMA_IDX, top_val=0.75)
        # V1: Melanoma at 0.55 — above absolute (0.35) but below high-risk threshold (0.60)
        v1_proba = _uniform_proba(14, V1_MELANOMA_IDX, top_val=0.55)

        image_bytes = _make_rgb_png()
        p1, p2 = _patch_loader(v1_proba, v2_proba)
        with p1, p2:
            result = run_dual_model_pipeline(image_bytes, skip_quality_check=True)

        assert result.status == AnalysisStatus.ASSESSMENT_UNAVAILABLE
        assert result.is_high_risk is True
        assert result.requires_professional_review is True

    def test_high_risk_sufficient_confidence_passes(self):
        from app.ml.skin.dual_model_pipeline import (
            AnalysisStatus,
            run_dual_model_pipeline,
        )
        v2_proba = _uniform_proba(15, V2_MELANOMA_IDX, top_val=0.80)
        # Melanoma at 0.75 — above high-risk threshold (0.60)
        v1_proba = _uniform_proba(14, V1_MELANOMA_IDX, top_val=0.75)

        image_bytes = _make_rgb_png()
        p1, p2 = _patch_loader(v1_proba, v2_proba)
        with p1, p2:
            result = run_dual_model_pipeline(image_bytes, skip_quality_check=True)

        assert result.status == AnalysisStatus.ASSESSMENT_AVAILABLE
        assert result.predicted_class == "Melanoma"
        assert result.is_high_risk is True


class TestPipelineNormalDiseaseAssessment:
    """Normal supported disease with sufficient confidence → assessment available."""

    def test_healthy_class_passes(self):
        from app.ml.skin.dual_model_pipeline import (
            AnalysisStatus,
            run_dual_model_pipeline,
        )
        # Healthy = idx 7
        v2_proba = _uniform_proba(15, 7, top_val=0.80)
        v1_proba = _uniform_proba(14, 7, top_val=0.70)

        image_bytes = _make_rgb_png()
        p1, p2 = _patch_loader(v1_proba, v2_proba)
        with p1, p2:
            result = run_dual_model_pipeline(image_bytes, skip_quality_check=True)

        assert result.status == AnalysisStatus.ASSESSMENT_AVAILABLE
        assert result.predicted_class == "Healthy"
        assert result.is_high_risk is False

    def test_top_predictions_returned(self):
        from app.ml.skin.dual_model_pipeline import run_dual_model_pipeline
        v2_proba = _uniform_proba(15, 7, top_val=0.80)
        v1_proba = _uniform_proba(14, 7, top_val=0.70)

        image_bytes = _make_rgb_png()
        p1, p2 = _patch_loader(v1_proba, v2_proba)
        with p1, p2:
            result = run_dual_model_pipeline(image_bytes, skip_quality_check=True, top_k=3)

        assert len(result.top_predictions) == 3
        assert result.top_predictions[0].class_name == "Healthy"

    def test_response_always_requires_review(self):
        from app.ml.skin.dual_model_pipeline import run_dual_model_pipeline
        v2_proba = _uniform_proba(15, 7, top_val=0.80)
        v1_proba = _uniform_proba(14, 7, top_val=0.90)

        image_bytes = _make_rgb_png()
        p1, p2 = _patch_loader(v1_proba, v2_proba)
        with p1, p2:
            result = run_dual_model_pipeline(image_bytes, skip_quality_check=True)

        assert result.requires_professional_review is True


class TestPreprocessing:
    """Tests for ResNet50 preprocessing."""

    def test_output_shape(self):
        from app.ml.skin.resnet_preprocess import preprocess_image
        img = Image.fromarray(np.random.randint(0, 255, (300, 400, 3), dtype=np.uint8))
        arr = preprocess_image(img, target_size=224)
        assert arr.shape == (1, 224, 224, 3)

    def test_output_dtype_float32(self):
        from app.ml.skin.resnet_preprocess import preprocess_image
        img = Image.fromarray(np.full((100, 100, 3), 128, dtype=np.uint8))
        arr = preprocess_image(img)
        assert arr.dtype == np.float32

    def test_fallback_mean_subtraction(self):
        """Fallback preprocessing shifts values away from [0,255]."""
        from app.ml.skin.resnet_preprocess import _fallback_resnet_preprocess
        arr = np.full((224, 224, 3), 128.0, dtype=np.float32)
        result = _fallback_resnet_preprocess(arr.copy())
        # Values should not all be in [0, 255] after mean subtraction
        assert not (result.min() >= 0 and result.max() <= 255)

    def test_bytes_input(self):
        from app.ml.skin.resnet_preprocess import preprocess_image
        image_bytes = _make_rgb_png()
        arr = preprocess_image(image_bytes)
        assert arr.shape == (1, 224, 224, 3)
