"""
DermaSathiAI — Model Comparison
==================================
Compare evaluation results across multiple trained models.
Generates a comparison table factoring in discrimination,
minority-class performance, generalization, and inference cost.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import pandas as pd

logger = logging.getLogger(__name__)


def compare_models(experiments_dir: Path) -> pd.DataFrame:
    """
    Compare all evaluated models in the experiments directory.

    Parameters
    ----------
    experiments_dir : Path
        Root experiments directory containing per-experiment folders.

    Returns
    -------
    pd.DataFrame
        Comparison table with all key metrics.
    """
    records = []

    if not experiments_dir.exists():
        logger.warning("Experiments directory not found: %s", experiments_dir)
        return pd.DataFrame()

    for exp_dir in sorted(experiments_dir.iterdir()):
        if not exp_dir.is_dir():
            continue

        metrics_path = exp_dir / "evaluation_metrics.json"
        config_path = exp_dir / "experiment_meta.json"

        if not metrics_path.exists():
            continue

        with open(metrics_path) as f:
            metrics = json.load(f)

        model_name = "unknown"
        param_count = None
        if config_path.exists():
            with open(config_path) as f:
                meta = json.load(f)
            model_name = meta.get("model_name", "unknown")
            param_count = meta.get("total_params")

        record = {
            "Model": model_name,
            "Experiment": exp_dir.name,
            "Accuracy": metrics.get("accuracy"),
            "Macro F1": metrics.get("macro_f1"),
            "Weighted F1": metrics.get("weighted_f1"),
            "Macro Recall": metrics.get("macro_recall"),
            "Macro Precision": metrics.get("macro_precision"),
            "ROC-AUC": metrics.get("roc_auc_macro"),
            "Test Samples": metrics.get("num_test_samples"),
            "Parameters": param_count,
        }
        records.append(record)

    if not records:
        logger.warning("No evaluated experiments found.")
        return pd.DataFrame()

    df = pd.DataFrame(records)

    # Sort by macro F1 (primary), then weighted F1
    df = df.sort_values(
        ["Macro F1", "Weighted F1"], ascending=False
    ).reset_index(drop=True)

    return df


def save_comparison_report(
    comparison_df: pd.DataFrame,
    output_path: Path,
) -> None:
    """Save comparison as CSV and markdown."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # CSV
    comparison_df.to_csv(output_path.with_suffix(".csv"), index=False)

    # Markdown
    md_path = output_path.with_suffix(".md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# DermaSathiAI — Model Comparison Report\n\n")
        f.write("**NOTE**: Selection should consider discrimination, ")
        f.write("minority-class performance, generalization, inference cost, ")
        f.write("and deployment feasibility — not accuracy alone.\n\n")
        f.write(comparison_df.to_markdown(index=False))
        f.write("\n")

    logger.info("Comparison report saved: %s", md_path)
