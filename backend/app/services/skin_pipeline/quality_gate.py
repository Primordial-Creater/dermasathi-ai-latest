import io

import cv2
import numpy as np
from PIL import Image

from app.core.config import settings
from app.schemas.skin_analysis import ImageQualityMetrics
from app.core.logging import logger


class ImageQualityGate:
    """Deterministic image-suitability checks; this is not disease inference."""

    def __init__(self, blur_threshold: float = settings.QUALITY_BLUR_THRESHOLD):
        self.blur_threshold = blur_threshold

    def evaluate(self, image_bytes: bytes):
        messages: list[str] = []
        is_blurry = False
        is_underexposed = False
        is_overexposed = False

        arr = np.frombuffer(image_bytes, np.uint8)
        img_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            try:
                pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                img_bgr = cv2.cvtColor(np.asarray(pil_img), cv2.COLOR_RGB2BGR)
            except Exception as exc:
                logger.warning("Skin image decode failed: %s", type(exc).__name__)
                metrics = ImageQualityMetrics(
                    is_acceptable=False,
                    status="corrupt",
                    score=0.0,
                    is_blurry=True,
                    is_underexposed=True,
                    issues=["Unable to decode the uploaded image. Please upload a valid JPEG, PNG, or WebP photo."],
                    feedback_messages=["Unable to decode the uploaded image. Please upload a valid JPEG, PNG, or WebP photo."],
                    user_action="Choose a clear JPEG, PNG, or WebP image and upload it again.",
                )
                return False, metrics, np.zeros((1, 1, 3), dtype=np.uint8)

        height, width = img_bgr.shape[:2]
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        brightness = float(np.mean(gray))

        if width < 150 or height < 150:
            messages.append("The image resolution is too low. Upload a larger, clearer photograph.")
        if blur_score < self.blur_threshold:
            is_blurry = True
            messages.append("The photograph appears blurry. Hold the camera steady and refocus on the affected skin area.")
        if brightness < 40.0:
            is_underexposed = True
            messages.append("The photograph is too dark. Retake it in soft, even daylight.")
        elif brightness > 225.0:
            is_overexposed = True
            messages.append("The photograph has strong glare or overexposure. Avoid direct flash and harsh reflections.")

        acceptable = not messages
        if acceptable:
            messages.append("Basic image-quality checks passed. This does not guarantee that the image contains enough detail for assessment.")
        score = 1.0 if acceptable else max(0.0, min(0.95, 0.25 + (0.15 if not is_blurry else 0.0) + (0.15 if not is_underexposed and not is_overexposed else 0.0)))
        status = "usable" if acceptable else "poor_quality"
        user_action = None if acceptable else "Please retake the photograph using the guidance above."

        metrics = ImageQualityMetrics(
            is_acceptable=acceptable,
            blur_score=round(blur_score, 2),
            is_blurry=is_blurry,
            brightness_score=round(brightness, 2),
            is_underexposed=is_underexposed,
            is_overexposed=is_overexposed,
            resolution=[width, height],
            feedback_messages=messages,
            status=status,
            score=round(score, 2),
            issues=messages,
            user_action=user_action,
        )
        return acceptable, metrics, img_bgr
