"""
DermaSathiAI — InceptionV3 Model
==================================
InceptionV3 transfer learning for skin disease classification.
Input size: 299×299.
"""

from __future__ import annotations

import logging
from typing import Any

from app.ml.skin.models.base_model import BaseSkinModel

logger = logging.getLogger(__name__)


class InceptionV3Model(BaseSkinModel):
    """InceptionV3-based skin disease classifier."""

    def __init__(self, config: dict[str, Any]):
        # Ensure correct defaults for InceptionV3
        config.setdefault("model", {})
        config["model"].setdefault("name", "inception_v3")
        config["model"].setdefault("image_size", 299)
        config["model"].setdefault("input_shape", [299, 299, 3])
        config["model"].setdefault("unfreeze_from", "mixed7")
        super().__init__(config)

    def _build_backbone(self):
        """Build InceptionV3 backbone without classification head."""
        from tensorflow.keras.applications import InceptionV3

        backbone = InceptionV3(
            weights=self.pretrained_weights,
            include_top=False,
            input_shape=self.input_shape,
        )
        logger.info(
            "InceptionV3 backbone loaded: %d layers", len(backbone.layers)
        )
        return backbone

    def _get_preprocess_fn(self):
        """Return InceptionV3-specific preprocessing."""
        from tensorflow.keras.applications.inception_v3 import preprocess_input
        return preprocess_input
