from __future__ import annotations

import time
from datetime import datetime, timezone

from app.schemas.skin_analysis import (
    CandidateFinding,
    ImageQualityMetrics,
    ReferralRecommendation,
    SkinAnalysisResponse,
    SkinAnalysisTopPrediction,
)
from app.services.skin_ai_gateway import skin_ai_gateway
from app.services.skin_pipeline.quality_gate import ImageQualityGate


class SkinPipelineOrchestrator:
    """Compatibility adapter for both existing skin-analysis API routes.

    The old local TensorFlow disease models are not invoked in this user-facing
    flow. Image quality checks remain deterministic; image interpretation uses
    the central Gemini/Groq provider manager.
    """

    def __init__(self) -> None:
        self.quality_gate = ImageQualityGate()

    def is_available(self) -> bool:
        return True

    async def process_image(
        self,
        image_bytes: bytes,
        language: str = "en",
        image_mime_type: str = "image/jpeg",
        user_context: str = "",
    ) -> SkinAnalysisResponse:
        started = time.perf_counter()
        passed, quality_metrics, _ = self.quality_gate.evaluate(image_bytes)

        if not passed:
            reason = "The photograph does not meet the image-quality requirements. Please retake it using the guidance below."
            return SkinAnalysisResponse(
                status="ABSTAINED_LOW_QUALITY",
                quality=quality_metrics,
                quality_gate=quality_metrics,
                findings=[],
                abstained=True,
                abstention_reason=reason,
                reason=reason,
                referral=ReferralRecommendation(
                    urgency="routine",
                    recommended_timeframe="Retake the image. Seek professional review if the skin concern is persistent, changing, or worrying.",
                    actionable_instructions=quality_metrics.feedback_messages,
                ),
                clinical_disclaimer=(
                    "Image quality was insufficient. No skin-condition assessment was made. "
                    "This service does not provide a confirmed diagnosis."
                ),
                processing_time_ms=round((time.perf_counter() - started) * 1000, 1),
            )

        payload, provider_meta = await skin_ai_gateway.analyze(
            image_bytes=image_bytes,
            image_mime_type=image_mime_type,
            language=language,
            user_context=user_context,
        )

        primary = payload.prediction
        findings: list[CandidateFinding] = []
        if primary.label and primary.scope != "uncertain":
            findings.append(
                CandidateFinding(
                    category_name=primary.display_label or primary.label,
                    calibrated_probability=None,
                    confidence_level=primary.confidence_level,
                    general_information=primary.rationale,
                    typical_clinical_features=payload.visible_observations,
                )
            )
        for alternative in payload.alternatives:
            findings.append(
                CandidateFinding(
                    category_name=alternative.condition_name,
                    calibrated_probability=None,
                    confidence_level=alternative.confidence_level,
                    general_information=alternative.rationale,
                    typical_clinical_features=alternative.supporting_observations,
                )
            )

        abstained = payload.status != "supported" or primary.scope == "uncertain"
        high_concern = payload.risk_level == "high" or bool(payload.red_flags)
        urgency = "prompt_consult" if high_concern else "routine"
        referral = ReferralRecommendation(
            urgency=urgency,
            recommended_timeframe=payload.referral_timeframe,
            recommended_specialist=payload.recommended_specialist,
            actionable_instructions=payload.next_action,
            red_flags_present=payload.red_flags,
        )
        display_prediction = primary.display_label or primary.label
        elapsed = round((time.perf_counter() - started) * 1000, 1)

        # Provider/model metadata is kept out of the patient-facing response.
        # It is returned by the gateway for server-side logging/audit only.
        return SkinAnalysisResponse(
            status="ABSTAINED_HIGH_UNCERTAINTY" if abstained else "SUCCESS",
            analysis_provider=provider_meta.get("provider"),
            analysis_model=provider_meta.get("model"),
            fallback_used=bool(provider_meta.get("fallback_used")),
            provider_latency_ms=provider_meta.get("latency_ms"),
            prediction=display_prediction,
            predicted_class=display_prediction,
            top_predictions=[
                SkinAnalysisTopPrediction(
                    class_name=display_prediction,
                    class_index=0,
                    raw_probability=None,
                    calibrated_probability=None,
                )
            ] if display_prediction else [],
            raw_probability=None,
            calibrated_confidence=None,
            uncertainty=None,
            is_high_risk=payload.risk_level == "high",
            quality=quality_metrics,
            quality_gate=quality_metrics,
            findings=findings,
            uncertainty_score=None,
            abstained=abstained,
            abstention_reason=(payload.message if abstained else None),
            reason=(payload.message if abstained else None),
            referral=referral,
            assessment=payload,
            care=payload.care,
            clinical_disclaimer=payload.disclaimer,
            requires_professional_review=True,
            timestamp=datetime.now(timezone.utc).isoformat(),
            processing_time_ms=elapsed,
        )


skin_pipeline = SkinPipelineOrchestrator()
