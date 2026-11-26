"""
Tests for Config Loader and Data Pipeline
=============================================
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2].parent))

from app.ml.skin.config_loader import (
    load_base_config,
    load_model_config,
    get_project_root,
)


class TestConfigLoader:
    """Tests for configuration loading."""

    def test_load_base_config(self):
        """Base config should load successfully."""
        config = load_base_config()
        assert "training" in config
        assert "quality_gate" in config
        assert "inference" in config
        assert "classes" in config

    def test_load_inception_v3_config(self):
        """InceptionV3 config should merge correctly."""
        config = load_model_config("inception_v3")
        assert config["model"]["name"] == "inception_v3"
        assert config["model"]["image_size"] == 299

    def test_load_resnet50_config(self):
        """ResNet50 config should merge correctly."""
        config = load_model_config("resnet50")
        assert config["model"]["name"] == "resnet50"
        assert config["model"]["image_size"] == 224

    def test_load_densenet201_config(self):
        """DenseNet201 config should merge correctly."""
        config = load_model_config("densenet201")
        assert config["model"]["name"] == "densenet201"
        assert config["model"]["image_size"] == 224

    def test_base_config_has_14_classes(self):
        """Prototype config should have 14 classes."""
        config = load_base_config()
        assert len(config["classes"]) == 14

    def test_model_config_inherits_base(self):
        """Model-specific config should inherit base values."""
        config = load_model_config("inception_v3")
        # Should have training config from base
        assert "seed" in config["training"]
        assert "batch_size" in config["training"]

    def test_project_root_exists(self):
        """Project root should exist."""
        root = get_project_root()
        assert root.exists()
        assert (root / "backend").exists()


class TestModelFactory:
    """Tests for model factory."""

    def test_list_available_models(self):
        """Should list all three models."""
        from app.ml.skin.models.model_factory import list_available_models
        models = list_available_models()
        assert "inception_v3" in models
        assert "resnet50" in models
        assert "densenet201" in models

    def test_invalid_model_raises(self):
        """Unknown model name should raise ValueError."""
        from app.ml.skin.models.model_factory import create_model
        with pytest.raises(ValueError, match="Unknown model"):
            create_model("nonexistent_model", {})


class TestSchemas:
    """Tests for prediction schemas."""

    def test_prediction_result_creation(self):
        """Should create valid PredictionResult."""
        from app.ml.skin.schemas.prediction_schema import (
            PredictionResult,
            PredictionStatus,
        )
        result = PredictionResult(
            status=PredictionStatus.ASSESSMENT_AVAILABLE,
            prediction="Melanoma",
            raw_probability=0.85,
            requires_professional_review=True,
        )
        assert result.status == "assessment_available"
        assert result.requires_professional_review is True

    def test_quality_result_creation(self):
        """Should create valid ImageQualityResult."""
        from app.ml.skin.schemas.prediction_schema import (
            ImageQualityResult,
            QualityStatus,
        )
        result = ImageQualityResult(
            quality_status=QualityStatus.USABLE,
            quality_score=0.95,
        )
        assert result.quality_status == "usable"
        assert result.quality_score == 0.95
