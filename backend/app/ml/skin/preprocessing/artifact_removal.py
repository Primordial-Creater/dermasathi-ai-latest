"""
DermaSathiAI — Artifact Removal (Optional)
============================================
Modular hair/ruler/marker removal for dermatoscopy images.

This module is OPTIONAL and disabled by default.
Can be enabled for ablation studies.

IMPORTANT:
- Does NOT blindly remove all dark pixels.
- Does NOT destroy lesion boundaries.
- Preserves both original and processed images.
- Every transformation is documented.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


class ArtifactRemover:
    """
    Optional artifact removal for dermatoscopy images.

    Techniques:
    - Black-hat morphological filtering for hair detection
    - Conservative inpainting
    """

    def __init__(self, config: Optional[dict[str, Any]] = None):
        cfg = config or {}
        art_cfg = cfg.get("artifact_removal", {})
        self.enabled = art_cfg.get("enabled", False)
        self.hair_removal = art_cfg.get("hair_removal", True)
        self.kernel_size = art_cfg.get("morphological_kernel_size", 15)
        self.inpainting_radius = art_cfg.get("inpainting_radius", 6)

    def process(self, image: Image.Image) -> tuple[Image.Image, dict[str, Any]]:
        """
        Apply artifact removal if enabled.

        Parameters
        ----------
        image : PIL.Image.Image
            Original image.

        Returns
        -------
        tuple[PIL.Image, dict]
            (processed_image, transformation_log)
            If disabled, returns original image unchanged.
        """
        log: dict[str, Any] = {"enabled": self.enabled, "transformations": []}

        if not self.enabled:
            return image, log

        try:
            import cv2
        except ImportError:
            logger.warning("OpenCV not available; artifact removal skipped.")
            log["error"] = "opencv_not_available"
            return image, log

        img_array = np.array(image.convert("RGB"))

        if self.hair_removal:
            img_array, hair_log = self._remove_hair(img_array, cv2)
            log["transformations"].append(hair_log)

        result = Image.fromarray(img_array)
        return result, log

    def _remove_hair(self, img: np.ndarray, cv2) -> tuple[np.ndarray, dict]:
        """
        Remove hair artifacts using morphological black-hat filtering.

        This is a conservative approach that targets thin dark structures
        (like hair) without aggressively altering the lesion.
        """
        log = {"type": "hair_removal", "method": "morphological_blackhat"}

        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

        # Black-hat transform to detect dark, thin structures
        kernel = cv2.getStructuringElement(
            cv2.MORPH_CROSS,
            (self.kernel_size, self.kernel_size),
        )
        blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel)

        # Threshold to create hair mask
        _, mask = cv2.threshold(blackhat, 10, 255, cv2.THRESH_BINARY)

        # Optional: dilate mask slightly for better coverage
        dilate_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        mask = cv2.dilate(mask, dilate_kernel, iterations=1)

        # Count affected pixels
        affected_pixels = int(np.sum(mask > 0))
        total_pixels = mask.shape[0] * mask.shape[1]
        affected_ratio = affected_pixels / max(total_pixels, 1)

        log["affected_pixels"] = affected_pixels
        log["affected_ratio"] = round(affected_ratio, 4)

        # Safety: if too many pixels affected, skip (likely not hair)
        if affected_ratio > 0.15:
            log["skipped"] = True
            log["reason"] = "too_many_affected_pixels"
            logger.warning(
                "Hair removal skipped: %.1f%% pixels affected (threshold 15%%)",
                affected_ratio * 100,
            )
            return img, log

        # Inpaint the masked regions
        result = cv2.inpaint(img, mask, self.inpainting_radius, cv2.INPAINT_TELEA)
        log["skipped"] = False
        return result, log
