"""
DermaSathiAI — DenseNet201 Model
===================================
DenseNet201 transfer learning for skin disease classification.
Input size: 224×224.
"""

from __future__ import annotations

import logging
from typing import Any

from app.ml.skin.models.base_model import BaseSkinModel

logger = logging.getLogger(__name__)


class DenseNet201Model(BaseSkinModel):
    """DenseNet201-based skin disease classifier."""

    def __init__(self, config: dict[str, Any]):
        config.setdefault("model", {})
        config["model"].setdefault("name", "densenet201")
        config["model"].setdefault("image_size", 224)
        config["model"].setdefault("input_shape", [224, 224, 3])
        config["model"].setdefault("unfreeze_from", "conv5_block1_0_bn")
        super().__init__(config)

    def _build_backbone(self):
        """Build DenseNet201 backbone without classification head."""
        from tensorflow.keras.applications import DenseNet201

        backbone = DenseNet201(
            weights=self.pretrained_weights,
            include_top=False,
            input_shape=self.input_shape,
        )
        logger.info(
            "DenseNet201 backbone loaded: %d layers", len(backbone.layers)
        )
        return backbone

    def _get_preprocess_fn(self):
        """Return DenseNet201-specific preprocessing."""
        from tensorflow.keras.applications.densenet import preprocess_input
        return preprocess_input
