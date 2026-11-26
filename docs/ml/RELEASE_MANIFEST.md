# DermaSathiAI Release Manifest

## Included in runtime repository

### Backend

- FastAPI application
- AI demo API routes
- Gemini gateway
- AI orchestration
- configuration
- API schemas/services already required by runtime

### Skin AI

- V1 disease model
- V1 class mapping
- V2 open-set model
- V2 class mapping
- recommendation profiles
- safety/policy configuration

## Archived

Historical/research material should live outside the active repository:

- training experiments
- old model checkpoints
- dataset copies
- training logs
- old prototype scripts
- obsolete integration scripts
- local virtual environments
- local secrets

## Important external assets

### Medicine V4

The final trained Medicine V4 retriever was saved externally in Google Drive:

`/content/drive/MyDrive/DermaSathiAI/Medicine/models/medicine_retriever_v4_final`

It is not currently part of the active runtime Git tree.

### RxNorm

Primary local source previously used:

`/mnt/d/DermaSathiAI_Data/medicine/rxnorm/RxNorm_full_prescribe_09082026.zip`

### Fitzpatrick17k

Source previously used:

`/mnt/d/DermaSathiAI_Data/final_sources/fitzpatrick17k/extracted/fitzpatrick17k/fitzpatrick17k.csv`

### Ayurveda

Ayurveda training/research artifacts are preserved separately and are not required by the current Gemini-based demonstration care flow.

## GitHub

Large model files must use Git LFS.

Do not commit:

- `.env`
- API keys
- raw datasets
- training checkpoints
- giant research artifacts
- local virtual environments
