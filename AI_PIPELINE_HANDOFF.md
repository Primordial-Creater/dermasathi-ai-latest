# DermaSathiAI — AI Pipeline Handoff

## Active runtime

- `backend/main.py`
- `backend/app/ml/demo_router.py`
- `backend/app/ml/demo_orchestrator.py`
- `backend/app/ml/gemini_demo_gateway.py`

### Skin models

- `backend/models/skin_ai/v1_disease/`
- `backend/models/skin_ai/v2_open_set/`
- `backend/models/skin_ai/recommendations/`
- `backend/models/skin_ai/skin_ai_policy.json`

## Current skin inference policy

Gemini is the primary inference source for the current demonstration pipeline.

The local V1/V2 skin models remain available as shadow/fallback signals.

Transient Gemini errors use bounded retry/backoff and model fallback.

The release default does NOT use indefinite retry.

## Care pipeline

The condition-care layer may provide:

- medicine information
- safety / interaction warnings
- prescription-adherence extraction from explicit instructions
- lifestyle guidance
- dietary guidance
- monitoring timelines
- Ayurveda / traditional educational information

The system must not invent patient-specific prescriptions or medication schedules solely from a disease label.

## Multilingual behavior

The requested language is passed through the AI generation layer.

Internal canonical labels remain stable for backend logic.

## Secrets

Create:

    backend/.env

from:

    backend/.env.example

Never commit:

- API keys
- passwords
- JWT secrets
- credential files
- `backend/.env`

## External ML assets

Some research/training artifacts remain outside the release repository.

Examples:

- Medicine V4 trained retriever from Google Drive
- RxNorm source data
- DrugCentral exports
- Fitzpatrick17k source data
- Ayurveda research/training artifacts

These should be preserved in the archive or their original external storage.

## Production note

The current demonstration pipeline uses Gemini as the primary skin condition inference layer.

Local disease models should not be described as clinically validated general-purpose diagnosis systems.
