"""
Tests for Skin Analysis API Endpoint
========================================
Tests the /api/v1/skin/analyze endpoint.
"""

import io
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[2].parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def valid_image_bytes():
    """Create valid image bytes."""
    arr = np.random.randint(50, 200, (256, 256, 3), dtype=np.uint8)
    img = Image.fromarray(arr, "RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()


class TestSkinAnalysisAPI:
    """Tests for the skin analysis API."""

    def test_health_endpoint(self, client):
        """Health endpoint should still work."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    def test_skin_status_endpoint(self, client):
        """Service status endpoint should respond."""
        response = client.get("/api/v1/skin/status")
        assert response.status_code == 200
        data = response.json()
        assert "service_ready" in data

    def test_analyze_with_valid_image(self, client, valid_image_bytes):
        """Analyze endpoint should accept valid image (model may be unavailable)."""
        response = client.post(
            "/api/v1/skin/analyze",
            files={"file": ("test.png", valid_image_bytes, "image/png")},
        )
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "requires_professional_review" in data
        assert data["requires_professional_review"] is True
        assert "disclaimer" in data

    def test_analyze_with_empty_file(self, client):
        """Should reject empty file."""
        response = client.post(
            "/api/v1/skin/analyze",
            files={"file": ("test.png", b"", "image/png")},
        )
        assert response.status_code == 400

    def test_analyze_with_non_image(self, client):
        """Should reject non-image file."""
        response = client.post(
            "/api/v1/skin/analyze",
            files={"file": ("test.txt", b"hello world", "text/plain")},
        )
        assert response.status_code == 400

    def test_response_always_requires_review(self, client, valid_image_bytes):
        """Every response must require professional review."""
        response = client.post(
            "/api/v1/skin/analyze",
            files={"file": ("test.png", valid_image_bytes, "image/png")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["requires_professional_review"] is True

    def test_response_has_disclaimer(self, client, valid_image_bytes):
        """Every response must include a medical disclaimer."""
        response = client.post(
            "/api/v1/skin/analyze",
            files={"file": ("test.png", valid_image_bytes, "image/png")},
        )
        data = response.json()
        assert "disclaimer" in data
        assert "NOT a medical diagnosis" in data["disclaimer"]
