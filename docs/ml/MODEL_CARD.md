# DermaSathiAI — Model Card

## Model Overview

| Field | Value |
|---|---|
| **Model Name** | DermaSathiAI Skin Disease Classifier |
| **Version** | 0.1.0 (Prototype) |
| **Type** | Multi-class image classification |
| **Architectures** | InceptionV3, ResNet50, DenseNet201 |
| **Framework** | TensorFlow / Keras |
| **License** | See project LICENSE |

## Intended Use

- **Primary use**: AI-assisted skin disease identification for informational purposes
- **Target users**: Healthcare professionals, telemedicine platforms (with appropriate clinical validation)
- **Intended context**: Supplement to (NOT replacement for) professional dermatological assessment

## Out-of-Scope Use

- **NOT for**: Standalone medical diagnosis
- **NOT for**: Treatment planning or prescription
- **NOT for**: Emergency medical decisions
- **NOT for**: Legal or insurance determinations
- **NOT for**: Use without professional medical review

## Supported Classes (Prototype)

1. Actinic keratoses
2. Basal cell carcinoma
3. Benign keratosis-like lesions
4. Chickenpox
5. Cowpox
6. Dermatofibroma
7. Hand-foot-and-mouth disease
8. Healthy
9. Measles
10. Melanocytic nevi
11. Melanoma
12. Monkeypox
13. Squamous cell carcinoma
14. Vascular lesions

**Note**: These are prototype classes only. The model does NOT recognize conditions outside this list. Images of unrecognized conditions may receive incorrect classifications.

## Training Data

- **Prototype dataset**: Multi-class skin disease dataset (14 classes)
- **Preprocessing**: Resize, model-specific normalization
- **Augmentation**: Rotation, translation, flip, brightness/contrast variation (training only)
- **Splitting**: Stratified random split (train/val/test)
- **Known limitation**: Patient-level splitting not available for prototype dataset

## Model Architecture

- **Backbone**: ImageNet-pretrained CNN (InceptionV3/ResNet50/DenseNet201)
- **Head**: GlobalAveragePooling → Dropout → Dense(256, ReLU) → Dropout → Dense(N, Softmax)
- **Training**: Two-stage transfer learning (frozen backbone → selective fine-tuning)
- **Loss**: Categorical cross-entropy with label smoothing (0.1)
- **Class imbalance**: Inverse frequency class weighting

## Evaluation

Metrics computed for every model:
- Accuracy, Macro/Weighted Precision, Recall, F1
- Per-class metrics
- Confusion matrix
- ROC-AUC (one-vs-rest)

See `experiments/` for actual results.

## Uncertainty Handling

- Raw softmax probabilities are NOT presented as clinical confidence
- Temperature scaling post-hoc calibration is applied
- Predictive entropy provides uncertainty estimate
- Abstention (assessment_unavailable) when confidence is insufficient
- All responses include `requires_professional_review: true`

## Limitations

### Model Limitations
- Limited to 14 prototype classes
- No out-of-distribution detection (interface only)
- No severity classification
- Single-image input (no multi-view or temporal analysis)
- No clinical metadata incorporated in prediction

### Data Limitations
- Prototype dataset may not represent real-world distribution
- Limited skin-tone diversity evaluation (no validated metadata)
- No patient-level splitting in prototype
- Dermoscopic vs. smartphone domain gap not validated

### Demographic Limitations
- No validated skin-tone fairness analysis performed
- Model performance across different skin tones, ages, and body sites is NOT guaranteed
- This is a documented limitation, not an unsupported claim of fairness

### Known Failure Cases
- Images with heavy hair artifacts may reduce accuracy
- Low-quality (blurry, underexposed) images are rejected by quality gate
- Visually similar classes (e.g., benign vs. malignant lesions) may be confused
- Images outside the training domain will receive unreliable predictions

## Ethical Considerations

- This model is NOT a medical device
- This model has NOT received regulatory approval
- All predictions must be reviewed by qualified healthcare professionals
- The model must not be used to deny care or make definitive diagnoses
- Users must be informed that results are AI-assisted assessments, not diagnoses

## Reference Literature

- "Human Skin Diseases Identification and Treatment Suggestion by Sri Lankan Ayurveda Medicine using Machine Learning" (IEEE ICAC 2023)
  - Reported results (NOT guaranteed for this project):
    - InceptionV3: 97.20% (on their dataset)
    - DenseNet201: 95.80% (on their dataset)
    - ResNet50: 92% (on their dataset)

## Contact

DermaSathiAI Development Team
