"""
API Integration Tests — POST /api/v1/skin/analyze (Dual-Model)
================================================================
Tests the HTTP layer: upload validation, response schema, status codes.
Uses FastAPI TestClient and mocked pipeline (no TF models required).
"""

from __future__ import annotations

import io
import sys
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[2].parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from fastapi.testclient import TestClient

from app.ml.skin.dual_model_pipeline import (
    AnalysisStatus,
    DualModelResult,
)


# ── Fixture ───────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    """FastAPI test client with mocked model loading."""
    # Prevent actual model file loading during import
    with patch("app.ml.skin.skin_ai_loader.load_models"):
        from main import app
        yield TestClient(app)


def _png_bytes(w: int = 256, h: int = 256, brightness: int = 120) -> bytes:
    arr = np.full((h, w, 3), brightness, dtype=np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr, "RGB").save(buf, format="PNG")
    return buf.getvalue()


def _post_image(client, image_bytes: bytes, content_type: str = "image/png"):
    return client.post(
        "/api/v1/skin/analyze",
        files={"file": ("test.png", image_bytes, content_type)},
    )


# ── Mocked pipeline result helpers ───────────────────────────────────────────

def _mock_assessment_available(predicted_class: str = "Healthy", is_high_risk: bool = False):
    return DualModelResult(
        status=AnalysisStatus.ASSESSMENT_AVAILABLE,
        predicted_class=predicted_class,
        top_predictions=[],
        raw_probability=0.80,
        calibrated_confidence=0.72,
        uncertainty=0.25,
        is_high_risk=is_high_risk,
        processing_time_ms=42.0,
    )


def _mock_unsupported():
    return DualModelResult(
        status=AnalysisStatus.UNSUPPORTED_CONDITION,
        reason="Condition not in the supported class set.",
        v2_predicted_class="OTHER_UNSUPPORTED",
        v2_confidence=0.88,
        processing_time_ms=38.0,
    )


def _mock_model_unavailable():
    return DualModelResult(
        status=AnalysisStatus.MODEL_UNAVAILABLE,
        reason="Models not loaded.",
        processing_time_ms=0.5,
    )


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestUploadValidation:
    """HTTP-level upload validation."""

    def test_empty_file_rejected_400(self, client):
        resp = _post_image(client, b"")
        assert resp.status_code == 400
        assert "empty" in resp.json()["detail"].lower()

    def test_non_image_content_type_rejected_400(self, client):
        resp = client.post(
            "/api/v1/skin/analyze",
            files={"file": ("test.txt", b"hello world", "text/plain")},
        )
        assert resp.status_code == 400

    def test_file_too_large_rejected_400(self, client):
        oversized = b"x" * (51 * 1024 * 1024)
        resp = _post_image(client, oversized)
        assert resp.status_code == 400
        assert "large" in resp.json()["detail"].lower()


class TestResponseSchema:
    """Validate response schema correctness."""

    def test_response_always_has_status(self, client):
        with patch(
            "app.api.v1.skin_ai.run_dual_model_pipeline",
            return_value=_mock_assessment_available(),
        ):
            resp = _post_image(client, _png_bytes())
        assert resp.status_code == 200
        assert "status" in resp.json()

    def test_response_always_requires_professional_review(self, client):
        with patch(
            "app.api.v1.skin_ai.run_dual_model_pipeline",
            return_value=_mock_assessment_available(),
        ):
            resp = _post_image(client, _png_bytes())
        data = resp.json()
        assert data["requires_professional_review"] is True

    def test_response_always_has_disclaimer(self, client):
        with patch(
            "app.api.v1.skin_ai.run_dual_model_pipeline",
            return_value=_mock_assessment_available(),
        ):
            resp = _post_image(client, _png_bytes())
        data = resp.json()
        assert "disclaimer" in data
        assert "NOT a medical diagnosis" in data["disclaimer"]

    def test_assessment_available_has_predicted_class(self, client):
        with patch(
            "app.api.v1.skin_ai.run_dual_model_pipeline",
            return_value=_mock_assessment_available("Melanocytic nevi"),
        ):
            resp = _post_image(client, _png_bytes())
        data = resp.json()
        assert data["status"] == "assessment_available"
        assert data["predicted_class"] == "Melanocytic nevi"

    def test_unsupported_condition_no_predicted_class(self, client):
        with patch(
            "app.api.v1.skin_ai.run_dual_model_pipeline",
            return_value=_mock_unsupported(),
        ):
            resp = _post_image(client, _png_bytes())
        data = resp.json()
        assert data["status"] == "unsupported_condition"
        assert data["predicted_class"] is None

    def test_model_unavailable_returns_200(self, client):
        """Model unavailable is a valid response, not an HTTP error."""
        with patch(
            "app.api.v1.skin_ai.run_dual_model_pipeline",
            return_value=_mock_model_unavailable(),
        ):
            resp = _post_image(client, _png_bytes())
        assert resp.status_code == 200
        assert resp.json()["status"] == "model_unavailable"

    def test_high_risk_flag_is_present(self, client):
        with patch(
            "app.api.v1.skin_ai.run_dual_model_pipeline",
            return_value=_mock_assessment_available("Melanoma", is_high_risk=True),
        ):
            resp = _post_image(client, _png_bytes())
        data = resp.json()
        assert data["is_high_risk"] is True


class TestStatusEndpoint:
    """GET /api/v1/skin/status"""

    def test_status_endpoint_returns_200(self, client):
        resp = client.get("/api/v1/skin/status")
        assert resp.status_code == 200

    def test_status_has_service_ready_field(self, client):
        resp = client.get("/api/v1/skin/status")
        assert "service_ready" in resp.json()


class TestHealthEndpoint:
    """Verify existing /health endpoint is unaffected."""

    def test_health_still_works(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"
