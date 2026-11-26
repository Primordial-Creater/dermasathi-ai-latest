from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field


class AbnormalValue(BaseModel):
    parameter: str = Field(..., description="Name of the clinical test parameter")
    value: str = Field(..., description="Observed value and units as printed")
    reference_range: Optional[str] = Field(None, description="Reference interval printed on the source report")
    status: str = Field("abnormal", description="high, low, abnormal, critical, or normal")
    clinical_significance: Optional[str] = Field(None, description="Careful, non-diagnostic explanation in the selected language")


class ReportSectionInterpretation(BaseModel):
    section_name: str
    summary: str
    observations: List[str] = Field(default_factory=list)


class MedicalReportAnalysisResponse(BaseModel):
    record_id: Optional[int] = None
    success: bool = True
    report_title: str = Field(..., description="Identified report heading or investigation title")
    report_type: str = Field("Diagnostic Lab Report", description="Category of report")
    test_date: Optional[str] = Field(None, description="Investigation date if identified")
    patient_summary: str = Field(..., description="Patient-friendly executive summary")
    what_this_report_measures: Optional[str] = None
    interpretation_by_section: List[ReportSectionInterpretation] = Field(default_factory=list)
    key_findings: List[str] = Field(default_factory=list)
    abnormal_values: List[AbnormalValue] = Field(default_factory=list)
    normal_values: List[str] = Field(default_factory=list)
    follow_up_recommendations: List[str] = Field(default_factory=list)
    doctor_questions: List[str] = Field(default_factory=list)
    questions_to_confirm: List[str] = Field(default_factory=list)
    urgency_level: str = Field("monitor", description="routine, monitor, consult_doctor, or emergency")
    when_to_seek_urgent_care: List[str] = Field(default_factory=list)
    conclusion: Optional[str] = None
    clinical_notes: Optional[str] = None
    limitations: List[str] = Field(default_factory=list)
    data_quality_notes: List[str] = Field(default_factory=list)
    clinical_disclaimer: str = (
        "This AI explanation is educational and is not a diagnosis or a substitute for a qualified clinician. "
        "Review the original report with your treating doctor."
    )
    analysis_provider: Optional[str] = None
    analysis_model: Optional[str] = None
    fallback_used: bool = False
    source_page_count: Optional[int] = None
    source_text_truncated: bool = False
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
