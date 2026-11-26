"""
DermaSathiAI Gemini Demo Gateway — fixed for current google-genai SDK.

This is an external Gemini-assisted demo provider, not the local trained model.
It returns frontend-friendly structured JSON and keeps safety/provenance explicit.
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import os
import random
import time
import warnings
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types

warnings.filterwarnings("ignore", message=r"Direct use of automatic function calling.*")

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
MODEL_FALLBACKS = [
    m.strip() for m in os.getenv(
        "GEMINI_MODEL_FALLBACKS",
        "gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash",
    ).split(",") if m.strip()
]

SUPPORTED_DISEASES = [
    "AK", "BCC", "BKL", "Chickenpox", "Cowpox", "Dermatofibroma", "HFMD",
    "Healthy", "Measles", "Nevi", "Melanoma", "Monkeypox", "SCC", "Vascular", "OTHER",
]
SKIN_SCOPES = ["local_14", "other_dermatologic", "normal_appearing", "uncertain"]


def obj(*, properties: dict[str, Any], required: list[str]) -> dict[str, Any]:
    return {"type": "object", "properties": properties, "required": required}


def arr(item: dict[str, Any]) -> dict[str, Any]:
    return {"type": "array", "items": item}


def enum(values: list[str]) -> dict[str, Any]:
    return {"type": "string", "enum": values}


def string() -> dict[str, Any]:
    return {"type": "string"}


def boolean() -> dict[str, Any]:
    return {"type": "boolean"}


def number() -> dict[str, Any]:
    return {"type": "number", "minimum": 0, "maximum": 1}


CANDIDATE_SCHEMA = obj(
    properties={
        "canonical_label": string(),
        "display_label": string(),
        "scope": enum(SKIN_SCOPES),
        "confidence_estimate": number(),
        "rationale": string(),
    },
    required=["canonical_label", "display_label", "scope", "confidence_estimate", "rationale"],
)

APPEARANCE_SCHEMA = obj(
    properties={
        "classification": enum([
            "normal_appearing", "dryness_features", "oily_features",
            "irritation_features", "pigmentation_features", "lesion_present", "uncertain"
        ]),
        "notes": string(),
    },
    required=["classification", "notes"],
)

IMAGE_QUALITY_SCHEMA = obj(
    properties={
        "acceptable": boolean(),
        "lighting": enum(["good", "acceptable", "poor", "unknown"]),
        "blur": enum(["none", "mild", "severe", "unknown"]),
        "framing": enum(["good", "acceptable", "poor", "unknown"]),
        "resolution": enum(["good", "acceptable", "poor", "unknown"]),
        "comments": arr(string()),
    },
    required=["acceptable", "lighting", "blur", "framing", "resolution", "comments"],
)

SKIN_SCHEMA = obj(
    properties={
        "status": enum(["supported", "needs_better_image", "abstain", "error"]),
        "reason": string(),
        "message": string(),
        "image_quality": IMAGE_QUALITY_SCHEMA,
        "appearance_assessment": APPEARANCE_SCHEMA,
        "prediction": CANDIDATE_SCHEMA,
        "alternatives": arr(CANDIDATE_SCHEMA),
        "risk_level": enum(["low", "moderate", "high", "unknown"]),
        "referral_required": boolean(),
        "diagnosis_confirmed": boolean(),
        "professional_evaluation_required": boolean(),
        "next_action": arr(string()),
        "disclaimer": string(),
    },
    required=[
        "status", "reason", "message", "image_quality", "appearance_assessment",
        "prediction", "alternatives", "risk_level", "referral_required", "diagnosis_confirmed",
        "professional_evaluation_required", "next_action", "disclaimer",
    ],
)

TRIAGE_SCHEMA = obj(
    properties={
        "status": enum(["ok", "urgent", "needs_clinician", "insufficient_information"]),
        "urgency": enum(["low", "moderate", "high", "unknown"]),
        "red_flags": arr(string()),
        "likely_problem_area": string(),
        "follow_up_questions": arr(string()),
        "next_action": arr(string()),
        "disclaimer": string(),
    },
    required=["status", "urgency", "red_flags", "likely_problem_area", "follow_up_questions", "next_action", "disclaimer"],
)

MEDICINE_ITEM_SCHEMA = obj(
    properties={
        "input_name": string(),
        "normalized_name": string(),
        "medicine_type": string(),
        "safety_flags": arr(string()),
        "interaction_concerns": arr(string()),
        "duplicate_or_overlap_concerns": arr(string()),
        "verification_required": boolean(),
    },
    required=[
        "input_name", "normalized_name", "medicine_type", "safety_flags",
        "interaction_concerns", "duplicate_or_overlap_concerns", "verification_required",
    ],
)

MEDICINE_SCHEMA = obj(
    properties={
        "status": enum(["checked_with_verification", "insufficient_information"]),
        "medicines": arr(MEDICINE_ITEM_SCHEMA),
        "general_safety_notes": arr(string()),
        "prescribing_allowed": boolean(),
        "dosage_generated": boolean(),
        "next_action": arr(string()),
        "disclaimer": string(),
    },
    required=[
        "status", "medicines", "general_safety_notes", "prescribing_allowed",
        "dosage_generated", "next_action", "disclaimer",
    ],
)

AYURVEDA_SCHEMA = obj(
    properties={
        "status": enum(["supported", "uncertain", "out_of_scope"]),
        "intent": string(),
        "entities": arr(string()),
        "traditional_information": arr(string()),
        "practical_wellness_points": arr(string()),
        "safety_notes": arr(string()),
        "evidence_level": enum(["traditional_educational", "uncertain", "out_of_scope"]),
        "clinical_claim": boolean(),
        "needs_kb_verification": boolean(),
        "disclaimer": string(),
    },
    required=[
        "status", "intent", "entities", "traditional_information", "practical_wellness_points",
        "safety_notes", "evidence_level", "clinical_claim", "needs_kb_verification", "disclaimer",
    ],
)


class GeminiDemoGateway:
    def __init__(self, api_key: str | None = None, model: str | None = None):
        key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        self.client = genai.Client(api_key=key)
        requested = model or DEFAULT_MODEL
        # Keep requested model first; fallback only when an API 5xx is encountered.
        self.models = []
        for m in [requested, *MODEL_FALLBACKS]:
            if m and m not in self.models:
                self.models.append(m)
        self.model = self.models[0]

    @staticmethod
    def _image_part(image_path: str | Path) -> types.Part:
        path = Path(image_path)
        if not path.is_file():
            raise FileNotFoundError(f"Image not found: {path}")
        mime = mimetypes.guess_type(path.name)[0] or "image/jpeg"
        return types.Part.from_bytes(data=path.read_bytes(), mime_type=mime)

    def _is_transient(self, exc: Exception) -> bool:
        status = getattr(exc, "status_code", None)
        text = str(exc).upper()
        return status in {408, 429, 500, 502, 503, 504} or any(
            token in text for token in ("408", "429", "500", "502", "503", "504",
                                        "UNAVAILABLE", "RESOURCE_EXHAUSTED", "TIMEOUT", "DEADLINE")
        )

    def _generate(self, prompt: str, schema: dict[str, Any], image_path: str | Path | None = None) -> dict[str, Any]:
        contents: list[Any] = [prompt]
        if image_path is not None:
            contents.insert(0, self._image_part(image_path))

        infinite_retry = os.getenv("GEMINI_INDEFINITE_RETRY", "1") == "1"
        max_total = float(os.getenv("GEMINI_MAX_TOTAL_SECONDS", "180"))
        backoff_base = float(os.getenv("GEMINI_BACKOFF_BASE", "1.25"))
        backoff_max = float(os.getenv("GEMINI_BACKOFF_MAX", "12"))
        jitter = float(os.getenv("GEMINI_BACKOFF_JITTER", "0.35"))
        started = time.perf_counter()
        attempts = 0
        round_idx = 0
        last_error: Exception | None = None

        while True:
            round_idx += 1
            for model in self.models:
                attempts += 1
                try:
                    response = self.client.models.generate_content(
                        model=model, contents=contents,
                        config=types.GenerateContentConfig(
                            system_instruction=(
                                "You are the external AI demonstration engine for DermaSathiAI. "
                                "Return only JSON matching the requested schema. Do not claim medical certainty. "
                                "Never output a confirmed diagnosis. Never invent a prescription, dose, frequency, "
                                "duration, or medication time. You may structure medication instructions explicitly "
                                "supplied by a clinician/prescription, but must mark them as user_or_clinician provided. "
                                "Prefer abstention/referral when evidence is inadequate."
                            ),
                            response_mime_type="application/json", response_schema=schema,
                        ),
                    )
                    if not response.text:
                        raise RuntimeError("Gemini returned an empty response")
                    data=json.loads(response.text)
                    if not isinstance(data,dict):
                        raise RuntimeError("Gemini returned non-object JSON")
                    for key in ("diagnosis_confirmed","clinical_claim","prescribing_allowed","dosage_generated"):
                        if key in data:
                            data[key]=False
                    if isinstance(data.get("medicines"),list):
                        for item in data["medicines"]:
                            if isinstance(item,dict):
                                item["verification_required"]=True
                    if isinstance(data.get("medicine_information"),list):
                        for item in data["medicine_information"]:
                            if isinstance(item,dict):
                                item["verification_required"]=True
                    if isinstance(data.get("prescription_adherence"),list):
                        for item in data["prescription_adherence"]:
                            if isinstance(item,dict):
                                item["schedule_source"]="user_or_clinician_provided_instruction"
                    self.model=model
                    return data
                except Exception as exc:
                    last_error=exc
                    if not self._is_transient(exc):
                        raise
                    elapsed=time.perf_counter()-started
                    if not infinite_retry and elapsed>=max_total:
                        raise TimeoutError(f"Gemini retry budget exceeded after {attempts} attempts ({elapsed:.1f}s): {last_error}") from last_error
                    delay=min(backoff_max, backoff_base*(2**min(round_idx-1,4))) + random.uniform(0,jitter)
                    if not infinite_retry:
                        delay=min(delay,max(0.1,max_total-elapsed))
                    time.sleep(max(0.1,delay))

    def _provenance(self, **extra: Any) -> dict[str, Any]:
        return {
            "provider": "Google Gemini",
            "model": self.model,
            "mode": "external_demo_assist",
            "local_model_used": False,
            **extra,
        }

    def analyze_skin(self, image_path: str | Path, user_context: str = "", language: str = "en") -> dict[str, Any]:
        allowed = ", ".join(SUPPORTED_DISEASES)
        prompt = f"""
Analyze the supplied image for SOFTWARE DEMONSTRATION only.
Target response language: {language}

The image may show: normal-appearing skin, common non-pathologic appearance such as dryness/oiliness,
or a dermatologic condition. Do NOT force every normal image into one of the 14 local classes.

Local 14-class taxonomy: {allowed}

Rules:
- If skin appears normal or non-pathologically dry/oily without a specific disease, use scope=normal_appearing and a canonical_label such as normal_appearing_skin or dryness_features.
- If a dermatologic condition is visible but is NOT in the local 14 classes, use scope=other_dermatologic and provide the most defensible dermatologic condition name.
- If evidence is insufficient, use scope=uncertain and canonical_label=uncertain_dermatologic_finding.
- Never invent a non-dermatologic disease merely to fill the field.
- For the local 14 classes, scope=local_14 and canonical_label must be one of the local labels except OTHER.
- display_label, reason, message, rationale, comments and next_action must be written in the target language; canonical_label remains a stable English/internal identifier.
- Do not call an appearance 'moisturized' as a disease; describe visible appearance instead.
- Image quality must be assessed first.
- Confidence is an UNCALIBRATED demo estimate, not a clinical probability.
- Never set diagnosis_confirmed=true.
- Recommend professional evaluation when appropriate.
User context: {user_context}
"""
        out = self._generate(prompt, SKIN_SCHEMA, image_path)
        out["provenance"] = self._provenance(confidence_calibrated=False, response_language=language)
        return out

    def triage(self, symptoms: str, duration: str = "", age: str = "", history: str = "") -> dict[str, Any]:
        prompt = f"""
Perform conservative symptom triage, not diagnosis.
Symptoms: {symptoms}
Duration: {duration}
Age: {age}
Relevant history: {history}
Identify explicit red flags, ask only useful follow-up questions, and state the safest next action.
Do not claim a disease diagnosis from insufficient information.
"""
        out = self._generate(prompt, TRIAGE_SCHEMA)
        out["provenance"] = self._provenance()
        return out

    def medicine_safety(self, medicine_text: str, patient_context: str = "", language: str = "en") -> dict[str, Any]:
        prompt = f"""
Review the following medicine names/text for demonstration-level identification, general safety triage, and adherence extraction.
Medicine text: {medicine_text}
Patient context: {patient_context}
Response language: {language}

Identify medicine names when reasonably possible. List safety flags and interaction concerns that require verification.
If an explicit clinician/prescription instruction is present, extract it faithfully into an adherence schedule.
Never invent a dose, frequency, duration, clock time, or food relationship that was not provided. If timing is missing, say it is not provided.
Do not prescribe.
verification_required must be true for every medicine item.
Return explanatory safety text in the target language; keep normalized_name in English when possible.
"""
        out = self._generate(prompt, MEDICINE_SCHEMA)
        out["provenance"] = self._provenance(requires_local_verification=True, authoritative_db_checked=False, response_language=language)
        return out

    def ayurveda(self, query: str, language: str = "en") -> dict[str, Any]:
        prompt = f"""
Answer the following Ayurveda query at a traditional/educational wellness level.
Query: {query}
Target response language: {language}

Identify intent and entities, summarize traditional concepts conservatively, and include traditional information, lifestyle guidance, dietary/wellness guidance, a simple routine/timeline when appropriate, and safety notes.
Make the response detailed enough for a product demonstration while clearly separating traditional claims from clinical evidence.
Do not present Ayurveda as proven treatment for disease.
Do not provide individualized prescription, dosage, or medication timing.
Separate traditional concepts from established clinical evidence.
clinical_claim must remain false.
"""
        out = self._generate(prompt, AYURVEDA_SCHEMA)
        out["provenance"] = self._provenance(knowledge_base_verified=False, response_language=language)
        return out


def main() -> None:
    parser = argparse.ArgumentParser(description="DermaSathiAI Gemini demo gateway")
    parser.add_argument("mode", choices=["skin", "triage", "medicine", "ayurveda"])
    parser.add_argument("value", help="Image path for skin; text for other modes")
    parser.add_argument("--language", default="en")
    args = parser.parse_args()

    gateway = GeminiDemoGateway()
    if args.mode == "skin":
        result = gateway.analyze_skin(args.value, language=args.language)
    elif args.mode == "triage":
        result = gateway.triage(args.value)
    elif args.mode == "medicine":
        result = gateway.medicine_safety(args.value, language=args.language)
    else:
        result = gateway.ayurveda(args.value, language=args.language)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
