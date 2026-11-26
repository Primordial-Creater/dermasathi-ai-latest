"""
DermaSathiAI — Augmentation Pipeline
======================================
Clinically reasonable data augmentation for training only.

IMPORTANT:
- Never applied to validation/test data.
- Avoids aggressive transforms that create unrealistic lesions.
- Preserves diagnostically relevant color and structure.
- Does NOT manufacture fake demographic diversity.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import numpy as np

logger = logging.getLogger(__name__)


class AugmentationPipeline:
    """
    Training-only augmentation with clinically conservative transforms.

    All augmentation is applied on-the-fly in the data pipeline,
    NOT saved to disk (originals are always preserved).
    """

    def __init__(self, config: Optional[dict[str, Any]] = None):
        cfg = config or {}
        aug_cfg = cfg.get("augmentation", {})
        self.enabled = aug_cfg.get("enabled", True)
        self.rotation_range = aug_cfg.get("rotation_range", 20)
        self.width_shift = aug_cfg.get("width_shift_range", 0.1)
        self.height_shift = aug_cfg.get("height_shift_range", 0.1)
        self.horizontal_flip = aug_cfg.get("horizontal_flip", True)
        self.vertical_flip = aug_cfg.get("vertical_flip", False)
        self.zoom_range = aug_cfg.get("zoom_range", 0.15)
        self.brightness_range = tuple(aug_cfg.get("brightness_range", [0.8, 1.2]))
        self.contrast_range = tuple(aug_cfg.get("contrast_range", [0.8, 1.2]))
        self.fill_mode = aug_cfg.get("fill_mode", "reflect")

    def get_tf_augmentation_layer(self):
        """
        Create a tf.keras Sequential augmentation layer for use
        inside a training pipeline.

        Returns
        -------
        tf.keras.Sequential or None
            Augmentation layer (None if disabled or TF unavailable).
        """
        if not self.enabled:
            return None

        try:
            import tensorflow as tf

            layers = []

            if self.rotation_range > 0:
                layers.append(
                    tf.keras.layers.RandomRotation(
                        factor=self.rotation_range / 360.0,
                        fill_mode=self.fill_mode,
                    )
                )

            if self.width_shift > 0 or self.height_shift > 0:
                layers.append(
                    tf.keras.layers.RandomTranslation(
                        height_factor=self.height_shift,
                        width_factor=self.width_shift,
                        fill_mode=self.fill_mode,
                    )
                )

            if self.horizontal_flip:
                layers.append(tf.keras.layers.RandomFlip("horizontal"))

            if self.vertical_flip:
                layers.append(tf.keras.layers.RandomFlip("vertical"))

            if self.zoom_range > 0:
                layers.append(
                    tf.keras.layers.RandomZoom(
                        height_factor=(-self.zoom_range, self.zoom_range),
                        fill_mode=self.fill_mode,
                    )
                )

            if self.brightness_range != (1.0, 1.0):
                # RandomBrightness takes a factor range
                max_delta = max(
                    abs(1.0 - self.brightness_range[0]),
                    abs(self.brightness_range[1] - 1.0),
                )
                layers.append(
                    tf.keras.layers.RandomBrightness(factor=max_delta)
                )

            if self.contrast_range != (1.0, 1.0):
                layers.append(
                    tf.keras.layers.RandomContrast(
                        factor=max(
                            abs(1.0 - self.contrast_range[0]),
                            abs(self.contrast_range[1] - 1.0),
                        )
                    )
                )

            if not layers:
                return None

            return tf.keras.Sequential(layers, name="augmentation")

        except ImportError:
            logger.warning("TensorFlow not available; augmentation disabled.")
            return None

    def describe(self) -> dict[str, Any]:
        """Return a JSON-serializable description of augmentation config."""
        return {
            "enabled": self.enabled,
            "rotation_range": self.rotation_range,
            "width_shift_range": self.width_shift,
            "height_shift_range": self.height_shift,
            "horizontal_flip": self.horizontal_flip,
            "vertical_flip": self.vertical_flip,
            "zoom_range": self.zoom_range,
            "brightness_range": list(self.brightness_range),
            "contrast_range": list(self.contrast_range),
            "fill_mode": self.fill_mode,
        }
