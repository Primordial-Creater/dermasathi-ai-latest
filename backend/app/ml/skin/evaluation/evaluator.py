"""
DermaSathiAI — Model Evaluator
=================================
Comprehensive evaluation pipeline for skin disease models.

Generates:
- Classification report (per-class P/R/F1)
- Confusion matrix (normalized + raw)
- Training/validation curves
- ROC-AUC (one-vs-rest)
- Machine-readable JSON artifacts
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


class ModelEvaluator:
    """
    Evaluate a trained model on a test dataset and generate
    comprehensive, reproducible reports.
    """

    def __init__(self, class_mapping: dict[str, int]):
        self.class_mapping = class_mapping
        self.index_to_class = {v: k for k, v in class_mapping.items()}
        self.class_names = [
            self.index_to_class[i] for i in range(len(class_mapping))
        ]

    def evaluate(
        self,
        model,
        test_dataset,
        output_dir: Path,
        training_history: Optional[dict] = None,
    ) -> dict[str, Any]:
        """
        Run full evaluation pipeline.

        Parameters
        ----------
        model : BaseSkinModel
            Trained model.
        test_dataset : tf.data.Dataset
            Test dataset.
        output_dir : Path
            Directory to save evaluation artifacts.

        Returns
        -------
        dict
            Complete evaluation metrics.
        """
        from sklearn.metrics import (
            accuracy_score,
            classification_report,
            confusion_matrix,
            f1_score,
            precision_score,
            recall_score,
        )

        output_dir.mkdir(parents=True, exist_ok=True)

        # Collect predictions and true labels
        y_true = []
        y_pred_proba = []

        for batch_x, batch_y in test_dataset:
            preds = model.predict(batch_x.numpy() if hasattr(batch_x, 'numpy') else batch_x)
            y_pred_proba.extend(preds)
            y_true.extend(np.argmax(batch_y.numpy() if hasattr(batch_y, 'numpy') else batch_y, axis=1))

        y_true = np.array(y_true)
        y_pred_proba = np.array(y_pred_proba)
        y_pred = np.argmax(y_pred_proba, axis=1)

        # --- Core metrics ---
        accuracy = float(accuracy_score(y_true, y_pred))
        macro_precision = float(precision_score(y_true, y_pred, average="macro", zero_division=0))
        macro_recall = float(recall_score(y_true, y_pred, average="macro", zero_division=0))
        macro_f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0))
        weighted_precision = float(precision_score(y_true, y_pred, average="weighted", zero_division=0))
        weighted_recall = float(recall_score(y_true, y_pred, average="weighted", zero_division=0))
        weighted_f1 = float(f1_score(y_true, y_pred, average="weighted", zero_division=0))

        metrics = {
            "accuracy": round(accuracy, 4),
            "macro_precision": round(macro_precision, 4),
            "macro_recall": round(macro_recall, 4),
            "macro_f1": round(macro_f1, 4),
            "weighted_precision": round(weighted_precision, 4),
            "weighted_recall": round(weighted_recall, 4),
            "weighted_f1": round(weighted_f1, 4),
            "num_test_samples": len(y_true),
            "num_classes": len(self.class_names),
        }

        # --- Classification report ---
        cls_report = classification_report(
            y_true,
            y_pred,
            labels=list(range(len(self.class_names))),
            target_names=self.class_names,
            output_dict=True,
            zero_division=0,
        )

        with open(output_dir / "classification_report.json", "w") as f:
            json.dump(cls_report, f, indent=2)

        # Text version
        cls_report_text = classification_report(
            y_true,
            y_pred,
            labels=list(range(len(self.class_names))),
            target_names=self.class_names,
            zero_division=0,
        )

        with open(output_dir / "classification_report.txt", "w") as f:
            f.write(cls_report_text)

        # --- Confusion matrix ---
        cm = confusion_matrix(y_true, y_pred)
        cm_normalized = confusion_matrix(y_true, y_pred, normalize="true")

        np.save(output_dir / "confusion_matrix.npy", cm)
        np.save(output_dir / "confusion_matrix_normalized.npy", cm_normalized)

        # Plot confusion matrix
        self._plot_confusion_matrix(cm, output_dir / "confusion_matrix.png")
        self._plot_confusion_matrix(
            cm_normalized,
            output_dir / "confusion_matrix_normalized.png",
            normalize=True,
        )

        # --- ROC-AUC ---
        try:
            from sklearn.metrics import roc_auc_score
            if len(self.class_names) > 2:
                # One-hot encode y_true for multiclass ROC
                y_true_onehot = np.eye(len(self.class_names))[y_true]
                roc_auc = float(roc_auc_score(
                    y_true_onehot,
                    y_pred_proba,
                    multi_class="ovr",
                    average="macro",
                ))
                metrics["roc_auc_macro"] = round(roc_auc, 4)
        except Exception as e:
            logger.warning("ROC-AUC computation failed: %s", e)

        # --- Training curves ---
        if training_history is not None:
            self._plot_training_curves(training_history, output_dir)
            with open(output_dir / "training_history.json", "w") as f:
                # Convert numpy values to float for JSON
                serializable = {
                    k: [float(v) for v in vals]
                    for k, vals in training_history.items()
                }
                json.dump(serializable, f, indent=2)

        # --- Save metrics ---
        with open(output_dir / "evaluation_metrics.json", "w") as f:
            json.dump(metrics, f, indent=2)

        logger.info(
            "Evaluation complete: accuracy=%.4f, macro_f1=%.4f, weighted_f1=%.4f",
            accuracy, macro_f1, weighted_f1,
        )

        return metrics

    def save_misclassified_examples(
        self,
        model,
        test_dataset,
        output_dir: Path,
        max_examples: int = 50,
    ) -> list[dict]:
        """
        Save examples of misclassified test images for error analysis.

        Returns list of error records with suspected error categories.
        """
        output_dir.mkdir(parents=True, exist_ok=True)
        errors = []

        sample_idx = 0
        for batch_x, batch_y in test_dataset:
            preds = model.predict(batch_x.numpy() if hasattr(batch_x, 'numpy') else batch_x)
            batch_y_np = batch_y.numpy() if hasattr(batch_y, 'numpy') else batch_y
            y_true_batch = np.argmax(batch_y_np, axis=1)
            y_pred_batch = np.argmax(preds, axis=1)

            for i in range(len(y_true_batch)):
                if y_true_batch[i] != y_pred_batch[i]:
                    true_label = self.index_to_class.get(y_true_batch[i], "unknown")
                    pred_label = self.index_to_class.get(y_pred_batch[i], "unknown")
                    confidence = float(preds[i][y_pred_batch[i]])

                    error_category = self._categorize_error(confidence, preds[i])

                    errors.append({
                        "sample_index": sample_idx + i,
                        "true_label": true_label,
                        "predicted_label": pred_label,
                        "confidence": round(confidence, 4),
                        "suspected_category": error_category,
                    })

                    if len(errors) >= max_examples:
                        break
                sample_idx += 1

            if len(errors) >= max_examples:
                break

        with open(output_dir / "misclassified_examples.json", "w") as f:
            json.dump(errors, f, indent=2)

        logger.info("Saved %d misclassified examples.", len(errors))
        return errors

    @staticmethod
    def _categorize_error(confidence: float, proba: np.ndarray) -> str:
        """
        Suggest a suspected error category.
        These are heuristic guesses, NOT certainties.
        """
        top2 = np.sort(proba)[-2:]
        margin = top2[1] - top2[0]

        if confidence < 0.3:
            return "suspected_low_quality_or_ood"
        elif margin < 0.1:
            return "suspected_visually_ambiguous"
        elif confidence > 0.8:
            return "suspected_label_error_or_domain_shift"
        else:
            return "suspected_model_confusion"

    def _plot_confusion_matrix(
        self,
        cm: np.ndarray,
        save_path: Path,
        normalize: bool = False,
    ) -> None:
        """Plot and save confusion matrix."""
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            import seaborn as sns

            fig, ax = plt.subplots(figsize=(12, 10))
            fmt = ".2f" if normalize else "d"
            sns.heatmap(
                cm,
                annot=True,
                fmt=fmt,
                cmap="Blues",
                xticklabels=self.class_names,
                yticklabels=self.class_names,
                ax=ax,
            )
            ax.set_xlabel("Predicted")
            ax.set_ylabel("True")
            title = "Confusion Matrix"
            if normalize:
                title += " (Normalized)"
            ax.set_title(title)
            plt.tight_layout()
            plt.savefig(save_path, dpi=150)
            plt.close(fig)
        except ImportError:
            logger.warning("matplotlib/seaborn not available; skipping plot.")

    def _plot_training_curves(
        self,
        history: dict,
        output_dir: Path,
    ) -> None:
        """Plot training/validation loss and accuracy curves."""
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt

            fig, axes = plt.subplots(1, 2, figsize=(14, 5))

            # Loss
            if "loss" in history:
                axes[0].plot(history["loss"], label="Train Loss")
            if "val_loss" in history:
                axes[0].plot(history["val_loss"], label="Val Loss")
            axes[0].set_title("Loss")
            axes[0].set_xlabel("Epoch")
            axes[0].legend()
            axes[0].grid(True, alpha=0.3)

            # Accuracy
            if "accuracy" in history:
                axes[1].plot(history["accuracy"], label="Train Accuracy")
            if "val_accuracy" in history:
                axes[1].plot(history["val_accuracy"], label="Val Accuracy")
            axes[1].set_title("Accuracy")
            axes[1].set_xlabel("Epoch")
            axes[1].legend()
            axes[1].grid(True, alpha=0.3)

            plt.tight_layout()
            plt.savefig(output_dir / "training_curves.png", dpi=150)
            plt.close(fig)
        except ImportError:
            logger.warning("matplotlib not available; skipping curve plot.")
