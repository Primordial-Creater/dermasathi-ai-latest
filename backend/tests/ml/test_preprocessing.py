"""
Tests for ImagePreprocessor
==============================
Tests preprocessing without GPU.
"""

import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[2].parent))

from app.ml.skin.preprocessing.image_preprocessor import ImagePreprocessor


@pytest.fixture
def preprocessor_224():
    """Preprocessor for 224×224 models."""
    return ImagePreprocessor({"model": {"image_size": 224, "name": "resnet50"}})


@pytest.fixture
def preprocessor_299():
    """Preprocessor for 299×299 models."""
    return ImagePreprocessor({"model": {"image_size": 299, "name": "inception_v3"}})


@pytest.fixture
def sample_image():
    """Create a sample RGB image of arbitrary size."""
    arr = np.random.randint(0, 255, (400, 600, 3), dtype=np.uint8)
    return Image.fromarray(arr, "RGB")


@pytest.fixture
def grayscale_image():
    """Create a grayscale image."""
    arr = np.random.randint(0, 255, (300, 300), dtype=np.uint8)
    return Image.fromarray(arr, "L")


class TestImagePreprocessor:
    """Tests for the image preprocessor."""

    def test_output_shape_224(self, preprocessor_224, sample_image):
        """Preprocessed output should have correct shape for 224 models."""
        result = preprocessor_224.preprocess_for_inference(sample_image)
        assert result.shape == (1, 224, 224, 3)

    def test_output_shape_299(self, preprocessor_299, sample_image):
        """Preprocessed output should have correct shape for 299 models."""
        result = preprocessor_299.preprocess_for_inference(sample_image)
        assert result.shape == (1, 299, 299, 3)

    def test_training_no_batch_dim(self, preprocessor_224, sample_image):
        """Training preprocessing should not add batch dimension."""
        result = preprocessor_224.preprocess_for_training(sample_image)
        assert result.shape == (224, 224, 3)

    def test_grayscale_converted_to_rgb(self, preprocessor_224, grayscale_image):
        """Grayscale images should be converted to RGB."""
        result = preprocessor_224.preprocess_for_inference(grayscale_image)
        assert result.shape == (1, 224, 224, 3)

    def test_output_is_float(self, preprocessor_224, sample_image):
        """Output should be float type."""
        result = preprocessor_224.preprocess_for_inference(sample_image)
        assert result.dtype == np.float32 or result.dtype == np.float64

    def test_resize_only(self, preprocessor_224, sample_image):
        """Resize-only should return a PIL image at correct size."""
        result = preprocessor_224.resize_only(sample_image)
        assert isinstance(result, Image.Image)
        assert result.size == (224, 224)

    def test_rgba_image_handled(self, preprocessor_224):
        """RGBA images should be handled gracefully."""
        arr = np.random.randint(0, 255, (256, 256, 4), dtype=np.uint8)
        rgba_img = Image.fromarray(arr, "RGBA")
        result = preprocessor_224.preprocess_for_inference(rgba_img)
        assert result.shape == (1, 224, 224, 3)

    def test_very_large_image(self, preprocessor_224):
        """Very large images should be resized without error."""
        arr = np.random.randint(0, 255, (2000, 3000, 3), dtype=np.uint8)
        large_img = Image.fromarray(arr, "RGB")
        result = preprocessor_224.preprocess_for_inference(large_img)
        assert result.shape == (1, 224, 224, 3)

    def test_square_image(self, preprocessor_224):
        """Square images should be handled correctly."""
        arr = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
        sq_img = Image.fromarray(arr, "RGB")
        result = preprocessor_224.preprocess_for_inference(sq_img)
        assert result.shape == (1, 224, 224, 3)
