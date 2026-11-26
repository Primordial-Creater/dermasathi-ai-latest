"""
Tests for ImageQualityGate
============================
Tests various image quality scenarios without GPU.
"""

import io
import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

# Ensure imports work
sys.path.insert(0, str(Path(__file__).resolve().parents[2].parent))

from app.ml.skin.quality.image_quality_gate import ImageQualityGate
from app.ml.skin.schemas.prediction_schema import QualityIssue, QualityStatus


@pytest.fixture
def gate():
    """Default quality gate."""
    return ImageQualityGate()


@pytest.fixture
def valid_image():
    """Create a valid test image (256x256, good contrast, sharp)."""
    rng = np.random.RandomState(42)
    # Create an image with enough texture for blur detection
    arr = rng.randint(50, 200, (256, 256, 3), dtype=np.uint8)
    # Add some edges for sharpness
    arr[100:150, 100:150, :] = 220
    arr[50:80, 50:80, :] = 30
    return Image.fromarray(arr, "RGB")


@pytest.fixture
def blurry_image():
    """Create a blurry (uniform) image."""
    # Nearly uniform = very low Laplacian variance
    arr = np.full((256, 256, 3), 128, dtype=np.uint8)
    # Add tiny noise to avoid completely flat
    arr = arr + np.random.RandomState(42).randint(-2, 3, arr.shape).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


@pytest.fixture
def dark_image():
    """Create an underexposed image."""
    arr = np.random.RandomState(42).randint(0, 15, (256, 256, 3), dtype=np.uint8)
    return Image.fromarray(arr, "RGB")


@pytest.fixture
def bright_image():
    """Create an overexposed image."""
    arr = np.random.RandomState(42).randint(245, 256, (256, 256, 3), dtype=np.uint8)
    return Image.fromarray(arr, "RGB")


@pytest.fixture
def tiny_image():
    """Create a very small image."""
    arr = np.random.RandomState(42).randint(0, 255, (16, 16, 3), dtype=np.uint8)
    return Image.fromarray(arr, "RGB")


class TestImageQualityGate:
    """Tests for the image quality gate."""

    def test_valid_image_passes(self, gate, valid_image):
        """A valid image should pass quality checks."""
        result = gate.assess(valid_image)
        assert result.quality_status in (
            QualityStatus.USABLE,
            QualityStatus.POOR_QUALITY,
        )
        assert result.quality_score > 0.0

    def test_dark_image_detected(self, gate, dark_image):
        """Dark images should be flagged as underexposed."""
        result = gate.assess(dark_image)
        assert QualityIssue.UNDEREXPOSED in result.issues

    def test_bright_image_detected(self, gate, bright_image):
        """Very bright images should be flagged as overexposed."""
        result = gate.assess(bright_image)
        assert QualityIssue.OVEREXPOSED in result.issues

    def test_tiny_image_detected(self, gate, tiny_image):
        """Very small images should be flagged."""
        result = gate.assess(tiny_image)
        assert QualityIssue.LOW_RESOLUTION in result.issues

    def test_corrupt_bytes(self, gate):
        """Corrupt bytes should be detected."""
        result = gate.assess(b"this is not an image")
        assert result.quality_status == QualityStatus.CORRUPT

    def test_empty_bytes(self, gate):
        """Empty bytes should be detected as corrupt."""
        result = gate.assess(b"")
        assert result.quality_status == QualityStatus.CORRUPT

    def test_numpy_input(self, gate):
        """Should accept numpy array input."""
        arr = np.random.randint(50, 200, (256, 256, 3), dtype=np.uint8)
        arr[100:150, 100:150, :] = 220
        result = gate.assess(arr)
        assert result.quality_score > 0.0

    def test_bytes_input(self, gate, valid_image):
        """Should accept bytes input."""
        buf = io.BytesIO()
        valid_image.save(buf, format="PNG")
        result = gate.assess(buf.getvalue())
        assert result.quality_score > 0.0

    def test_quality_score_range(self, gate, valid_image):
        """Quality score should be between 0 and 1."""
        result = gate.assess(valid_image)
        assert 0.0 <= result.quality_score <= 1.0

    def test_details_contain_dimensions(self, gate, valid_image):
        """Details should include image dimensions."""
        result = gate.assess(valid_image)
        assert "width" in result.details
        assert "height" in result.details

    def test_blurry_image_detection(self, gate, blurry_image):
        """Blurry images should be flagged."""
        result = gate.assess(blurry_image)
        assert QualityIssue.BLUR in result.issues

    def test_user_action_provided_on_rejection(self, gate, dark_image):
        """Rejected images should have a user action suggestion."""
        result = gate.assess(dark_image)
        if result.quality_status in (QualityStatus.REJECTED, QualityStatus.POOR_QUALITY):
            assert result.user_action is not None
