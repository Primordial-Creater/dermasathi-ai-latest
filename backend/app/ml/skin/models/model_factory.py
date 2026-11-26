"""
DermaSathiAI — Model Factory
===============================
Factory pattern for instantiating skin disease classification models.
Models are loaded dynamically from configuration.
"""

from __future__ import annotations

import logging
from typing import Any

from app.ml.skin.models.base_model import BaseSkinModel

logger = logging.getLogger(__name__)

# Registry of available models
_MODEL_REGISTRY: dict[str, type[BaseSkinModel]] = {}


def _ensure_registry():
    """Lazy-load model classes into registry."""
    global _MODEL_REGISTRY
    if _MODEL_REGISTRY:
        return

    from app.ml.skin.models.inception_v3 import InceptionV3Model
    from app.ml.skin.models.resnet50 import ResNet50Model
    from app.ml.skin.models.densenet201 import DenseNet201Model

    _MODEL_REGISTRY = {
        "inception_v3": InceptionV3Model,
        "resnet50": ResNet50Model,
        "densenet201": DenseNet201Model,
    }


def create_model(model_name: str, config: dict[str, Any]) -> BaseSkinModel:
    """
    Create a model instance by name.

    Parameters
    ----------
    model_name : str
        Model identifier (inception_v3, resnet50, densenet201).
    config : dict
        Full model configuration.

    Returns
    -------
    BaseSkinModel
        Instantiated (but not yet built) model.

    Raises
    ------
    ValueError
        If model_name is not registered.
    """
    _ensure_registry()

    model_name = model_name.lower().strip()
    if model_name not in _MODEL_REGISTRY:
        available = ", ".join(sorted(_MODEL_REGISTRY.keys()))
        raise ValueError(
            f"Unknown model '{model_name}'. Available: {available}"
        )

    model_class = _MODEL_REGISTRY[model_name]
    logger.info("Creating model: %s (%s)", model_name, model_class.__name__)
    return model_class(config)


def list_available_models() -> list[str]:
    """Return list of available model names."""
    _ensure_registry()
    return sorted(_MODEL_REGISTRY.keys())


def register_model(name: str, model_class: type[BaseSkinModel]) -> None:
    """
    Register a custom model class.

    Allows extending the system with new architectures
    without modifying factory code.
    """
    _ensure_registry()
    _MODEL_REGISTRY[name.lower().strip()] = model_class
    logger.info("Registered custom model: %s", name)
