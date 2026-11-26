"""
Tests for ML Model Architectures and Factory.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.ml.skin.config_loader import load_model_config
from app.ml.skin.models.model_factory import (
    create_model,
    list_available_models,
)


class TestModelArchitectures:
    """Test model creation, structure, and stage compiling."""

    @pytest.mark.parametrize("model_name", ["inception_v3", "resnet50", "densenet201"])
    def test_model_build_and_output_shape(self, model_name: str):
        """Verify each model builds correctly with expected output dimensions."""
        config = load_model_config(model_name)
        # Use weights=None for fast offline unit testing
        config["model"]["pretrained_weights"] = None
        
        model = create_model(model_name, config)
        model.build(num_classes=14)

        assert model.model is not None
        assert model.num_classes == 14
        
        # Test forward pass with a dummy input
        img_size = config["model"]["image_size"]
        dummy_input = np.zeros((1, img_size, img_size, 3), dtype=np.float32)
        preds = model.model.predict(dummy_input, verbose=0)
        
        assert preds.shape == (1, 14)
        assert np.isclose(np.sum(preds), 1.0, atol=1e-4)

    def test_stage1_compilation_freezes_backbone(self):
        """Verify Stage 1 compilation freezes the backbone."""
        config = load_model_config("resnet50")
        config["model"]["pretrained_weights"] = None
        
        model = create_model("resnet50", config)
        model.build(num_classes=5)
        model.compile_for_head_training(learning_rate=1e-3)

        assert model.backbone.trainable is False
        assert model.model.get_layer("predictions").trainable is True

    def test_stage2_compilation_unfreezes_layers(self):
        """Verify Stage 2 compilation unfreezes layers from unfreeze_from point."""
        config = load_model_config("inception_v3")
        config["model"]["pretrained_weights"] = None
        
        model = create_model("inception_v3", config)
        model.build(num_classes=5)
        model.compile_for_finetuning(learning_rate=1e-5)

        assert model.backbone.trainable is True
        # Backbone should have trainable weights
        trainable_weights = len(model.backbone.trainable_weights)
        assert trainable_weights > 0

    def test_preprocess_fn(self):
        """Verify preprocess_fn returns normalized array."""
        for name in ["inception_v3", "resnet50", "densenet201"]:
            config = load_model_config(name)
            config["model"]["pretrained_weights"] = None
            model = create_model(name, config)
            fn = model._get_preprocess_fn()
            
            sample = np.ones((224, 224, 3), dtype=np.float32) * 128.0
            processed = fn(sample.copy())
            assert processed is not None
            assert processed.shape == (224, 224, 3)
