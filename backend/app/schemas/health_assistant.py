from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.services.language_service import resolve_language


class AssistantContextMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=3000)


class HealthAssistantRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    language: str = Field(default="en", max_length=20)
    context: list[AssistantContextMessage] = Field(default_factory=list, max_length=12)

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        code, _ = resolve_language(value)
        return code


class HealthAssistantAIResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    response_language: str = Field(min_length=1, max_length=80)
    answer: str = Field(min_length=1, max_length=5000)
    key_points: list[str] = Field(default_factory=list, max_length=8)
    follow_up_questions: list[str] = Field(default_factory=list, max_length=6)
    safety_note: str = Field(min_length=1, max_length=1500)


class HealthAssistantResponse(BaseModel):
    record_id: int | None = None
    answer: str
    key_points: list[str] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    safety_note: str
    requested_language: str = "English"
    response_language: str = "English"
    ai_enhancement_status: Literal["completed", "unavailable", "fallback_english", "emergency_fast_path"] = "unavailable"
    emergency_fast_path: bool = False
    analysis_provider: str | None = None
    analysis_model: str | None = None
    fallback_used: bool = False
