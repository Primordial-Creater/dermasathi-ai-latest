"""
DermaSathiAI — Model Registry
================================
Simple artifact-based model registry for managing trained models.

Stores and retrieves:
- Model weights/checkpoints
- Class mappings
- Model configs
- Training history
- Evaluation metrics
- Calibration parameters
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ModelRegistry:
    """
    Manage trained model artifacts on the filesystem.

    Directory structure:
        trained_models/
            <model_name>/
                <version>/
                    model.keras
                    class_mapping.json
                    model_config.json
                    training_history.json
                    evaluation_metrics.json
                    calibration_params.json
                    registry_meta.json
    """

    def __init__(self, registry_dir: Path):
        self.registry_dir = Path(registry_dir)
        self.registry_dir.mkdir(parents=True, exist_ok=True)

    def register_model(
        self,
        model_name: str,
        version: Optional[str] = None,
        source_dir: Optional[Path] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Path:
        """
        Register a trained model in the registry.

        Parameters
        ----------
        model_name : str
            Name of the model (e.g., 'inception_v3').
        version : str, optional
            Version string. Auto-generated if not provided.
        source_dir : Path, optional
            Directory containing model artifacts to copy.
        metadata : dict, optional
            Additional metadata to store.

        Returns
        -------
        Path
            Path to the registered model directory.
        """
        if version is None:
            version = datetime.now().strftime("v%Y%m%d_%H%M%S")

        model_dir = self.registry_dir / model_name / version
        model_dir.mkdir(parents=True, exist_ok=True)

        # Copy artifacts from source if provided
        if source_dir is not None and source_dir.exists():
            import shutil
            for item in source_dir.iterdir():
                if item.is_file():
                    shutil.copy2(item, model_dir / item.name)

        # Save registry metadata
        meta = {
            "model_name": model_name,
            "version": version,
            "registered_at": datetime.now().isoformat(),
            "source_dir": str(source_dir) if source_dir else None,
        }
        if metadata:
            meta.update(metadata)

        with open(model_dir / "registry_meta.json", "w") as f:
            json.dump(meta, f, indent=2)

        logger.info("Model registered: %s/%s at %s", model_name, version, model_dir)
        return model_dir

    def get_latest_model_dir(self, model_name: str) -> Optional[Path]:
        """Get the latest version directory for a model."""
        model_root = self.registry_dir / model_name
        if not model_root.exists():
            return None

        versions = sorted(
            [d for d in model_root.iterdir() if d.is_dir()],
            key=lambda d: d.name,
            reverse=True,
        )
        return versions[0] if versions else None

    def get_model_dir(self, model_name: str, version: str) -> Optional[Path]:
        """Get a specific version directory."""
        model_dir = self.registry_dir / model_name / version
        return model_dir if model_dir.exists() else None

    def list_models(self) -> dict[str, list[str]]:
        """List all registered models and their versions."""
        result = {}
        if not self.registry_dir.exists():
            return result

        for model_dir in sorted(self.registry_dir.iterdir()):
            if model_dir.is_dir():
                versions = sorted(
                    [d.name for d in model_dir.iterdir() if d.is_dir()]
                )
                if versions:
                    result[model_dir.name] = versions

        return result

    def get_model_metadata(
        self,
        model_name: str,
        version: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        """Load metadata for a registered model."""
        if version:
            model_dir = self.get_model_dir(model_name, version)
        else:
            model_dir = self.get_latest_model_dir(model_name)

        if model_dir is None:
            return None

        meta_path = model_dir / "registry_meta.json"
        if not meta_path.exists():
            return None

        with open(meta_path) as f:
            return json.load(f)
