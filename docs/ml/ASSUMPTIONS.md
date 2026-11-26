# DermaSathiAI — Assumptions

> Documented assumptions made during ML pipeline development.
> These should be reviewed and validated before production deployment.

## Dataset Assumptions

1. **Directory structure**: Raw images are organized as `raw/<source>/<class_name>/images.*` or `raw/<class_name>/images.*`. Classes are discovered dynamically from directory names.

2. **No patient IDs in prototype dataset**: The 14-class prototype dataset does not include patient-level identifiers. This means stratified random splitting is used instead of patient-level splitting. **Limitation**: Cannot guarantee zero patient leakage across splits.

3. **Label quality**: Directory names are treated as ground truth labels. No secondary label verification has been performed on the prototype dataset.

4. **Image format**: All images are assumed to be valid JPEG/PNG/WebP/BMP/TIFF files. Corrupt files are detected and excluded by the quality audit.

## Model Assumptions

5. **ImageNet pretrained weights**: All three models use ImageNet weights as initialization. This is a standard assumption for medical image transfer learning but has known domain gap limitations.

6. **Two-stage training**: Head-only training followed by fine-tuning is assumed to be more stable than end-to-end training from scratch. This is widely supported in literature.

7. **Single crop inference**: Inference uses a single center crop (resize). No test-time augmentation or multi-crop inference is implemented in the prototype.

8. **Class independence**: Each image belongs to exactly one class. Multi-label classification is not supported.

## Calibration Assumptions

9. **Temperature scaling**: Post-hoc temperature scaling is used as a simple calibration method. This assumes the softmax ranking is approximately correct but the magnitude needs adjustment.

10. **Fixed abstention thresholds**: Confidence and abstention thresholds are set via configuration. They have not been optimized on clinical data.

## Infrastructure Assumptions

11. **Single model serving**: The API loads one model at startup. Multi-model serving or ensemble inference is not implemented.

12. **No real-time GPU**: Inference is designed to work on CPU for the prototype API. GPU acceleration is used only during training.

## Limitations Requiring Future Validation

- Skin-tone fairness has not been evaluated (no validated skin-tone metadata in prototype)
- No OOD detection implemented (interface only)
- No severity classification implemented (future work)
- Treatment suggestions are not connected to the ML pipeline
- The 14-class prototype does not cover the full dermatology ontology
