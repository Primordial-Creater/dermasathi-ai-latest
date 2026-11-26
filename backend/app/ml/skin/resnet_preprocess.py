"""
DermaSathiAI — ResNet50 Preprocessing
=======================================
Exact preprocessing pipeline used when both models were trained.

Both V1 and V2 use ResNet50 as backbone.
The preprocessing function is:
  tf.keras.applications.resnet50.preprocess_input

Which converts RGB [0, 255] → BGR mean-subtracted (ImageNet means).
Specifically:
  R -= 103.939
  G -= 116.779
  B -= 123.68
  (and channels are converted to BGR order)

This module is deliberately isolated so:
1. The exact preprocessing cannot drift between endpoint versions.
2. Tests can verify the output range independently.
3. TensorFlow is imported lazily (only when needed) to keep import time low.

Target size: 224 × 224 (ResNet50 default).
"""

from __future__ import annotations

import logging
from typing import Union

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# Target dimensions for both V1 and V2 models.
MODEL_INPUT_SIZE: int = 224


def preprocess_image(
    image: Union[Image.Image, bytes, np.ndarray],
    target_size: int = MODEL_INPUT_SIZE,
) -> np.ndarray:
    """
    Convert an image to a model-ready batch tensor.

    Parameters
    ----------
    image : PIL.Image | bytes | np.ndarray
        Input image in any reasonable form.
    target_size : int
        Width and height to resize to (default 224).

    Returns
    -------
    np.ndarray
        Float32 array of shape (1, target_size, target_size, 3),
        preprocessed with ResNet50 ImageNet mean subtraction.

    Raises
    ------
    ValueError
        If the image cannot be converted to a valid RGB array.
    """
    pil_img = _to_pil(image)

    # Force RGB (handles grayscale, RGBA, palette, etc.)
    if pil_img.mode != "RGB":
        pil_img = pil_img.convert("RGB")

    # Convert to float32 [0, 255], then use TensorFlow bilinear
    # resizing to match the training pipeline exactly.
    arr = np.array(pil_img, dtype=np.float32)

    if arr.ndim != 3 or arr.shape[2] != 3:
        raise ValueError(
            f"Expected (H, W, 3) array after convert, got shape {arr.shape}"
        )

    if pil_img.size != (target_size, target_size):
        import tensorflow as tf
        arr = tf.image.resize(
            arr,
            [target_size, target_size],
            method="bilinear",
        ).numpy()

    # Apply ResNet50 preprocessing (lazy TF import)
    arr = _resnet50_preprocess(arr)

    # Add batch dimension → (1, H, W, 3)
    return np.expand_dims(arr, axis=0)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _to_pil(image: Union[Image.Image, bytes, np.ndarray]) -> Image.Image:
    """Convert diverse input types to PIL.Image."""
    if isinstance(image, Image.Image):
        return image

    if isinstance(image, bytes):
        import io  # noqa: PLC0415
        return Image.open(io.BytesIO(image))

    if isinstance(image, np.ndarray):
        # Assume uint8 RGB
        return Image.fromarray(image.astype(np.uint8))

    raise TypeError(f"Unsupported image type: {type(image)}")


_resnet_preprocess_fn = None  # Cached TF function


def _resnet50_preprocess(arr: np.ndarray) -> np.ndarray:
    """
    Apply tf.keras.applications.resnet50.preprocess_input.

    Falls back to manual BGR mean-subtraction if TF is unavailable
    (only for unit-test environments that mock TF).
    """
    global _resnet_preprocess_fn  # noqa: PLW0603

    if _resnet_preprocess_fn is None:
        try:
            from tensorflow.keras.applications.resnet50 import (  # noqa: PLC0415
                preprocess_input,
            )
            _resnet_preprocess_fn = preprocess_input
            logger.debug("ResNet50 preprocess_input loaded from TensorFlow.")
        except ImportError:
            _resnet_preprocess_fn = _fallback_resnet_preprocess
            logger.warning(
                "TensorFlow unavailable; using manual BGR mean-subtraction fallback."
            )

    return _resnet_preprocess_fn(arr.copy())  # type: ignore[return-value]


def _fallback_resnet_preprocess(arr: np.ndarray) -> np.ndarray:
    """
    Manual ResNet50 preprocessing without TensorFlow.

    Converts RGB → BGR and subtracts ImageNet channel means.
    Used ONLY in test environments where TF is not installed.
    """
    # RGB → BGR
    arr = arr[..., ::-1]
    # Subtract ImageNet BGR means
    arr[..., 0] -= 103.939
    arr[..., 1] -= 116.779
    arr[..., 2] -= 123.68
    return arr
