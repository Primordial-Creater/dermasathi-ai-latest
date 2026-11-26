"""
DermaSathiAI — Confidence Calibration
=======================================
Post-hoc calibration and uncertainty estimation.

CRITICAL: Raw softmax probabilities are NOT clinical confidence.
This module provides:
- Temperature scaling (learned post-hoc calibration)
- Predictive entropy for uncertainty
- Configurable abstention threshold

The system explicitly separates:
- raw_probability (softmax output)
- calibrated_confidence (temperature-scaled)
- uncertainty (predictive entropy)
- decision_status (pass/abstain)
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

import numpy as np

logger = logging.getLogger(__name__)


class TemperatureCalibrator:
    """
    Temperature scaling for post-hoc probability calibration.

    Temperature > 1 softens the distribution (reduces overconfidence).
    Temperature < 1 sharpens it.
    """

    def __init__(self, config: Optional[dict[str, Any]] = None):
        cfg = config or {}
        cal_cfg = cfg.get("calibration", {})
        inf_cfg = cfg.get("inference", {})

        self.temperature: float = cal_cfg.get("initial_temperature", 1.5)
        self.confidence_threshold: float = inf_cfg.get("confidence_threshold", 0.60)
        self.abstention_threshold: float = inf_cfg.get("abstention_threshold", 0.40)
        self.method: str = cal_cfg.get("method", "temperature_scaling")

    def calibrate(self, logits_or_proba: np.ndarray) -> np.ndarray:
        """
        Apply temperature scaling to model outputs.

        Parameters
        ----------
        logits_or_proba : np.ndarray
            Raw model output (softmax probabilities or logits).

        Returns
        -------
        np.ndarray
            Calibrated probability distribution.
        """
        # If input looks like probabilities (sums to ~1), convert to logits first
        if np.allclose(logits_or_proba.sum(axis=-1), 1.0, atol=0.01):
            # Clip to avoid log(0)
            clipped = np.clip(logits_or_proba, 1e-10, 1.0)
            logits = np.log(clipped)
        else:
            logits = logits_or_proba

        # Apply temperature
        scaled = logits / self.temperature

        # Softmax
        exp_scaled = np.exp(scaled - np.max(scaled, axis=-1, keepdims=True))
        calibrated = exp_scaled / exp_scaled.sum(axis=-1, keepdims=True)

        return calibrated

    def compute_uncertainty(self, calibrated_proba: np.ndarray) -> float:
        """
        Compute predictive entropy as uncertainty measure.

        Higher entropy = more uncertain.

        Parameters
        ----------
        calibrated_proba : np.ndarray
            Calibrated probability distribution (1D).

        Returns
        -------
        float
            Predictive entropy (0 = certain, log(n_classes) = maximally uncertain).
        """
        proba = np.clip(calibrated_proba, 1e-10, 1.0)
        entropy = -np.sum(proba * np.log(proba))
        # Normalize to [0, 1]
        max_entropy = np.log(len(proba))
        if max_entropy > 0:
            entropy = entropy / max_entropy
        return float(entropy)

    def should_abstain(
        self,
        calibrated_proba: np.ndarray,
        uncertainty: float,
    ) -> tuple[bool, str]:
        """
        Determine whether the model should abstain from prediction.

        Returns
        -------
        tuple[bool, str]
            (should_abstain, reason)
        """
        max_confidence = float(np.max(calibrated_proba))

        if max_confidence < self.abstention_threshold:
            return True, "insufficient_model_confidence"

        if uncertainty > 0.8:
            return True, "high_uncertainty"

        if max_confidence < self.confidence_threshold:
            return True, "below_confidence_threshold"

        return False, ""

    def fit_temperature(
        self,
        model,
        validation_dataset,
        n_iterations: int = 50,
    ) -> float:
        """
        Learn optimal temperature on validation set using NLL minimization.

        Parameters
        ----------
        model : BaseSkinModel
            Trained model.
        validation_dataset : tf.data.Dataset
            Validation dataset.
        n_iterations : int
            Grid search iterations.

        Returns
        -------
        float
            Optimal temperature.
        """
        # Collect validation predictions
        all_proba = []
        all_labels = []

        for batch_x, batch_y in validation_dataset:
            preds = model.predict(
                batch_x.numpy() if hasattr(batch_x, 'numpy') else batch_x
            )
            all_proba.extend(preds)
            all_labels.extend(
                np.argmax(
                    batch_y.numpy() if hasattr(batch_y, 'numpy') else batch_y,
                    axis=1,
                )
            )

        all_proba = np.array(all_proba)
        all_labels = np.array(all_labels)

        # Convert to logits
        logits = np.log(np.clip(all_proba, 1e-10, 1.0))

        # Grid search for optimal temperature
        best_temp = 1.0
        best_nll = float("inf")

        for temp in np.linspace(0.1, 5.0, n_iterations):
            scaled = logits / temp
            exp_scaled = np.exp(scaled - np.max(scaled, axis=-1, keepdims=True))
            calibrated = exp_scaled / exp_scaled.sum(axis=-1, keepdims=True)

            # Negative log-likelihood
            nll = -np.mean(
                np.log(np.clip(calibrated[np.arange(len(all_labels)), all_labels], 1e-10, 1.0))
            )

            if nll < best_nll:
                best_nll = nll
                best_temp = temp

        self.temperature = float(best_temp)
        logger.info(
            "Optimal temperature: %.3f (NLL: %.4f)", self.temperature, best_nll
        )
        return self.temperature

    def save(self, save_dir: Path) -> None:
        """Save calibration parameters."""
        save_dir.mkdir(parents=True, exist_ok=True)
        params = {
            "method": self.method,
            "temperature": self.temperature,
            "confidence_threshold": self.confidence_threshold,
            "abstention_threshold": self.abstention_threshold,
        }
        with open(save_dir / "calibration_params.json", "w") as f:
            json.dump(params, f, indent=2)

    def load(self, save_dir: Path) -> None:
        """Load calibration parameters."""
        params_path = save_dir / "calibration_params.json"
        if params_path.exists():
            with open(params_path) as f:
                params = json.load(f)
            self.temperature = params.get("temperature", self.temperature)
            self.confidence_threshold = params.get(
                "confidence_threshold", self.confidence_threshold
            )
            self.abstention_threshold = params.get(
                "abstention_threshold", self.abstention_threshold
            )
            logger.info("Calibration loaded: T=%.3f", self.temperature)
