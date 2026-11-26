"""
DermaSathiAI — Configuration Loader
====================================
Loads and merges YAML configuration files for ML models.
Model-specific configs override base config values.
"""

from __future__ import annotations

import copy
import os
from pathlib import Path
from typing import Any

import yaml


# Project root: walk up from this file to find the repo root
_THIS_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _THIS_DIR.parents[3]  # backend/app/ml/skin -> repo root
_CONFIG_DIR = _PROJECT_ROOT / "configs" / "skin_models"


def _deep_merge(base: dict, override: dict) -> dict:
    """Recursively merge override into base (override wins)."""
    merged = copy.deepcopy(base)
    for key, value in override.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = copy.deepcopy(value)
    return merged


def load_base_config() -> dict[str, Any]:
    """Load the base configuration."""
    base_path = _CONFIG_DIR / "base_config.yaml"
    if not base_path.exists():
        raise FileNotFoundError(f"Base config not found: {base_path}")
    with open(base_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_model_config(model_name: str) -> dict[str, Any]:
    """
    Load model-specific configuration merged over base config.

    Parameters
    ----------
    model_name : str
        One of: inception_v3, resnet50, densenet201

    Returns
    -------
    dict
        Merged configuration dictionary.
    """
    base = load_base_config()

    model_path = _CONFIG_DIR / f"{model_name}.yaml"
    if model_path.exists():
        with open(model_path, "r", encoding="utf-8") as f:
            model_override = yaml.safe_load(f) or {}
        return _deep_merge(base, model_override)

    # If no model-specific config, return base with model name set
    base.setdefault("model", {})["name"] = model_name
    return base


def get_config_dir() -> Path:
    """Return the configuration directory path."""
    return _CONFIG_DIR


def get_project_root() -> Path:
    """Return the project root directory."""
    return _PROJECT_ROOT


def resolve_path(config_path: str) -> Path:
    """Resolve a config-relative path to absolute path from project root."""
    p = Path(config_path)
    if p.is_absolute():
        return p
    return _PROJECT_ROOT / p
