# DermaSathiAI — Training Guide

## Prerequisites

- Python 3.10+
- TensorFlow 2.15+ (with GPU support recommended)
- CUDA 11.8+ / cuDNN 8.6+ (for GPU training)

## Installation

```bash
# From project root
pip install -r backend/requirements/base.txt
pip install -r backend/requirements/ml.txt

# For development/testing
pip install pytest httpx
```

## Step 1: Dataset Preparation

### Option A: Download from Kaggle

```bash
# Install kaggle CLI
pip install kaggle

# Set up Kaggle credentials (~/.kaggle/kaggle.json)
# Then download:
python -m scripts.data.ingest_dataset --source kaggle --dataset <dataset-slug>
```

### Option B: Use Local Dataset

```bash
# Expected structure: class_name/images
python -m scripts.data.ingest_dataset --source local --path /path/to/dataset --name skin_14class
```

### Build Manifest

```bash
python -m scripts.data.build_manifest
```

### Run Quality Audit + Create Splits

```bash
python -m scripts.data.run_audit
```

This creates:
- `backend/datasets/skin/reports/audit_report.json`
- `backend/datasets/skin/splits/train.csv`
- `backend/datasets/skin/splits/val.csv`
- `backend/datasets/skin/splits/test.csv`

## Step 2: Training

### Train Individual Model

```bash
# InceptionV3
python -m scripts.training.train_model --model inception_v3

# ResNet50
python -m scripts.training.train_model --model resnet50

# DenseNet201
python -m scripts.training.train_model --model densenet201
```

### Smoke Test (CPU, no dataset needed)

```bash
python -m scripts.training.train_model --model inception_v3 --smoke-test
```

### Configuration

Edit `configs/skin_models/base_config.yaml` for shared settings.
Edit `configs/skin_models/<model>.yaml` for model-specific overrides.

Key parameters:
- `training.batch_size`: Reduce if GPU OOM (default: 32)
- `training.epochs_head`: Stage 1 epochs (default: 10)
- `training.epochs_finetune`: Stage 2 epochs (default: 20)
- `training.mixed_precision`: Enable for faster training on modern GPUs

## Step 3: Evaluation

Results are automatically saved to `experiments/<experiment_id>/`:
- `evaluation_metrics.json` — core metrics
- `classification_report.json` — per-class P/R/F1
- `confusion_matrix.png` — visualization
- `training_curves.png` — loss/accuracy plots
- `error_analysis/` — misclassified examples

### Compare Models

```bash
python -m scripts.evaluation.compare_models
```

## Step 4: Deploy

### Start API Server

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

The server will attempt to load the best trained model at startup.

### Test API

```bash
# Check status
curl http://localhost:8000/api/v1/skin/status

# Analyze image
curl -X POST http://localhost:8000/api/v1/skin/analyze \
  -F "file=@/path/to/skin_image.jpg"
```

## Google Colab / Cloud GPU Training

```python
# In Colab notebook:
!git clone <repo_url>
%cd DermaSathi-AI
!pip install -r backend/requirements/ml.txt

# Upload dataset to backend/datasets/skin/raw/
# Then:
!python -m scripts.data.build_manifest
!python -m scripts.data.run_audit
!python -m scripts.training.train_model --model inception_v3
!python -m scripts.training.train_model --model resnet50
!python -m scripts.training.train_model --model densenet201
```

## Running Tests

```bash
cd backend
python -m pytest tests/ -v
```
