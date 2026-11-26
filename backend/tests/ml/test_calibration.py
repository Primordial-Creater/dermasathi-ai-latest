"""
Tests for Calibrator
========================
Tests temperature scaling and uncertainty without GPU.
"""

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2].parent))

from app.ml.skin.calibration.calibrator import TemperatureCalibrator


@pytest.fixture
def calibrator():
    """Default calibrator."""
    return TemperatureCalibrator({
        "calibration": {"initial_temperature": 1.5},
        "inference": {"confidence_threshold": 0.60, "abstention_threshold": 0.40},
    })


class TestTemperatureCalibrator:
    """Tests for temperature scaling calibration."""

    def test_calibrate_preserves_probability(self, calibrator):
        """Calibrated output should still sum to 1."""
        proba = np.array([0.7, 0.2, 0.05, 0.05])
        calibrated = calibrator.calibrate(proba.reshape(1, -1))[0]
        assert abs(calibrated.sum() - 1.0) < 1e-5

    def test_temperature_softens_distribution(self, calibrator):
        """Temperature > 1 should soften (flatten) the distribution."""
        proba = np.array([0.9, 0.05, 0.03, 0.02])
        calibrated = calibrator.calibrate(proba.reshape(1, -1))[0]
        # With T > 1, max probability should decrease
        assert calibrated.max() < proba.max()

    def test_uncertainty_computation(self, calibrator):
        """Uncertainty should be between 0 and 1."""
        proba = np.array([0.7, 0.2, 0.05, 0.05])
        uncertainty = calibrator.compute_uncertainty(proba)
        assert 0.0 <= uncertainty <= 1.0

    def test_uniform_distribution_max_uncertainty(self, calibrator):
        """Uniform distribution should have near-maximum uncertainty."""
        proba = np.array([0.25, 0.25, 0.25, 0.25])
        uncertainty = calibrator.compute_uncertainty(proba)
        assert uncertainty > 0.9

    def test_peaked_distribution_low_uncertainty(self, calibrator):
        """Peaked distribution should have low uncertainty."""
        proba = np.array([0.99, 0.003, 0.003, 0.004])
        uncertainty = calibrator.compute_uncertainty(proba)
        assert uncertainty < 0.2

    def test_abstention_on_low_confidence(self, calibrator):
        """Should abstain when confidence is below threshold."""
        proba = np.array([0.3, 0.3, 0.2, 0.2])
        uncertainty = calibrator.compute_uncertainty(proba)
        should_abstain, reason = calibrator.should_abstain(proba, uncertainty)
        assert should_abstain
        assert reason != ""

    def test_no_abstention_on_high_confidence(self, calibrator):
        """Should not abstain when confidence is high."""
        proba = np.array([0.85, 0.05, 0.05, 0.05])
        uncertainty = calibrator.compute_uncertainty(proba)
        should_abstain, reason = calibrator.should_abstain(proba, uncertainty)
        assert not should_abstain

    def test_batch_calibration(self, calibrator):
        """Should handle batch input."""
        proba = np.array([
            [0.8, 0.1, 0.1],
            [0.4, 0.3, 0.3],
        ])
        calibrated = calibrator.calibrate(proba)
        assert calibrated.shape == (2, 3)
        assert all(abs(row.sum() - 1.0) < 1e-5 for row in calibrated)
