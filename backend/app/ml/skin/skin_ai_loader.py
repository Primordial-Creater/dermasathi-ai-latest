"""
DermaSathiAI — Production Model Loader
========================================
Singleton loader for the two-stage skin AI system:
  - V2 (open-set): 15-class gating model including OTHER_UNSUPPORTED
  - V1 (disease):  14-class disease classifier

Design decisions:
- Models are loaded once at startup (lazy singleton, thread-safe via lock).
- No model registry lookups — paths come from env vars or settings.
- CPU fallback is automatic (TF picks the available device).
- Internal model paths are NEVER exposed in API responses.
"""

from __future__ import annotations

import json
import logging
import os
import threading
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ── Env-var / path resolution ─────────────────────────────────────────────────
_THIS_FILE = Path(__file__).resolve()
# backend/app/ml/skin/skin_ai_loader.py  →  repo root is 4 levels up
_REPO_ROOT = _THIS_FILE.parents[4]


def _resolve_model_root() -> Path:
    """
    Resolve the directory that contains v1_disease/ and v2_open_set/.

    Priority:
      1. SKIN_AI_MODEL_ROOT  environment variable (absolute or repo-relative)
      2. Default: <repo_root>/backend/models/skin_ai
    """
    env_val = os.environ.get("SKIN_AI_MODEL_ROOT", "").strip()
    if env_val:
        p = Path(env_val)
        if not p.is_absolute():
            p = _REPO_ROOT / p
        return p.resolve()
    return (_REPO_ROOT / "backend" / "models" / "skin_ai").resolve()


# ── Single-instance state ──────────────────────────────────────────────────────
_lock = threading.Lock()

_v1_model = None           # tf.keras.Model
_v2_model = None           # tf.keras.Model
_v1_index_to_class: dict[int, str] = {}
_v2_index_to_class: dict[int, str] = {}
_v2_other_index: Optional[int] = None    # index of OTHER_UNSUPPORTED in V2
_load_error: Optional[str] = None
_loaded: bool = False


# ── Public API ─────────────────────────────────────────────────────────────────

def load_models(force_reload: bool = False) -> None:
    """
    Load V1 and V2 models into module-level singletons.

    Thread-safe; models are loaded only once unless force_reload=True.

    Raises
    ------
    RuntimeError
        If the model files cannot be found or loaded.
    """
    global _v1_model, _v2_model, _v1_index_to_class, _v2_index_to_class
    global _v2_other_index, _load_error, _loaded

    with _lock:
        if _loaded and not force_reload:
            return

        model_root = _resolve_model_root()
        v1_dir = model_root / "v1_disease"
        v2_dir = model_root / "v2_open_set"

        logger.info("Loading skin AI models from model root (path not shown for security)")

        try:
            import tensorflow as tf  # noqa: PLC0415
        except ImportError as exc:
            _load_error = "TensorFlow is not installed in this environment."
            _loaded = False
            raise RuntimeError(_load_error) from exc

        # ── V2 open-set ───────────────────────────────────────────────────────
        v2_model_path = v2_dir / "model.keras"
        v2_mapping_path = v2_dir / "class_mapping.json"

        if not v2_model_path.exists():
            _load_error = "V2 open-set model file is missing."
            raise RuntimeError(_load_error)

        logger.info("Loading V2 open-set model …")
        _v2_model = tf.keras.models.load_model(str(v2_model_path), compile=False)
        logger.info("V2 model loaded OK (%d params)", _v2_model.count_params())

        # V2 mapping: {"ClassName": index, …}
        with open(v2_mapping_path, encoding="utf-8") as fh:
            v2_raw: dict[str, int] = json.load(fh)
        _v2_index_to_class = {v: k for k, v in v2_raw.items()}
        _v2_other_index = v2_raw.get("OTHER_UNSUPPORTED")
        logger.info(
            "V2 class mapping loaded: %d classes, OTHER_UNSUPPORTED index=%s",
            len(v2_raw),
            _v2_other_index,
        )

        # ── V1 disease classifier ─────────────────────────────────────────────
        v1_model_path = v1_dir / "model.keras"
        v1_mapping_path = v1_dir / "class_mapping.json"

        if not v1_model_path.exists():
            _load_error = "V1 disease model file is missing."
            raise RuntimeError(_load_error)

        logger.info("Loading V1 disease model …")
        _v1_model = tf.keras.models.load_model(str(v1_model_path), compile=False)
        logger.info("V1 model loaded OK (%d params)", _v1_model.count_params())

        # V1 mapping: {"index": "ClassName", …}  (integer keys stored as strings)
        with open(v1_mapping_path, encoding="utf-8") as fh:
            v1_raw: dict[str, str] = json.load(fh)
        _v1_index_to_class = {int(k): v for k, v in v1_raw.items()}
        logger.info("V1 class mapping loaded: %d classes", len(v1_raw))

        _load_error = None
        _loaded = True
        logger.info("Skin AI models fully loaded and ready.")


def is_ready() -> bool:
    """Return True if both models have been loaded successfully."""
    return _loaded and _v1_model is not None and _v2_model is not None


def get_models():
    """
    Return (v1_model, v2_model, v1_index_to_class, v2_index_to_class, v2_other_index).

    Raises RuntimeError if models have not been loaded.
    """
    if not is_ready():
        raise RuntimeError(
            "Skin AI models are not loaded. "
            "Call load_models() during application startup."
        )
    return (
        _v1_model,
        _v2_model,
        _v1_index_to_class,
        _v2_index_to_class,
        _v2_other_index,
    )


def get_load_error() -> Optional[str]:
    """Return the load error message, or None if models are ready."""
    return _load_error
