from __future__ import annotations

import re
from typing import Any, Dict

from app.schemas.medications import (
    DrugInteractionRequest,
    DrugSafetyResponse,
    InteractionAlert,
    DrugProfile,
)


# This is deliberately a small, transparent local reference list, not a complete
# drug-interaction database. It must never be used to declare unknown pairs safe.
DRUG_DATABASE: Dict[str, Dict] = {
    "isotretinoin": {
        "category": "Oral Retinoid",
        "uses": "Severe nodular or recalcitrant acne.",
        "precautions": ["Absolute contraindication in pregnancy (teratogenic)", "Monitor lipid panel and liver enzymes", "Strict sun avoidance"],
        "side_effects": ["Severe dryness of lips/mucosa", "Photosensitivity", "Elevated triglycerides"]
    },
    "hydrocortisone": {
        "category": "Mild Topical Corticosteroid",
        "uses": "Temporary relief of itching and mild dermatitis.",
        "precautions": ["Do not use for more than 7-14 consecutive days without medical supervision", "Avoid applying near eyelids/eyes"],
        "side_effects": ["Skin thinning (atrophy) with prolonged misuse", "Telangiectasia", "Steroid rebound"]
    },
    "clobetasol": {
        "category": "Super-Potent Topical Corticosteroid",
        "uses": "Short-term treatment of inflammatory and pruritic manifestations of moderate-to-severe dermatoses (e.g. plaque psoriasis).",
        "precautions": ["Never apply to the face, groin, or axillae", "Never use under occlusion without physician advice", "Limit use to 2 consecutive weeks"],
        "side_effects": ["Hypothalamic-pituitary-adrenal axis suppression", "Striae", "Skin atrophy"]
    },
    "doxycycline": {
        "category": "Oral Tetracycline Antibiotic",
        "uses": "Moderate-to-severe inflammatory acne vulgaris, rosacea.",
        "precautions": ["High photosensitivity risk - use broad-spectrum sunscreen", "Do not take concurrently with oral retinoids (risk of pseudotumor cerebri)", "Take with full glass of water sitting upright"],
        "side_effects": ["Esophageal irritation", "Sunburn susceptibility", "Nausea"]
    },
    "benzoyl peroxide": {
        "category": "Topical Antimicrobial & Keratolytic",
        "uses": "Mild to moderate acne vulgaris.",
        "precautions": ["May bleach clothing, towels, and hair", "Can cause significant skin dryness and irritation in early weeks"],
        "side_effects": ["Erythema", "Contact dermatitis", "Peeling"]
    },
    "ketoconazole": {
        "category": "Topical/Oral Antifungal",
        "uses": "Cutaneous candidiasis, tinea corporis, seborrheic dermatitis.",
        "precautions": ["For topical formulations, avoid contact with conjunctiva"],
        "side_effects": ["Mild burning sensation", "Pruritus"]
    }
}

INTERACTION_RULES = [
    {
        "pair": {"isotretinoin", "doxycycline"},
        "severity": "high",
        "clinical_effect": "Combining oral retinoids (isotretinoin) and tetracyclines (doxycycline) dramatically increases the risk of benign intracranial hypertension (Pseudotumor Cerebri).",
        "recommendation": "DO NOT combine these medications. This combination is strictly contraindicated."
    },
    {
        "pair": {"tretinoin", "benzoyl peroxide"},
        "severity": "moderate",
        "clinical_effect": "Co-applying standard tretinoin and benzoyl peroxide simultaneously can degrade tretinoin molecules and exacerbate severe irritant contact dermatitis.",
        "recommendation": "Separate application times: Apply benzoyl peroxide in the morning and tretinoin at bedtime, or consult your dermatologist for micro-encapsulated formulations."
    }
]

def _normalise(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9.+%-]+", " ", (value or "").casefold())).strip()


def _contains_term(text: str, term: str) -> bool:
    """Match a whole ingredient name, not arbitrary substrings such as 'a'."""
    escaped = re.escape(_normalise(term))
    return bool(escaped and re.search(rf"(?<![a-z0-9]){escaped}(?![a-z0-9])", _normalise(text)))


class MedicationService:
    @staticmethod
    def check_safety(req: DrugInteractionRequest) -> DrugSafetyResponse:
        input_drugs = [item.strip() for item in req.medications if item and item.strip()]
        canonical_names = set(DRUG_DATABASE)
        for rule in INTERACTION_RULES:
            canonical_names.update(rule["pair"])

        matched_profiles: list[DrugProfile] = []
        matched_names: list[str] = []
        unrecognized: list[str] = []

        for supplied in input_drugs:
            matches = [name for name in sorted(canonical_names, key=lambda item: (-len(item), item)) if _contains_term(supplied, name)]
            if not matches:
                unrecognized.append(supplied)
            for canonical in matches:
                if canonical not in matched_names:
                    matched_names.append(canonical)
                profile = DRUG_DATABASE.get(canonical)
                if profile and not any(item.name.casefold() == canonical for item in matched_profiles):
                    matched_profiles.append(
                        DrugProfile(
                            name=canonical,
                            category=profile["category"],
                            common_skin_uses=profile["uses"],
                            general_safety_precautions=profile["precautions"],
                            potential_side_effects=profile["side_effects"],
                        )
                    )

        interaction_alerts: list[InteractionAlert] = []
        for rule in INTERACTION_RULES:
            if rule["pair"].issubset(set(matched_names)):
                interaction_alerts.append(
                    InteractionAlert(
                        drugs_involved=sorted(rule["pair"]),
                        severity=rule["severity"],
                        clinical_effect=rule["clinical_effect"],
                        recommendation=rule["recommendation"],
                    )
                )

        allergy_warnings: list[str] = []
        for allergy in req.allergies:
            allergy_clean = _normalise(allergy)
            for supplied in input_drugs:
                # Exact ingredient/name overlap only. This is not a class-cross-
                # reactivity assessment and must not imply that other allergies are safe.
                supplied_clean = _normalise(supplied)
                if allergy_clean and (allergy_clean == supplied_clean or _contains_term(supplied_clean, allergy_clean)):
                    allergy_warnings.append(
                        f"Reported allergy '{allergy}' matches the supplied medication '{supplied}'. "
                        "Confirm this with a pharmacist or prescriber before taking it."
                    )

        condition_precautions: list[str] = []
        is_pregnant = any("pregnan" in condition.casefold() for condition in req.patient_conditions)
        if is_pregnant:
            if any(name in matched_names for name in ("isotretinoin", "tretinoin")):
                condition_precautions.append(
                    "Retinoid exposure during pregnancy or planned pregnancy requires urgent prescriber review. "
                    "Do not rely on this automated checker; contact the prescribing clinician promptly."
                )

        has_alerts = bool(interaction_alerts)
        has_warnings = bool(allergy_warnings or condition_precautions)
        if has_alerts:
            safety_status = "known_interaction_alert"
            safe_to_combine: bool | None = False
        elif has_warnings:
            safety_status = "warning_detected"
            safe_to_combine = False
        else:
            safety_status = "not_established_by_limited_rules"
            safe_to_combine = None

        return DrugSafetyResponse(
            safe_to_combine=safe_to_combine,
            safety_status=safety_status,
            review_required=True,
            matched_medications=matched_names,
            unrecognized_medications=unrecognized,
            allergy_review_required=bool(req.allergies),
            interaction_alerts=interaction_alerts,
            allergy_warnings=allergy_warnings,
            condition_precautions=condition_precautions,
            identified_drugs=matched_profiles,
        )
