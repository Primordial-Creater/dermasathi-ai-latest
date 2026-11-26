from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.ml.demo_orchestrator import (
    GeminiRetryClient,
    arr,
    boolean,
    enum,
    number,
    obj,
    string,
)

# ------------------------------------------------------------------
# Structured schemas matching the frontend TypeScript contracts.
# ------------------------------------------------------------------

SYMPTOM_SCHEMA = obj(
    {
        "triage_level": enum(["emergency", "prompt_consult", "routine"]),
        "differentials": arr(
            obj(
                {
                    "condition_name": string(),
                    "educational_summary": string(),
                    "relevance_level": enum(["high", "moderate", "low"]),
                    "common_triggers": arr(string()),
                },
                [
                    "condition_name",
                    "educational_summary",
                    "relevance_level",
                    "common_triggers",
                ],
            )
        ),
        "red_flags": arr(string()),
        "self_care_precautions": arr(string()),
        "referral_guidance": string(),
        "disclaimer": string(),
    },
    [
        "triage_level",
        "differentials",
        "red_flags",
        "self_care_precautions",
        "referral_guidance",
        "disclaimer",
    ],
)

MEDICATION_SCHEMA = obj(
    {
        "safe_to_combine": boolean(),
        "interaction_alerts": arr(
            obj(
                {
                    "drugs_involved": arr(string()),
                    "severity": enum(["high", "moderate", "low"]),
                    "clinical_effect": string(),
                    "recommendation": string(),
                },
                [
                    "drugs_involved",
                    "severity",
                    "clinical_effect",
                    "recommendation",
                ],
            )
        ),
        "allergy_warnings": arr(string()),
        "condition_precautions": arr(string()),
        "identified_drugs": arr(
            obj(
                {
                    "name": string(),
                    "category": string(),
                    "common_skin_uses": string(),
                    "general_safety_precautions": arr(string()),
                    "potential_side_effects": arr(string()),
                },
                [
                    "name",
                    "category",
                    "common_skin_uses",
                    "general_safety_precautions",
                    "potential_side_effects",
                ],
            )
        ),
        "clinical_disclaimer": string(),
    },
    [
        "safe_to_combine",
        "interaction_alerts",
        "allergy_warnings",
        "condition_precautions",
        "identified_drugs",
        "clinical_disclaimer",
    ],
)

WELLNESS_SCHEMA = obj(
    {
        "concern_analysis": string(),
        "ayurvedic_perspective": string(),
        "dietary_recommendations": arr(string()),
        "lifestyle_practices": arr(string()),
        "traditional_topical_care": arr(
            obj(
                {
                    "herb_name": string(),
                    "sanskrit_name": string(),
                    "skin_benefits": string(),
                    "usage_guidance": string(),
                    "safety_precautions": string(),
                },
                [
                    "herb_name",
                    "sanskrit_name",
                    "skin_benefits",
                    "usage_guidance",
                    "safety_precautions",
                ],
            )
        ),
        "evidence_based_prevention": arr(string()),
        "cautionary_note": string(),
    },
    [
        "concern_analysis",
        "ayurvedic_perspective",
        "dietary_recommendations",
        "lifestyle_practices",
        "traditional_topical_care",
        "evidence_based_prevention",
        "cautionary_note",
    ],
)

REPORT_SCHEMA = obj(
    {
        "success": boolean(),
        "report_title": string(),
        "report_type": string(),
        "test_date": string(),
        "patient_summary": string(),
        "key_findings": arr(string()),
        "abnormal_values": arr(
            obj(
                {
                    "parameter": string(),
                    "value": string(),
                    "reference_range": string(),
                    "status": enum(
                        ["abnormal", "high", "low", "critical", "normal"]
                    ),
                    "clinical_significance": string(),
                },
                [
                    "parameter",
                    "value",
                    "reference_range",
                    "status",
                    "clinical_significance",
                ],
            )
        ),
        "normal_values": arr(string()),
        "doctor_questions": arr(string()),
        "urgency_level": enum(
            ["routine", "monitor", "consult_doctor", "emergency"]
        ),
        "conclusion": string(),
        "clinical_notes": string(),
        "clinical_disclaimer": string(),
        "timestamp": string(),
    },
    [
        "success",
        "report_title",
        "report_type",
        "test_date",
        "patient_summary",
        "key_findings",
        "abnormal_values",
        "normal_values",
        "doctor_questions",
        "urgency_level",
        "conclusion",
        "clinical_notes",
        "clinical_disclaimer",
        "timestamp",
    ],
)

EMERGENCY_SCHEMA = obj(
    {
        "is_emergency": boolean(),
        "triage_priority": enum(
            ["IMMEDIATE_EMERGENCY", "URGENT_EVALUATION", "ROUTINE"]
        ),
        "clinical_rationale": string(),
        "immediate_actions": arr(string()),
        "emergency_contacts": arr(
            obj(
                {
                    "name": string(),
                    "contact_number": string(),
                    "description": string(),
                },
                ["name", "contact_number", "description"],
            )
        ),
        "do_not_do_list": arr(string()),
        "disclaimer": string(),
    },
    [
        "is_emergency",
        "triage_priority",
        "clinical_rationale",
        "immediate_actions",
        "emergency_contacts",
        "do_not_do_list",
        "disclaimer",
    ],
)


PRESCRIPTION_MEDICINE_SCHEMA = obj(
    {
        "id": number(),
        "medicine_name": string(),
        "dosage": string(),
        "dosage_unit": string(),
        "frequency": string(),
        "timing": arr(string()),
        "duration": string(),
        "is_verified": boolean(),
        "is_unclear": boolean(),
        "unclear_reason": string(),
        "special_instructions": string(),
    },
    [
        "id",
        "medicine_name",
        "dosage",
        "dosage_unit",
        "frequency",
        "timing",
        "duration",
        "is_verified",
        "is_unclear",
        "unclear_reason",
        "special_instructions",
    ],
)

PRESCRIPTION_SCHEMA = obj(
    {
        "prescription_id": number(),
        "doctor_name": string(),
        "prescription_date": string(),
        "general_advice": string(),
        "medicines": arr(PRESCRIPTION_MEDICINE_SCHEMA),
    },
    [
        "prescription_id",
        "doctor_name",
        "prescription_date",
        "general_advice",
        "medicines",
    ],
)


SCHEMAS = {
    "symptoms": SYMPTOM_SCHEMA,
    "medications": MEDICATION_SCHEMA,
    "wellness": WELLNESS_SCHEMA,
    "reports": REPORT_SCHEMA,
    "emergency": EMERGENCY_SCHEMA,
    "prescriptions": PRESCRIPTION_SCHEMA,
}


def _client() -> GeminiRetryClient:
    return GeminiRetryClient()


def generate_json_fallback(
    feature: str,
    payload: dict[str, Any],
    language: str,
) -> dict[str, Any]:
    schema = SCHEMAS[feature]

    prompt = f"""
You are the Gemini fallback service inside DermaSathiAI.

FEATURE:
{feature}

RESPONSE LANGUAGE:
{language}

CRITICAL LANGUAGE RULE:
Every user-facing explanatory field MUST be written in {language}.
Do not leave explanatory sentences in English when another language was requested.
Standard medical/scientific names may remain in parentheses when appropriate.

SAFETY:
- This is educational/supportive assistance, not a diagnosis.
- Do not invent patient-specific prescriptions or dosages.
- Do not claim certainty when the available evidence is insufficient.
- For medicines, explain safety and verification rather than prescribing.
- For medication analysis, if ANY clinically relevant interaction, contraindication,
  or safety warning is identified, set safe_to_combine=false.
- Do not label a response as safe when interaction_alerts is non-empty.
- For Ayurveda, label traditional information as traditional/educational.
- Emergency situations must prioritize professional/emergency care.

USER INPUT:
{json.dumps(payload, ensure_ascii=False, indent=2)}

Return ONLY JSON matching the supplied response schema.
"""

    data, meta, error = _client().safe_generate(prompt, schema)

    if data is None:
        raise RuntimeError(error or f"Gemini fallback failed for {feature}")

    return data


def generate_file_fallback(
    feature: str,
    payload: dict[str, Any],
    language: str,
    file_path: str | Path,
) -> dict[str, Any]:
    schema = SCHEMAS[feature]

    prompt = f"""
You are the Gemini fallback service inside DermaSathiAI.

FEATURE:
{feature}

RESPONSE LANGUAGE:
{language}

Analyze the supplied document/image carefully and return only JSON matching
the supplied response schema.

LANGUAGE:
Every explanatory/user-facing value must be written in {language}.
Keep standardized medical/scientific names when useful.

SAFETY:
- Do not claim diagnostic certainty.
- Do not invent dosage or patient-specific treatment plans.
- State uncertainty when information is unreadable or inadequate.
- Recommend professional evaluation where appropriate.

ADDITIONAL USER DATA:
{json.dumps(payload, ensure_ascii=False, indent=2)}
"""

    data, meta, error = _client().safe_generate(
        prompt,
        schema,
        file_path,
    )

    if data is None:
        raise RuntimeError(error or f"Gemini fallback failed for {feature}")

    return data


__all__ = [
    "generate_json_fallback",
    "generate_file_fallback",
]
