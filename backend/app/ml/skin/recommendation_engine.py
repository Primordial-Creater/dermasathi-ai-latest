from __future__ import annotations

import json
from pathlib import Path
from typing import Any


_ROOT = Path(__file__).resolve().parents[4]

_PROFILE_FILE = (
    _ROOT
    / "backend"
    / "models"
    / "skin_ai"
    / "recommendations"
    / "skin_disease_profiles.json"
)

_PROFILES: dict[str, dict[str, Any]] | None = None


def _load_profiles() -> dict[str, dict[str, Any]]:
    global _PROFILES

    if _PROFILES is None:
        with _PROFILE_FILE.open(encoding="utf-8") as f:
            _PROFILES = json.load(f)

    return _PROFILES


def build_recommendation(
    status: str,
    predicted_class: str | None,
    *,
    confidence: float | None = None,
    user_context: dict[str, Any] | None = None,
) -> dict[str, Any]:

    # Never generate disease-specific treatment when the
    # model has abstained or flagged the condition as unsupported.
    if status != "assessment_available" or not predicted_class:
        return {
            "available": False,
            "disease": None,
            "message": (
                "A reliable disease assessment is not available "
                "from this image. Disease-specific medication "
                "should not be recommended."
            ),
            "professional_review_required": True,
            "medication": None,
            "lifestyle": [],
            "ayurveda": None,
            "red_flags": [],
        }

    profiles = _load_profiles()

    profile = profiles.get(predicted_class)

    if profile is None:
        return {
            "available": False,
            "disease": None,
            "message": (
                "No validated recommendation profile exists "
                "for this result."
            ),
            "professional_review_required": True,
            "medication": None,
            "lifestyle": [],
            "ayurveda": None,
            "red_flags": [],
        }

    return {
        "available": True,
        "disease": predicted_class,
        "severity": profile["severity"],
        "care_level": profile["care_level"],
        "summary": profile["summary"],
        "confidence": confidence,
        "professional_review_required": True,
        "medication": profile["medication_guidance"],
        "lifestyle": profile["lifestyle"],
        "ayurveda": profile["ayurveda"],
        "red_flags": profile["red_flags"],
    }
