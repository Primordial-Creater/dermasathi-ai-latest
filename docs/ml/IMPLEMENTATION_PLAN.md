# DermaSathiAI — ML Pipeline Implementation Plan

> Generated: 2026-09-25  
> Status: ACTIVE  
> Author: ML Engineering Team

---

## 1. Repository Assessment

### Existing Architecture (Preserved)
- **FastAPI app**: `backend/main.py` with health endpoint
- **Configuration**: `backend/app/core/config.py` (Pydantic Settings, `.env`)
- **Database**: PostgreSQL via SQLAlchemy (connection string in `.env`)
- **Auth**: JWT scaffold in `backend/app/auth/`
- **Directory structure**: `api/`, `auth/`, `core/`, `database/`, `middleware/`, `ml/`, `models/`, `ocr/`, `repositories/`, `schemas/`, `services/`, `speech/`, `utils/`
- **Datasets**: `backend/datasets/skin/` with `raw/`, `processed/`, `metadata/`, `splits/`, `reports/`
- **Trained models**: `backend/trained_models/`
- **Requirements**: `backend/requirements/base.txt` (FastAPI stack, no ML deps yet)
- **Tests**: `backend/tests/` (empty)
- **Scripts**: `scripts/` (empty)

### Key Finding
All existing directories are scaffolded but empty (except `core/config.py` and `main.py`). We build inside the existing structure without conflicts.

---

## 2. Architecture

```
User Image Upload
       |
       v
  API Router      POST /api/v1/skin/analyze
       |
       v
  Image Validation (format, size, basic checks)
       |
       v
  Quality Gate    (blur, exposure, resolution, contrast)
       |  reject if unusable
       v
  Preprocess      (resize, normalize, optional artifact removal)
       |
       v
  Inference       (model registry -> selected model -> forward pass)
       |
       v
  Calibration     (temperature scaling, uncertainty estimation)
  & Uncertainty
       |  abstain if uncertain
       v
  Response        (structured JSON with disclaimers)
```

---

## 3. Files to Create/Change

### ML Pipeline (backend/app/ml/)
- `__init__.py`
- `skin/__init__.py`
- `skin/models/` — base_model, inception_v3, resnet50, densenet201, model_factory
- `skin/preprocessing/` — image_preprocessor, artifact_removal, augmentation
- `skin/quality/` — image_quality_gate
- `skin/inference/` — inference_engine
- `skin/evaluation/` — evaluator, model_comparison
- `skin/calibration/` — calibrator
- `skin/registry/` — model_registry
- `skin/schemas/` — prediction_schema
- `skin/data/` — dataset_manifest, data_loader, quality_audit, splitter

### Configuration (configs/)
- `skin_models/base_config.yaml`, `inception_v3.yaml`, `resnet50.yaml`, `densenet201.yaml`

### Scripts (scripts/)
- `data/ingest_dataset.py`, `build_manifest.py`, `run_audit.py`
- `training/train_model.py`, `train_all_models.py`
- `evaluation/evaluate_model.py`, `compare_models.py`

### API Integration (backend/app/)
- `api/__init__.py`, `api/v1/router.py`, `api/v1/skin_analysis.py`
- `services/skin_analysis_service.py`
- `schemas/skin_analysis.py`

### Tests (backend/tests/)
- ML tests: quality_gate, preprocessing, model_loading, inference, calibration, data_pipeline
- API tests: skin_analysis endpoint

### Documentation (docs/ml/)
- IMPLEMENTATION_PLAN.md, MODEL_CARD.md, ASSUMPTIONS.md, PROGRESS.md

---

## 4. Model Strategy

### Transfer Learning Architecture
All three models share the same pattern:
1. Backbone: ImageNet-pretrained, output before classification head
2. Bridge: GlobalAveragePooling2D -> Dropout -> Dense(256, ReLU) -> Dropout
3. Head: Dense(num_classes, softmax)

### Training Protocol
- Stage 1 (Head training): Freeze backbone, train head only, LR=1e-3, ~10 epochs
- Stage 2 (Fine-tuning): Unfreeze top N layers, LR=1e-5, ~20 epochs
- Optimizer: Adam with weight decay
- Loss: Categorical crossentropy with label smoothing (0.1)
- Class weights: Inverse frequency weighting

### Model Settings
| Setting | InceptionV3 | ResNet50 | DenseNet201 |
|---------|-------------|----------|-------------|
| Input Size | 299x299 | 224x224 | 224x224 |
| Unfreeze from | mixed7 | conv4_block1 | conv5_block1 |

---

## 5. 48-Hour Priority Order

| Priority | Task | Est. Hours |
|---|---|---|
| P1 | Repository inspection + plan | 1 |
| P2 | ML foundation (configs, schemas, base classes) | 2 |
| P3 | Data pipeline (manifest, audit, loader, splitter) | 2 |
| P4 | Quality gate + preprocessing | 1.5 |
| P5 | Model implementations (3 models) | 2 |
| P6 | Training pipeline | 2 |
| P7 | Evaluation pipeline | 1.5 |
| P8 | Inference engine + calibration | 1.5 |
| P9 | Backend API integration | 1 |
| P10 | Tests | 1.5 |
| P11 | Model card + documentation | 1 |
