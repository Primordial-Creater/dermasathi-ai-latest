# DermaSathiAI — Dataset Registry

## Overview
This registry tracks all potential, acquired, and integrated datasets for the DermaSathiAI machine learning models. 

## Integrated Prototype Dataset
The current initial prototype system uses a 14-class dataset built from various sources (primarily an aggregated Kaggle dataset). 

| dataset_name | source_url | source_institution | publication/reference | dataset_version | access_date | license | allowed_use | image_count | patient_count | class_count |
|--------------|------------|--------------------|-----------------------|-----------------|-------------|---------|-------------|-------------|---------------|-------------|
| Prototype 14-class | Kaggle `ahmedxc4/skin-ds` | Multiple/Kaggle | N/A | v1.0 | 2026-09-26 | Unknown / Mixed | Prototyping | ~36k | Unknown | 14 |

### Details: Prototype 14-class
- **class_names**: Actinic keratoses, Basal cell carcinoma, Benign keratosis-like lesions, Chickenpox, Cowpox, Dermatofibroma, Hand-foot-and-mouth disease, Healthy, Measles, Melanocytic nevi, Melanoma, Monkeypox, Squamous cell carcinoma, Vascular lesions
- **diagnostic_method**: Mixed (Clinical, Dermoscopic)
- **annotation_method**: Mixed 
- **expert involvement**: Unknown (Likely minimal for non-ISIC subsets)
- **ethics information**: Null
- **patient_id availability**: No
- **demographic metadata**: Null
- **skin-tone metadata**: Null
- **known limitations**: High class imbalance, missing patient-level splitting capability, unknown demographic representation, potential data leakage without near-duplicate filtering.
- **known biases**: Bias towards lighter skin tones common in public datasets. 
- **download method**: `kaggle datasets download -d ahmedxc4/skin-ds`
- **acquisition status**: `acquired`

## Candidate Datasets for Future Expansion
| dataset_name | source_url | source_institution | publication/reference | dataset_version | access_date | license | allowed_use | image_count | patient_count | class_count |
|--------------|------------|--------------------|-----------------------|-----------------|-------------|---------|-------------|-------------|---------------|-------------|
| ISIC Archive | isic-archive.com | ISIC | ISIC | TBD | TBD | Dataset-specific | Research / TBD | >100k | TBD | TBD |
| HAM10000 | TBD | ViDIR | HAM10000 | 1.0 | TBD | CC BY 4.0 | Yes | 10,015 | TBD | 7 |
| SLICE-3D | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

