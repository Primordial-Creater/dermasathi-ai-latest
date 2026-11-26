# DermaSathiAI — Disease Ontology

## Overview
This document outlines the clinical disease classes supported by the DermaSathiAI classification system, maintaining mappings from original source labels to the canonical DermaSathiAI labels.

## Current Supported Ontology (Prototype: 14 Classes)

| source dataset | original source label | canonical DERMASATHIAI label | mapping rationale | ambiguity | evidence | support status |
|----------------|-----------------------|------------------------------|-------------------|-----------|----------|----------------|
| Prototype 14-C | Actinic keratoses | Actinic keratoses | Direct match | Low | Clinical | Supported |
| Prototype 14-C | Basal cell carcinoma | Basal cell carcinoma | Direct match | Low | Clinical | Supported |
| Prototype 14-C | Benign keratosis-like lesions | Benign keratosis-like lesions | Direct match | Moderate | Clinical | Supported |
| Prototype 14-C | Chickenpox | Chickenpox | Direct match | Low | Clinical | Supported |
| Prototype 14-C | Cowpox | Cowpox | Direct match | Low | Clinical | Supported |
| Prototype 14-C | Dermatofibroma | Dermatofibroma | Direct match | Low | Clinical | Supported |
| Prototype 14-C | Hand-foot-and-mouth disease | Hand-foot-and-mouth disease | Direct match | Low | Clinical | Supported |
| Prototype 14-C | Healthy | Healthy | Direct match | High | General | Supported |
| Prototype 14-C | Measles | Measles | Direct match | Low | Clinical | Supported |
| Prototype 14-C | Melanocytic nevi | Melanocytic nevi | Direct match | Low | Clinical | Supported |
| Prototype 14-C | Melanoma | Melanoma | Direct match | Low | Clinical | Supported |
| Prototype 14-C | Monkeypox | Monkeypox | Direct match | Low | Clinical | Supported |
| Prototype 14-C | Squamous cell carcinoma | Squamous cell carcinoma | Direct match | Low | Clinical | Supported |
| Prototype 14-C | Vascular lesions | Vascular lesions | Direct match | Low | Clinical | Supported |

## Out-of-Distribution (OOD) / Unknown Handling
The system includes explicit support for `assessment_unavailable` or `insufficient_model_confidence` outcomes. If the model's calibrated confidence or uncertainty metrics indicate a sample does not align well with the supported ontology, it will be flagged rather than forced into one of these classes.
