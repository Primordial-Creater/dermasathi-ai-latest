"""DermaSathiAI API v1 router."""

from fastapi import APIRouter

from app.api.v1.endpoints.auth_session_endpoints import router as auth_router
from app.api.v1.endpoints.skin_analysis import router as skin_analysis_router
from app.api.v1.endpoints.health_check import router as health_check_router
from app.api.v1.endpoints.history import router as history_router
from app.api.v1.endpoints.prescriptions import router as prescriptions_router
from app.api.v1.endpoints.reports import router as reports_router
from app.api.v1.endpoints.symptoms import router as symptoms_router
from app.api.v1.endpoints.medications import router as medications_router
from app.api.v1.endpoints.wellness import router as wellness_router
from app.api.v1.endpoints.health_assistant import router as health_assistant_router
from app.api.v1.endpoints.emergency import router as emergency_router
from app.api.v1.endpoints.healthcare_access import router as healthcare_access_router
from app.api.v1.skin_ai import router as skin_ai_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(skin_analysis_router, prefix="/skin", tags=["Skin Analysis"])
api_router.include_router(health_check_router, prefix="/health", tags=["Health"])
api_router.include_router(history_router, prefix="/history", tags=["Consultation History"])
api_router.include_router(prescriptions_router, prefix="/prescriptions", tags=["Prescriptions"])
api_router.include_router(reports_router, prefix="/reports", tags=["Medical Reports"])
api_router.include_router(symptoms_router, prefix="/symptoms", tags=["Symptom Assessment"])
api_router.include_router(medications_router, prefix="/medications", tags=["Medication Safety"])
api_router.include_router(wellness_router, prefix="/wellness", tags=["Ayurvedic Wellness"])
api_router.include_router(health_assistant_router, prefix="/assistant", tags=["General Health Assistant"])
api_router.include_router(emergency_router, prefix="/emergency", tags=["Emergency"])
api_router.include_router(healthcare_access_router, prefix="/healthcare", tags=["Healthcare Access"])
api_router.include_router(skin_ai_router)

# Backward-compatible alias for legacy imports.
router = api_router
