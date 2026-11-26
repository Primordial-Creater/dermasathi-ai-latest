"""
DermaSathiAI demo orchestrator

Purpose:
- Run the local disease pipeline and Gemini on the same skin image.
- Keep provider/model details in internal metadata only.
- Select a demo result from the available candidates using a transparent
  comparison score (raw confidence estimates are NOT clinically calibrated).
- Use Gemini for post-disease medicine-information and Ayurveda/wellness
  generation in the current demo phase.
- Retry transient Gemini failures with exponential backoff and model fallback.
- Return a frontend-safe `user_result` object plus private `_meta` telemetry.

This is a demonstration/integration layer, not a clinical decision system.
"""
from __future__ import annotations

import concurrent.futures
import json
import mimetypes
import os
import random
import tempfile
import time
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Any

warnings.filterwarnings(
    "ignore",
    message=r"Direct use of automatic function calling.*"
)

import numpy as np

try:
    from PIL import Image, ImageFilter, ImageStat
except Exception:  # pragma: no cover
    Image = None

try:
    from google import genai
    from google.genai import types
except Exception:  # pragma: no cover
    genai = None
    types = None


PROJECT_ROOT = Path(__file__).resolve().parents[3]
LOCAL_V1_MODEL = PROJECT_ROOT / "backend/models/skin_ai/v1_disease/model.keras"
LOCAL_V1_MAPPING = PROJECT_ROOT / "backend/models/skin_ai/v1_disease/class_mapping.json"
LOCAL_V2_MODEL = PROJECT_ROOT / "backend/models/skin_ai/v2_open_set/model.keras"
LOCAL_V2_MAPPING = PROJECT_ROOT / "backend/models/skin_ai/v2_open_set/class_mapping.json"

SUPPORTED_DISEASES = {
    "AK", "BCC", "BKL", "Chickenpox", "Cowpox", "Dermatofibroma",
    "HFMD", "Healthy", "Measles", "Nevi", "Melanoma", "Monkeypox",
    "SCC", "Vascular",
}
HIGH_RISK = {"BCC", "Melanoma", "SCC"}
SKIN_SCOPES = {"local_14", "other_dermatologic", "normal_appearing", "uncertain"}

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
MODEL_FALLBACKS = [
    x.strip() for x in os.getenv(
        "GEMINI_MODEL_FALLBACKS",
        "gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.5-flash",
    ).split(",")
    if x.strip()
]
RETRY_ROUNDS = max(1, int(os.getenv("GEMINI_RETRY_ROUNDS", "3")))
BACKOFF_BASE = float(os.getenv("GEMINI_BACKOFF_BASE", "1.25"))
BACKOFF_MAX = float(os.getenv("GEMINI_BACKOFF_MAX", "8"))
JITTER = float(os.getenv("GEMINI_BACKOFF_JITTER", "0.35"))
GEMINI_MAX_TOTAL_SECONDS = float(os.getenv("GEMINI_MAX_TOTAL_SECONDS", "180"))
GEMINI_INDEFINITE_RETRY = os.getenv("GEMINI_INDEFINITE_RETRY", "0") == "1"


# ---------- Gemini JSON schema ----------

def obj(properties: dict[str, Any], required: list[str]) -> dict[str, Any]:
    return {"type": "object", "properties": properties, "required": required}


def arr(item: dict[str, Any]) -> dict[str, Any]:
    return {"type": "array", "items": item}


def string() -> dict[str, Any]:
    return {"type": "string"}


def boolean() -> dict[str, Any]:
    return {"type": "boolean"}


def number() -> dict[str, Any]:
    return {"type": "number", "minimum": 0, "maximum": 1}


def enum(values: list[str]) -> dict[str, Any]:
    return {"type": "string", "enum": values}


CANDIDATE = obj(
    {
        "label": string(),
        "confidence_estimate": number(),
        "rationale": string(),
    },
    ["label", "confidence_estimate", "rationale"],
)
PREDICTION = obj(
    {
        "label": string(),
        "confidence_estimate": number(),
        "rationale": string(),
        "scope": enum(["local_14", "other_dermatologic", "normal_appearing", "uncertain"]),
        "display_label": string(),
    },
    ["label", "confidence_estimate", "rationale", "scope", "display_label"],
)
QUALITY = obj(
    {
        "acceptable": boolean(),
        "lighting": enum(["good", "acceptable", "poor", "unknown"]),
        "blur": enum(["none", "mild", "severe", "unknown"]),
        "framing": enum(["good", "acceptable", "poor", "unknown"]),
        "resolution": enum(["good", "acceptable", "poor", "unknown"]),
        "comments": arr(string()),
    },
    ["acceptable", "lighting", "blur", "framing", "resolution", "comments"],
)
APPEARANCE = obj(
    {
        "classification": enum([
            "normal_appearing", "dryness_features", "oily_features",
            "irritation_features", "pigmentation_features", "lesion_present", "uncertain"
        ]),
        "notes": string(),
    },
    ["classification", "notes"],
)

SKIN_SCHEMA = obj(
    {
        "status": enum(["supported", "needs_better_image", "abstain", "error"]),
        "reason": string(),
        "message": string(),
        "image_quality": QUALITY,
        "appearance_assessment": APPEARANCE,
        "prediction": PREDICTION,
        "alternatives": arr(CANDIDATE),
        "risk_level": enum(["low", "moderate", "high", "unknown"]),
        "referral_required": boolean(),
        "diagnosis_confirmed": boolean(),
        "professional_evaluation_required": boolean(),
        "next_action": arr(string()),
        "disclaimer": string(),
    },
    [
        "status", "reason", "message", "image_quality", "appearance_assessment",
        "prediction", "alternatives", "risk_level", "referral_required", "diagnosis_confirmed",
        "professional_evaluation_required", "next_action", "disclaimer",
    ],
)

CARE_ITEM = obj({
    "name": string(), "category": string(), "purpose": string(),
    "safety_notes": arr(string()), "verification_required": boolean(),
}, ["name", "category", "purpose", "safety_notes", "verification_required"])
ADHERENCE_ITEM = obj({
    "medicine_name": string(), "instruction": string(), "timing_relative_to_food": string(),
    "duration": string(), "schedule_source": string(), "reminder_suggestion": string(), "notes": string(),
}, ["medicine_name", "instruction", "timing_relative_to_food", "duration", "schedule_source", "reminder_suggestion", "notes"])
LIFESTYLE_ITEM = obj({
    "area": string(), "recommendation": string(), "frequency": string(), "general_timeline": string(),
}, ["area", "recommendation", "frequency", "general_timeline"])
DIET_ITEM = obj({
    "recommendation": string(), "purpose": string(), "cautions": string(),
}, ["recommendation", "purpose", "cautions"])
AYUR_ITEM = obj({
    "name": string(), "traditional_context": string(), "wellness_use": string(), "safety_notes": arr(string()),
}, ["name", "traditional_context", "wellness_use", "safety_notes"])
AYUR_ROUTINE_ITEM = obj({
    "step": string(), "timing": string(), "purpose": string(), "safety_boundary": string(),
}, ["step", "timing", "purpose", "safety_boundary"])
CARE_SCHEMA = obj({
    "condition": string(), "medicine_information": arr(CARE_ITEM), "prescription_adherence": arr(ADHERENCE_ITEM),
    "medicine_disclaimer": string(), "lifestyle_plan": arr(LIFESTYLE_ITEM), "dietary_guidance": arr(DIET_ITEM),
    "monitoring_timeline": arr(string()), "ayurveda_information": arr(AYUR_ITEM), "ayurveda_routine": arr(AYUR_ROUTINE_ITEM),
    "ayurveda_safety_notes": arr(string()), "ayurveda_evidence_level": enum(["traditional_educational", "uncertain"]),
    "care_disclaimer": string(),
}, [
    "condition", "medicine_information", "prescription_adherence", "medicine_disclaimer", "lifestyle_plan",
    "dietary_guidance", "monitoring_timeline", "ayurveda_information", "ayurveda_routine",
    "ayurveda_safety_notes", "ayurveda_evidence_level", "care_disclaimer",
])


@dataclass
class LocalPrediction:
    available: bool
    status: str
    label: str
    confidence: float
    alternatives: list[dict[str, Any]]
    risk_level: str
    referral_required: bool
    message: str
    reason: str
    error: str | None = None


class LocalDiseaseAdapter:
    """Lazy TensorFlow/Keras adapter for the existing V2 gate + V1 classifier."""

    def __init__(self) -> None:
        self.v1 = None
        self.v2 = None
        self.v1_map: dict[str, str] = {}
        self.v2_map: dict[str, str] = {}
        self.load_error: str | None = None
        self._loaded = False

    @staticmethod
    def _load_mapping(path: Path) -> dict[str, str]:
        raw = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            raise ValueError(f"Invalid mapping: {path}")
        # Accept either {"0":"AK"} or {"AK":0}.
        out: dict[str, str] = {}
        for k, v in raw.items():
            if str(k).isdigit():
                out[str(k)] = str(v)
            elif str(v).isdigit():
                out[str(v)] = str(k)
        if not out:
            raise ValueError(f"No numeric class mapping found in {path}")
        return out

    def _load(self) -> None:
        if self._loaded:
            return
        self._loaded = True
        try:
            import tensorflow as tf
            if LOCAL_V1_MODEL.is_file() and LOCAL_V1_MAPPING.is_file():
                self.v1 = tf.keras.models.load_model(LOCAL_V1_MODEL, compile=False)
                self.v1_map = self._load_mapping(LOCAL_V1_MAPPING)
            if LOCAL_V2_MODEL.is_file() and LOCAL_V2_MAPPING.is_file():
                self.v2 = tf.keras.models.load_model(LOCAL_V2_MODEL, compile=False)
                self.v2_map = self._load_mapping(LOCAL_V2_MAPPING)
            if self.v1 is None:
                raise FileNotFoundError(f"Local V1 model not found: {LOCAL_V1_MODEL}")
        except Exception as exc:
            self.load_error = repr(exc)

    @staticmethod
    def _preprocess(path: str | Path) -> np.ndarray:
        if Image is None:
            raise RuntimeError("Pillow is not installed")
        image = Image.open(path).convert("RGB").resize((224, 224))
        x = np.asarray(image, dtype=np.float32)
        try:
            from tensorflow.keras.applications.resnet50 import preprocess_input
            x = preprocess_input(x)
        except Exception:
            x = x / 255.0
        return np.expand_dims(x, 0)

    @staticmethod
    def _softmax_if_needed(values: np.ndarray) -> np.ndarray:
        values = np.asarray(values, dtype=np.float64).reshape(-1)
        if np.all(values >= 0) and np.isclose(float(values.sum()), 1.0, atol=1e-2):
            return values
        ex = np.exp(values - np.max(values))
        return ex / ex.sum()

    def predict(self, image_path: str | Path) -> LocalPrediction:
        self._load()
        if self.load_error:
            return LocalPrediction(
                False, "unavailable", "OTHER", 0.0, [], "unknown", True,
                "Local disease model is unavailable for this request.",
                "local_model_load_failed", self.load_error,
            )

        try:
            x = self._preprocess(image_path)

            # V2 open-set gate. If present, use it to reject obvious OOD inputs.
            if self.v2 is not None:
                p2 = self._softmax_if_needed(self.v2.predict(x, verbose=0))
                i2 = int(np.argmax(p2))
                label2 = self.v2_map.get(str(i2), "OTHER")
                conf2 = float(p2[i2])
                if label2.upper() == "OTHER" or conf2 < 0.30:
                    return LocalPrediction(
                        True, "abstain", "OTHER", conf2, [], "unknown", True,
                        "The local supported-domain gate did not accept this image.",
                        "local_open_set_rejection",
                    )

            p = self._softmax_if_needed(self.v1.predict(x, verbose=0))
            order = np.argsort(p)[::-1]
            best = int(order[0])
            label = self.v1_map.get(str(best), "OTHER")
            conf = float(p[best])
            alts = []
            for idx in order[1:3]:
                l = self.v1_map.get(str(int(idx)), "OTHER")
                alts.append({"label": l, "confidence_estimate": float(p[int(idx)]), "rationale": "Local classifier alternative."})
            high = label in HIGH_RISK
            return LocalPrediction(
                True,
                "supported" if label in SUPPORTED_DISEASES else "abstain",
                label if label in SUPPORTED_DISEASES else "OTHER",
                conf,
                alts,
                "high" if high else "moderate" if conf >= 0.60 else "unknown",
                high or conf < 0.50,
                f"Local disease classifier candidate: {label}.",
                "local_v1_classifier",
            )
        except Exception as exc:
            return LocalPrediction(
                False, "error", "OTHER", 0.0, [], "unknown", True,
                "The local disease model could not process this image.",
                "local_inference_error", repr(exc),
            )


class GeminiRetryClient:
    def __init__(self, api_key: str | None = None, model: str | None = None):
        if genai is None:
            raise RuntimeError("google-genai is not installed")
        key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not key:
            from app.core.config import settings
            key = settings.GEMINI_API_KEY
        if not key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        self.client = genai.Client(api_key=key)
        requested = model or DEFAULT_MODEL
        self.models = []
        for name in [requested, *MODEL_FALLBACKS]:
            if name and name not in self.models:
                self.models.append(name)
        self.last_model = self.models[0]

    @staticmethod
    def _image_part(path: str | Path):
        p = Path(path)
        if not p.is_file():
            raise FileNotFoundError(f"Image not found: {p}")
        mime = mimetypes.guess_type(p.name)[0] or "image/jpeg"
        return types.Part.from_bytes(data=p.read_bytes(), mime_type=mime)

    @staticmethod
    def _transient(exc: Exception) -> bool:
        status = getattr(exc, "status_code", None)
        text = str(exc).upper()
        return status in {429, 500, 502, 503, 504} or any(
            token in text for token in ("429", "500", "502", "503", "504", "UNAVAILABLE", "RESOURCE_EXHAUSTED", "TIMEOUT")
        )

    def generate(self, prompt: str, schema: dict[str, Any], image_path: str | Path | None = None) -> tuple[dict[str, Any], dict[str, Any]]:
        contents: list[Any] = [prompt]
        if image_path is not None:
            contents.insert(0, self._image_part(image_path))

        last: Exception | None = None
        total_attempts = 0
        started = time.perf_counter()
        round_idx = 0

        while True:
            round_idx += 1
            for model in self.models:
                if (not GEMINI_INDEFINITE_RETRY) and (time.perf_counter() - started >= GEMINI_MAX_TOTAL_SECONDS):
                    raise TimeoutError(
                        f"Gemini retry budget exceeded ({GEMINI_MAX_TOTAL_SECONDS:.1f}s)"
                    )
                total_attempts += 1
                try:
                    response = self.client.models.generate_content(
                        model=model,
                        contents=contents,
                        config=types.GenerateContentConfig(
                            system_instruction=(
                                "You are an external AI assistance component inside DermaSathiAI. "
                                "Return only JSON matching the schema. Do not claim diagnostic certainty. "
                                "Do not prescribe or produce patient-specific dosage plans. "
                                "Prefer uncertainty or referral when the evidence is inadequate."
                            ),
                            response_mime_type="application/json",
                            response_schema=schema,
                        ),
                    )
                    if not response.text:
                        raise RuntimeError("Gemini returned an empty response")
                    data = json.loads(response.text)
                    if not isinstance(data, dict):
                        raise RuntimeError("Gemini returned non-object JSON")
                    self.last_model = model
                    meta = {
                        "provider": "google_gemini",
                        "model": model,
                        "attempts": total_attempts,
                        "retry_round": round_idx,
                        "latency_ms": round((time.perf_counter() - started) * 1000, 1),
                        "indefinite_retry": GEMINI_INDEFINITE_RETRY,
                    }
                    return data, meta
                except Exception as exc:
                    last = exc
                    if not self._transient(exc):
                        raise
                    delay = min(BACKOFF_MAX, BACKOFF_BASE * (2 ** min(round_idx - 1, 5)))
                    delay += random.uniform(0, JITTER)
                    if not GEMINI_INDEFINITE_RETRY:
                        remaining = GEMINI_MAX_TOTAL_SECONDS - (time.perf_counter() - started)
                        if remaining <= 0:
                            raise TimeoutError(
                                f"Gemini retry budget exceeded ({GEMINI_MAX_TOTAL_SECONDS:.1f}s)"
                            ) from last
                        delay = min(delay, remaining)
                    time.sleep(max(0.1, delay))


    def safe_generate(
        self, prompt: str, schema: dict[str, Any], image_path: str | Path | None = None
    ) -> tuple[dict[str, Any] | None, dict[str, Any], str | None]:
        try:
            data, meta = self.generate(prompt, schema, image_path)
            return data, meta, None
        except Exception as exc:
            return None, {
                "provider": "google_gemini",
                "available": False,
                "attempts": 0,
                "error_type": type(exc).__name__,
            }, repr(exc)


class DemoOrchestrator:
    def __init__(self) -> None:
        self.local = LocalDiseaseAdapter()
        self.gemini = GeminiRetryClient()

    @staticmethod
    def _normalize_local_label(label: str) -> str:
        clean = (label or "OTHER").strip()
        lower = clean.lower()
        for known in SUPPORTED_DISEASES:
            if lower == known.lower():
                return known
        return "OTHER"

    @staticmethod
    def _frontend_skin(result: dict[str, Any]) -> dict[str, Any]:
        # Remove internal provenance/provider/model from the user-facing payload.
        return {k: v for k, v in result.items() if k != "provenance" and not k.startswith("_")}

    def analyze_skin(self, image_path: str | Path, user_context: str = "", language: str = "en") -> dict[str, Any]:
        path = Path(image_path)
        if not path.is_file():
            raise FileNotFoundError(path)

        # Run local and Gemini concurrently. A Gemini outage must not suppress a usable local result.
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
            lf = ex.submit(self.local.predict, path)
            prompt = f"""
Analyze this image for SOFTWARE DEMONSTRATION ONLY.
Target response language: {language}

The image can show normal-appearing skin, a non-pathologic appearance such as dryness/oiliness,
a condition in the local 14-class taxonomy, or another dermatologic condition outside that taxonomy.
Local 14-class taxonomy: {', '.join(sorted(SUPPORTED_DISEASES))}.

Rules:
- Do NOT force a normal image into a disease class. For normal/non-pathologic appearance use scope=normal_appearing and label=normal_appearing_skin, dryness_features, or another descriptive non-disease label.
- If there is a plausible dermatologic condition not in the local 14 classes, use scope=other_dermatologic and name the condition conservatively.
- If the evidence is insufficient, use scope=uncertain and label=uncertain_dermatologic_finding.
- Never invent non-dermatologic diseases.
- For the local 14 classes, scope=local_14 and label must match one of the 14 class names.
- Set prediction.scope to one of local_14, other_dermatologic, normal_appearing, or uncertain.
- Set prediction.display_label in the target language, while prediction.label remains the stable English/internal canonical label.
- Put the user-facing rationale, reason, message, comments, and next_action in the target language.
- Do not treat 'moisturized skin' as a disease. Describe visible appearance instead.
- Assess image quality first.
- Confidence_estimate is UNCALIBRATED and is not a clinical probability.
- Never claim confirmed diagnosis.
User context: {user_context}
"""
            gf = ex.submit(self.gemini.safe_generate, prompt, SKIN_SCHEMA, path)
            local = lf.result()
            gemini_data, gmeta, gerror = gf.result()

        gp = (gemini_data or {}).get("prediction") or {}
        glabel = str(gp.get("label", "uncertain_dermatologic_finding") or "uncertain_dermatologic_finding").strip()
        gscope = str(gp.get("scope", "uncertain") or "uncertain")
        gconf = float(gp.get("confidence_estimate", 0.0) or 0.0)
        gstatus = str((gemini_data or {}).get("status", "abstain"))
        gquality = (gemini_data or {}).get("image_quality") or {}
        quality_ok = bool(gquality.get("acceptable", False)) if gemini_data is not None else False

        local_is_high_risk = local.available and local.status == "supported" and local.label in HIGH_RISK and local.confidence >= 0.60
        gemini_valid = (
            gemini_data is not None
            and gstatus == "supported"
            and quality_ok
            and gscope in {"local_14", "other_dermatologic", "normal_appearing"}
            and glabel not in {"OTHER", "uncertain_dermatologic_finding"}
        )

        selection_rule = "none"
        source = "none"
        selected: dict[str, Any] | None = None

        # Demo policy: Gemini is the primary disease/appearance provider.
        # Local V1/V2 remains active as a shadow model and strict fallback.
        # A strong local high-risk signal that disagrees with Gemini triggers review.
        if gemini_valid and local_is_high_risk and glabel != local.label:
            selection_rule = "high_risk_disagreement_review"
            source = "conflict"
            selected = {"result": gemini_data}
        elif gemini_valid:
            source = "gemini"
            selected = {"result": gemini_data}
            selection_rule = "gemini_primary"
        elif local.available and local.status == "supported" and local.label != "OTHER" and local.confidence >= 0.60:
            source = "local"
            selected = {"source": "local", "label": local.label, "score": local.confidence, "result": local}
            selection_rule = "local_strict_fallback"
        elif gemini_data is not None and gstatus == "supported":
            source = "gemini"
            selected = {"result": gemini_data}
            selection_rule = "gemini_only_supported_result"
        elif local.available:
            source = "local"
            selected = {"source": "local", "label": local.label, "score": local.confidence, "result": local}
            selection_rule = "local_last_resort"

        if selected is None:
            return {
                "status": "abstain",
                "reason": "Neither inference source produced a usable result.",
                "message": "The image could not be assessed reliably right now.",
                "prediction": {"label": "uncertain_dermatologic_finding", "display_label": "Uncertain", "scope": "uncertain", "confidence_estimate": 0.0, "rationale": "No usable inference source available."},
                "alternatives": [],
                "risk_level": "unknown",
                "referral_required": True,
                "diagnosis_confirmed": False,
                "professional_evaluation_required": True,
                "next_action": ["Retry later or seek professional evaluation."],
                "disclaimer": "AI screening demonstration only; not a confirmed medical diagnosis.",
                "_meta": {"selected_source": "none", "selection_rule": "no_available_model", "local": {"available": local.available, "error": local.error}, "gemini": {**gmeta, "error": gerror}},
            }

        if source == "local":
            lp: LocalPrediction = selected["result"]
            final = {
                "status": "supported",
                "reason": lp.reason,
                "message": lp.message,
                "image_quality": {
                    "acceptable": True,
                    "lighting": "unknown",
                    "blur": "unknown",
                    "framing": "unknown",
                    "resolution": "unknown",
                    "comments": ["Local quality gate did not report detailed image-quality fields."],
                },
                "prediction": {
                    "label": "normal_appearing_skin" if lp.label == "Healthy" else lp.label,
                    "display_label": ("Normal-looking skin" if lp.label == "Healthy" else lp.label),
                    "scope": "normal_appearing" if lp.label == "Healthy" else "local_14",
                    "confidence_estimate": lp.confidence,
                    "rationale": "Local trained disease classifier candidate.",
                },
                "appearance_assessment": {"classification": "normal_appearing" if lp.label == "Healthy" else "lesion_present", "notes": "Local model output."},
                "alternatives": lp.alternatives,
                "risk_level": lp.risk_level,
                "referral_required": lp.referral_required,
                "diagnosis_confirmed": False,
                "professional_evaluation_required": True,
                "next_action": [
                    "Use the result as a screening aid only.",
                    "Seek professional evaluation, especially for persistent, changing, or high-risk findings.",
                ],
                "disclaimer": "AI screening result for demonstration only; not a confirmed medical diagnosis.",
            }
            local_meta = {
                "available": local.available,
                "status": local.status,
                "label": local.label,
                "confidence": local.confidence,
                "error": local.error,
            }
        else:
            final = self._frontend_skin(gemini_data or {})
            gp_final = final.get("prediction", {})
            if "canonical_label" in gp_final and "label" not in gp_final:
                gp_final["label"] = gp_final.pop("canonical_label")
            local_meta = {
                "available": local.available,
                "status": local.status,
                "label": local.label,
                "confidence": local.confidence,
                "error": local.error,
            }

        if source == "conflict":
            # Preserve the high-risk local signal for safety while exposing the visual disagreement.
            final = self._frontend_skin(gemini_data or {})
            gp_final = final.get("prediction", {})
            if "canonical_label" in gp_final and "label" not in gp_final:
                gp_final["label"] = gp_final.pop("canonical_label")
            final["status"] = "needs_review"
            final["risk_level"] = "high"
            final["referral_required"] = True
            final["professional_evaluation_required"] = True
            final["message"] = (
                "The automated systems disagree about the image. A potentially high-risk local finding requires professional review."
            )
            final["next_action"] = [
                "Do not rely on the automated result alone.",
                "Seek professional dermatology evaluation, especially if the lesion is changing, bleeding, painful, or persistent.",
            ]

        condition = str(final.get("prediction", {}).get("label", "OTHER"))
        care = {
            "status": "not_run",
            "reason": "No care generation was needed for an unsupported/abstained result.",
        }
        care_meta: dict[str, Any] = {"available": False}
        scope = str(final.get("prediction", {}).get("scope", "uncertain"))
        if scope in {"local_14", "other_dermatologic"} and condition not in {"OTHER", "uncertain_dermatologic_finding"} and final.get("status") in {"supported", "needs_review"}:
            care, care_meta, care_error = self.generate_care(condition, user_context, language=language)
            if care_error:
                care = {
                    "status": "temporarily_unavailable",
                    "reason": "The disease result is available, but supplemental medicine/Ayurveda information could not be generated right now.",
                }
                care_meta["error"] = care_error
        final["care"] = care
        final["_meta"] = {
            "selected_source": source,
            "selection_rule": selection_rule,
            "response_language": language,
            "local": local_meta,
            "gemini": {
                **gmeta,
                "error": gerror,
                "prediction": {"label": glabel, "scope": gscope, "confidence": gconf},
            },
            "care_provider": care_meta,
        }
        return final

    def generate_care(self, condition: str, user_context: str = "", prescription_text: str = "", language: str = "en") -> tuple[dict[str, Any], dict[str, Any], str | None]:
        prompt=f"""
For the skin condition label '{condition}', provide demonstration-level supportive information only.
This is NOT a diagnosis or prescription.

Include:
1) detailed but general medicine information: what the class/medicine is commonly used for, safety flags, interaction concerns, and what requires pharmacist/clinician verification;
2) prescription adherence ONLY when explicit clinician/prescription instructions are present; extract medicine, instruction, timing relative to food, duration, and reminder suggestion faithfully;
3) lifestyle plan with practical daily/weekly actions;
4) dietary guidance with practical food/hydration considerations;
5) monitoring timeline with what to watch over the next few days/weeks without promising recovery;
6) Ayurveda traditional/educational information, diet/lifestyle context, and a simple routine when relevant;
7) explain clearly what is traditional versus clinically established.

Prescription text supplied by user/clinician:
{prescription_text}

User context:
{user_context}
Requested language:
{language}

Hard rules:
- Never invent dose, frequency, duration, clock time, or 'take after food' instructions.
- If an instruction is explicitly supplied, structure it faithfully and mark the source as user_or_clinician_provided_instruction.
- Medicine verification is always required.
- Ayurveda must be labeled traditional/educational; do not claim proven treatment.
- Timelines are monitoring/expectation guidance only and never guarantee recovery.
"""
        data,meta,error=self.gemini.safe_generate(prompt,CARE_SCHEMA)
        if data is None:
            return {},meta,error
        for item in data.get("medicine_information",[]):
            if isinstance(item,dict): item["verification_required"]=True
        for item in data.get("prescription_adherence",[]):
            if isinstance(item,dict): item["schedule_source"]="user_or_clinician_provided_instruction"
        data["condition"]=condition
        return data,meta,None

    def triage(self, symptoms: str, duration: str = "", age: str = "", history: str = "", language: str = "en") -> dict[str, Any]:
        TRIAGE_SCHEMA = obj(
            {
                "status": enum(["ok", "urgent", "needs_clinician", "insufficient_information"]),
                "urgency": enum(["low", "moderate", "high", "unknown"]),
                "red_flags": arr(string()),
                "likely_problem_area": string(),
                "follow_up_questions": arr(string()),
                "next_action": arr(string()),
                "disclaimer": string(),
            },
            ["status", "urgency", "red_flags", "likely_problem_area", "follow_up_questions", "next_action", "disclaimer"],
        )
        prompt = f"""
Perform conservative symptom triage, not diagnosis.
Symptoms: {symptoms}
Duration: {duration}
Age: {age}
History: {history}
Target response language: {language}
Identify explicit red flags, ask useful follow-up questions, and state the safest next action.
"""
        data, meta, error = self.gemini.safe_generate(prompt, TRIAGE_SCHEMA)
        if data is None:
            return {
                "status": "insufficient_information",
                "urgency": "unknown",
                "red_flags": [],
                "likely_problem_area": "unknown",
                "follow_up_questions": ["Retry the assessment when the AI service is available."],
                "next_action": ["Seek urgent professional care if severe or rapidly worsening symptoms are present."],
                "disclaimer": "AI triage demonstration only; not a medical diagnosis.",
                "_meta": {"selected_source": "none", "gemini": {**meta, "error": error}},
            }
        data["_meta"] = {"selected_source": "gemini", "gemini": {**meta, "error": error}}
        return data


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["skin", "triage"])
    parser.add_argument("value")
    parser.add_argument("--language", default="en")
    args = parser.parse_args()
    orch = DemoOrchestrator()
    if args.mode == "skin":
        result = orch.analyze_skin(args.value, language=args.language)
    else:
        result = orch.triage(args.value, language=args.language)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
