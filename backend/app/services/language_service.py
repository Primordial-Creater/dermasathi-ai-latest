"""Shared language registry for English and India's 22 Scheduled Languages."""

from __future__ import annotations

LANGUAGES: dict[str, str] = {
    "en": "English",
    "as": "Assamese",
    "bn": "Bengali",
    "brx": "Bodo",
    "doi": "Dogri",
    "gu": "Gujarati",
    "hi": "Hindi",
    "kn": "Kannada",
    "ks": "Kashmiri",
    "kok": "Konkani",
    "mai": "Maithili",
    "ml": "Malayalam",
    "mni": "Manipuri (Meitei)",
    "mr": "Marathi",
    "ne": "Nepali",
    "or": "Odia",
    "pa": "Punjabi",
    "sa": "Sanskrit",
    "sat": "Santali",
    "sd": "Sindhi",
    "ta": "Tamil",
    "te": "Telugu",
    "ur": "Urdu",
}

# Accept both BCP-47-like codes and the labels that may be sent by UI controls.
_ALIASES = {
    "english": "en",
    "assamese": "as",
    "bengali": "bn",
    "bodo": "brx",
    "dogri": "doi",
    "gujarati": "gu",
    "hindi": "hi",
    "kannada": "kn",
    "kashmiri": "ks",
    "konkani": "kok",
    "maithili": "mai",
    "malayalam": "ml",
    "manipuri": "mni",
    "meitei": "mni",
    "manipuri (meitei)": "mni",
    "marathi": "mr",
    "nepali": "ne",
    "odia": "or",
    "oriya": "or",
    "punjabi": "pa",
    "sanskrit": "sa",
    "santali": "sat",
    "santhali": "sat",
    "sindhi": "sd",
    "tamil": "ta",
    "telugu": "te",
    "urdu": "ur",
}


def resolve_language(value: str | None) -> tuple[str, str]:
    raw = (value or "en").strip().lower().replace("_", "-")
    code = raw.split("-")[0]
    code = _ALIASES.get(raw, _ALIASES.get(code, code))
    if code not in LANGUAGES:
        # Unknown settings should not silently be translated into a different language.
        raise ValueError(f"Unsupported language code: {value}")
    return code, LANGUAGES[code]
