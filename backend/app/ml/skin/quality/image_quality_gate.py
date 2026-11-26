"""
DermaSathiAI — Image Quality Gate
==================================
Reusable quality assessment for dermatology images.
Checks: resolution, blur, exposure, contrast, format, file integrity.

Returns structured quality result; does NOT silently discard images.
"""

from __future__ import annotations

import io
import logging
from pathlib import Path
from typing import Any, Optional, Union

import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None

from PIL import Image, UnidentifiedImageError

from app.ml.skin.schemas.prediction_schema import (
    ImageQualityResult,
    QualityIssue,
    QualityStatus,
)

logger = logging.getLogger(__name__)


class ImageQualityGate:
    """
    Assess whether a dermatology image meets minimum quality
    requirements for model inference.

    All thresholds are configurable via the quality_gate config section.
    """

    def __init__(self, config: Optional[dict[str, Any]] = None):
        cfg = config or {}
        self.min_resolution = cfg.get("min_resolution", 64)
        self.max_resolution = cfg.get("max_resolution", 4096)
        self.min_file_size = cfg.get("min_file_size_bytes", 1024)
        self.max_file_size = cfg.get("max_file_size_bytes", 50 * 1024 * 1024)
        self.blur_threshold = cfg.get("blur_threshold", 50.0)
        self.min_brightness = cfg.get("min_brightness", 20)
        self.max_brightness = cfg.get("max_brightness", 240)
        self.min_contrast = cfg.get("min_contrast", 15)
        self.supported_formats = set(
            cfg.get("supported_formats", ["jpg", "jpeg", "png", "bmp", "tiff", "webp"])
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def assess(
        self,
        image_input: Union[str, Path, bytes, np.ndarray, Image.Image],
        file_size_bytes: Optional[int] = None,
    ) -> ImageQualityResult:
        """
        Run all quality checks on an image.

        Parameters
        ----------
        image_input : str | Path | bytes | np.ndarray | PIL.Image
            The image to assess.
        file_size_bytes : int, optional
            File size in bytes (required if input is not a path).

        Returns
        -------
        ImageQualityResult
            Structured quality assessment.
        """
        issues: list[QualityIssue] = []
        details: dict[str, Any] = {}
        score_components: list[float] = []

        # --- Load image ---
        try:
            pil_img, file_size = self._load_image(image_input, file_size_bytes)
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            logger.warning("Corrupt/unreadable image: %s", exc)
            return ImageQualityResult(
                quality_status=QualityStatus.CORRUPT,
                quality_score=0.0,
                issues=[QualityIssue.CORRUPT_FILE],
                details={"error": str(exc)},
                user_action="The image file appears corrupt. Please upload a valid image.",
            )

        width, height = pil_img.size
        details["width"] = width
        details["height"] = height
        details["file_size_bytes"] = file_size

        # --- Format check ---
        fmt = (pil_img.format or "").lower()
        if fmt and fmt not in self.supported_formats and fmt.replace("jpeg", "jpg") not in self.supported_formats:
            issues.append(QualityIssue.INVALID_FORMAT)
            details["format"] = fmt

        # --- File size checks ---
        if file_size is not None:
            if file_size < self.min_file_size:
                issues.append(QualityIssue.FILE_TOO_SMALL)
            if file_size > self.max_file_size:
                issues.append(QualityIssue.FILE_TOO_LARGE)

        # --- Resolution checks ---
        if width < self.min_resolution or height < self.min_resolution:
            issues.append(QualityIssue.LOW_RESOLUTION)
        if width > self.max_resolution or height > self.max_resolution:
            issues.append(QualityIssue.HIGH_RESOLUTION)

        # --- Aspect ratio check ---
        aspect = max(width, height) / max(min(width, height), 1)
        details["aspect_ratio"] = round(aspect, 2)
        if aspect > 4.0:
            issues.append(QualityIssue.EXTREME_ASPECT_RATIO)

        # --- Convert to numpy for pixel-level checks ---
        img_array = np.array(pil_img.convert("RGB"))

        # --- Blur detection (Laplacian variance) ---
        blur_score = self._compute_blur_score(img_array)
        details["blur_score"] = round(blur_score, 2)
        if blur_score < self.blur_threshold:
            issues.append(QualityIssue.BLUR)
            score_components.append(max(0.0, blur_score / self.blur_threshold))
        else:
            score_components.append(1.0)

        # --- Brightness check ---
        gray = np.mean(img_array, axis=2) if img_array.ndim == 3 else img_array.astype(float)
        mean_brightness = float(np.mean(gray))
        details["mean_brightness"] = round(mean_brightness, 2)
        if mean_brightness < self.min_brightness:
            issues.append(QualityIssue.UNDEREXPOSED)
            score_components.append(max(0.0, mean_brightness / self.min_brightness))
        elif mean_brightness > self.max_brightness:
            issues.append(QualityIssue.OVEREXPOSED)
            score_components.append(max(0.0, (255 - mean_brightness) / (255 - self.max_brightness)))
        else:
            score_components.append(1.0)

        # --- Contrast check (std deviation of pixel intensities) ---
        contrast = float(np.std(gray))
        details["contrast"] = round(contrast, 2)
        if contrast < self.min_contrast:
            issues.append(QualityIssue.LOW_CONTRAST)
            score_components.append(max(0.0, contrast / self.min_contrast))
        else:
            score_components.append(1.0)

        # --- Compute overall quality score ---
        quality_score = float(np.mean(score_components)) if score_components else 1.0
        quality_score = round(max(0.0, min(1.0, quality_score)), 3)

        # --- Determine status ---
        if QualityIssue.CORRUPT_FILE in issues:
            status = QualityStatus.CORRUPT
        elif len(issues) >= 2:
            status = QualityStatus.REJECTED
        elif len(issues) == 1 and issues[0] in (
            QualityIssue.FILE_TOO_LARGE,
            QualityIssue.INVALID_FORMAT,
        ):
            status = QualityStatus.REJECTED
        elif len(issues) == 1:
            status = QualityStatus.POOR_QUALITY
        else:
            status = QualityStatus.USABLE

        user_action = None
        if status in (QualityStatus.REJECTED, QualityStatus.POOR_QUALITY):
            user_action = self._suggest_action(issues)

        return ImageQualityResult(
            quality_status=status,
            quality_score=quality_score,
            issues=issues,
            details=details,
            user_action=user_action,
        )

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _load_image(
        self,
        image_input: Union[str, Path, bytes, np.ndarray, Image.Image],
        file_size_bytes: Optional[int],
    ) -> tuple[Image.Image, Optional[int]]:
        """Load image from various input types."""
        if isinstance(image_input, Image.Image):
            return image_input, file_size_bytes

        if isinstance(image_input, np.ndarray):
            return Image.fromarray(image_input), file_size_bytes

        if isinstance(image_input, bytes):
            img = Image.open(io.BytesIO(image_input))
            img.load()  # Force decode to catch corruption
            return img, len(image_input)

        # Path
        path = Path(image_input)
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {path}")
        file_size = path.stat().st_size
        img = Image.open(path)
        img.load()
        return img, file_size

    @staticmethod
    def _compute_blur_score(img_array: np.ndarray) -> float:
        """
        Compute blur score using Laplacian variance.
        Higher = sharper. Uses OpenCV if available, else numpy fallback.
        """
        # Convert to grayscale
        if img_array.ndim == 3:
            gray = np.mean(img_array, axis=2).astype(np.float64)
        else:
            gray = img_array.astype(np.float64)

        if cv2 is not None:
            gray_u8 = gray.astype(np.uint8)
            lap = cv2.Laplacian(gray_u8, cv2.CV_64F)
            return float(lap.var())

        # Numpy fallback Laplacian approximation
        kernel = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype=np.float64)
        from scipy.signal import convolve2d
        lap = convolve2d(gray, kernel, mode="same", boundary="symm")
        return float(np.var(lap))

    @staticmethod
    def _suggest_action(issues: list[QualityIssue]) -> str:
        """Generate a user-facing suggestion based on detected issues."""
        suggestions = []
        if QualityIssue.BLUR in issues:
            suggestions.append("hold the camera steady for a sharper image")
        if QualityIssue.UNDEREXPOSED in issues:
            suggestions.append("use better lighting — the image is too dark")
        if QualityIssue.OVEREXPOSED in issues:
            suggestions.append("reduce lighting — the image is too bright")
        if QualityIssue.LOW_RESOLUTION in issues:
            suggestions.append("use a higher-resolution camera or move closer")
        if QualityIssue.LOW_CONTRAST in issues:
            suggestions.append("ensure the skin area is clearly visible")
        if QualityIssue.INVALID_FORMAT in issues:
            suggestions.append("upload a JPG, PNG, or WebP image")
        if not suggestions:
            return "Please capture another image with better quality."
        return "Please " + "; ".join(suggestions) + "."
