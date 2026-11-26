"""
DermaSathiAI — Base Model Interface
=====================================
Abstract base class for all skin disease classification models.

All models share:
- Two-stage transfer learning protocol
- Configurable classifier head
- Consistent save/load API
- Reproducible seed management
"""

from __future__ import annotations

import abc
import json
import logging
from pathlib import Path
from typing import Any, Optional

import numpy as np

logger = logging.getLogger(__name__)


class BaseSkinModel(abc.ABC):
    """
    Abstract base class for skin disease classification models.

    Subclasses implement _build_backbone() to provide the specific
    pretrained CNN architecture. Everything else is shared.
    """

    def __init__(self, config: dict[str, Any]):
        self.config = config
        model_cfg = config.get("model", {})
        training_cfg = config.get("training", {})

        self.model_name: str = model_cfg.get("name", "unknown")
        self.image_size: int = model_cfg.get("image_size", 224)
        self.input_shape: tuple = tuple(model_cfg.get("input_shape", [224, 224, 3]))
        self.unfreeze_from: str = model_cfg.get("unfreeze_from", "")
        self.pretrained_weights: str = model_cfg.get("pretrained_weights", "imagenet")

        self.num_classes: int = len(config.get("classes", []))
        self.dropout: float = training_cfg.get("dropout", 0.3)
        self.label_smoothing: float = training_cfg.get("label_smoothing", 0.1)
        self.seed: int = training_cfg.get("seed", 42)

        self.model = None
        self.backbone = None
        self.class_mapping: dict[str, int] = {}

    # ------------------------------------------------------------------
    # Abstract
    # ------------------------------------------------------------------

    @abc.abstractmethod
    def _build_backbone(self):
        """
        Build and return the pretrained backbone model.

        Returns
        -------
        tf.keras.Model
            Pretrained backbone WITHOUT the classification head.
        """
        ...

    @abc.abstractmethod
    def _get_preprocess_fn(self):
        """Return the model-specific preprocessing function."""
        ...

    # ------------------------------------------------------------------
    # Build
    # ------------------------------------------------------------------

    def build(self, num_classes: Optional[int] = None) -> None:
        """
        Build the complete model: backbone + classifier head.

        Parameters
        ----------
        num_classes : int, optional
            Override number of classes from config.
        """
        import tensorflow as tf

        if num_classes is not None:
            self.num_classes = num_classes

        if self.num_classes < 2:
            raise ValueError(
                f"num_classes must be >= 2, got {self.num_classes}. "
                "Check that 'classes' is set in config."
            )

        # Set seed for reproducibility
        tf.random.set_seed(self.seed)
        np.random.seed(self.seed)

        # Build backbone
        self.backbone = self._build_backbone()
        self.backbone.trainable = False  # Freeze for Stage 1

        # Build full model
        inputs = tf.keras.Input(shape=self.input_shape, name="input_image")
        x = self.backbone(inputs, training=False)
        x = tf.keras.layers.GlobalAveragePooling2D(name="gap")(x)
        x = tf.keras.layers.Dropout(self.dropout, name="dropout_1")(x)
        x = tf.keras.layers.Dense(256, activation="relu", name="dense_bridge")(x)
        x = tf.keras.layers.Dropout(self.dropout, name="dropout_2")(x)
        outputs = tf.keras.layers.Dense(
            self.num_classes,
            activation="softmax",
            name="predictions",
        )(x)

        self.model = tf.keras.Model(inputs=inputs, outputs=outputs, name=self.model_name)
        logger.info(
            "Model '%s' built: %d parameters (%d trainable)",
            self.model_name,
            self.model.count_params(),
            sum(
                tf.keras.backend.count_params(w)
                for w in self.model.trainable_weights
            ),
        )

    # ------------------------------------------------------------------
    # Compile
    # ------------------------------------------------------------------

    def compile_for_head_training(
        self,
        learning_rate: float = 1e-3,
    ) -> None:
        """Compile model for Stage 1: head-only training."""
        import tensorflow as tf

        self.backbone.trainable = False

        self.model.compile(
            optimizer=tf.keras.optimizers.Adam(
                learning_rate=learning_rate
            ),
            loss=tf.keras.losses.CategoricalCrossentropy(
                label_smoothing=self.label_smoothing,
            ),
            metrics=[
                "accuracy",
                tf.keras.metrics.AUC(
                    name="auc",
                    multi_label=True,
                ),
            ],
        )

        logger.info(
            "Compiled for head training (LR=%.6f)",
            learning_rate,
        )

    def compile_for_finetuning(
        self,
        learning_rate: float = 1e-5,
    ) -> None:
        """
        Compile model for Stage 2: fine-tuning upper backbone layers.

        BatchNormalization layers remain frozen during fine-tuning.
        """
        import tensorflow as tf

        self.backbone.trainable = True

        # Freeze layers below the unfreeze point.
        if self.unfreeze_from:
            set_trainable = False

            for layer in self.backbone.layers:
                if layer.name == self.unfreeze_from:
                    set_trainable = True

                layer.trainable = set_trainable

                # Keep BatchNorm frozen during fine-tuning.
                if isinstance(
                    layer,
                    tf.keras.layers.BatchNormalization,
                ):
                    layer.trainable = False

        trainable_count = sum(
            tf.keras.backend.count_params(w)
            for w in self.model.trainable_weights
        )

        logger.info(
            "Fine-tuning: %d trainable parameters "
            "(unfreeze from '%s')",
            trainable_count,
            self.unfreeze_from,
        )

        self.model.compile(
            optimizer=tf.keras.optimizers.Adam(
                learning_rate=learning_rate
            ),
            loss=tf.keras.losses.CategoricalCrossentropy(
                label_smoothing=self.label_smoothing,
            ),
            metrics=[
                "accuracy",
                tf.keras.metrics.AUC(
                    name="auc",
                    multi_label=True,
                ),
            ],
        )

    # ------------------------------------------------------------------
    # Training callbacks
    # ------------------------------------------------------------------

    def get_callbacks(
        self,
        checkpoint_dir: Path,
        stage: str = "head",
    ) -> list:
        """Get standard training callbacks."""
        import tensorflow as tf

        training_cfg = self.config.get("training", {})
        checkpoint_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        callbacks = [
            tf.keras.callbacks.EarlyStopping(
                monitor="val_loss",
                patience=training_cfg.get(
                    "early_stopping_patience",
                    5,
                ),
                restore_best_weights=True,
                verbose=1,
            ),
            tf.keras.callbacks.ReduceLROnPlateau(
                monitor="val_loss",
                factor=training_cfg.get(
                    "reduce_lr_factor",
                    0.5,
                ),
                patience=training_cfg.get(
                    "reduce_lr_patience",
                    3,
                ),
                min_lr=training_cfg.get(
                    "min_lr",
                    1e-7,
                ),
                verbose=1,
            ),
            tf.keras.callbacks.ModelCheckpoint(
                filepath=str(
                    checkpoint_dir / f"best_{stage}.keras"
                ),
                monitor="val_loss",
                save_best_only=True,
                verbose=1,
            ),
            tf.keras.callbacks.CSVLogger(
                str(
                    checkpoint_dir /
                    f"training_log_{stage}.csv"
                ),
            ),
        ]

        # Mixed precision
        if training_cfg.get("mixed_precision", False):
            try:
                tf.keras.mixed_precision.set_global_policy(
                    "mixed_float16"
                )
                logger.info("Mixed precision enabled.")
            except Exception as e:
                logger.warning(
                    "Could not enable mixed precision: %s",
                    e,
                )

        return callbacks

    # ------------------------------------------------------------------
    # Predict
    # ------------------------------------------------------------------

    def predict(
        self,
        preprocessed_input: np.ndarray,
    ) -> np.ndarray:
        """
        Run inference on preprocessed input.

        Parameters
        ----------
        preprocessed_input : np.ndarray
            Shape (batch, H, W, 3), already preprocessed.

        Returns
        -------
        np.ndarray
            Raw probability distribution per sample.
        """
        if self.model is None:
            raise RuntimeError("Model not built or loaded.")

        return self.model.predict(
            preprocessed_input,
            verbose=0,
        )

    # ------------------------------------------------------------------
    # Save / Load
    # ------------------------------------------------------------------

    def save(
        self,
        save_dir: Path,
        class_mapping: dict[str, int],
    ) -> None:
        """Save model weights, config, and class mapping."""
        save_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        # Save weights
        self.model.save(
            str(save_dir / "model.keras")
        )

        # Save class mapping
        with open(
            save_dir / "class_mapping.json",
            "w",
        ) as f:
            json.dump(
                class_mapping,
                f,
                indent=2,
            )

        # Save model config
        model_meta = {
            "model_name": self.model_name,
            "image_size": self.image_size,
            "input_shape": list(self.input_shape),
            "num_classes": self.num_classes,
            "unfreeze_from": self.unfreeze_from,
            "dropout": self.dropout,
            "label_smoothing": self.label_smoothing,
            "total_params": self.model.count_params(),
        }

        with open(
            save_dir / "model_config.json",
            "w",
        ) as f:
            json.dump(
                model_meta,
                f,
                indent=2,
            )

        logger.info(
            "Model saved to: %s",
            save_dir,
        )

    def load(
        self,
        save_dir: Path,
    ) -> None:
        """Load model from saved directory."""
        import tensorflow as tf

        model_path = save_dir / "model.keras"

        if not model_path.exists():
            raise FileNotFoundError(
                f"Model not found: {model_path}"
            )

        self.model = tf.keras.models.load_model(
            str(model_path)
        )

        # Load class mapping
        mapping_path = save_dir / "class_mapping.json"

        if mapping_path.exists():
            with open(mapping_path) as f:
                self.class_mapping = json.load(f)

            self.num_classes = len(
                self.class_mapping
            )

        logger.info(
            "Model loaded from: %s",
            save_dir,
        )

    def summary(self) -> str:
        """Return model summary as string."""
        if self.model is None:
            return "Model not built."

        lines = []

        self.model.summary(
            print_fn=lambda x: lines.append(x)
        )

        return "\n".join(lines)