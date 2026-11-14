from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReviewFlag(BaseModel):
    code: str
    message: str
    severity: Literal["info", "warning", "review"] = "review"


class EvidenceItem(BaseModel):
    evidence_id: str
    field: str
    quote: str = Field(min_length=2, max_length=500)
    source_file: str
    page_number: int | None = None
    start_offset: int | None = None
    end_offset: int | None = None
    source_section: str | None = None


class ExtractedSkill(BaseModel):
    name: str
    confidence: float = Field(ge=0, le=1)
    evidence_ids: list[str] = Field(default_factory=list)


class ResumeNamedEntity(BaseModel):
    text: str
    label: Literal["ORG", "GPE", "LOC", "DATE"]
    evidence_ids: list[str] = Field(default_factory=list)


class ExperienceEntry(BaseModel):
    raw_entry: str
    title: str | None = None
    company: str | None = None
    date_range: str | None = None
    evidence_ids: list[str] = Field(default_factory=list)


class EducationEntry(BaseModel):
    raw_entry: str
    qualification: str | None = None
    institution: str | None = None
    date_range: str | None = None
    evidence_ids: list[str] = Field(default_factory=list)


class ProjectEntry(BaseModel):
    title: str | None = None
    details: str
    evidence_ids: list[str] = Field(default_factory=list)


class PrivacyMetadata(BaseModel):
    redaction_applied: bool
    redacted_entities: list[str] = Field(default_factory=list)
    redaction_engine: str
    redacted_resume_text: str


class CandidateProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidate_id: str
    source_file: str
    full_name: str | None = None
    email: str | None = None
    phone_numbers: list[str] = Field(default_factory=list)
    location: str | None = None
    headline: str | None = None
    summary: str | None = None
    skills: list[ExtractedSkill] = Field(default_factory=list)
    work_experience: list[ExperienceEntry] = Field(default_factory=list)
    education: list[EducationEntry] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    profile_links: list[str] = Field(default_factory=list)
    named_entities: list[ResumeNamedEntity] = Field(default_factory=list)
    nlp_engine: str
    evidence: list[EvidenceItem] = Field(default_factory=list)
    field_confidence: dict[str, float] = Field(default_factory=dict)
    extraction_status: Literal["parsed", "needs_review"]
    review_flags: list[ReviewFlag] = Field(default_factory=list)
    privacy: PrivacyMetadata

    @field_validator("email")
    @classmethod
    def validate_email_shape(cls, value: str | None) -> str | None:
        if value is not None and "@" not in value:
            raise ValueError("Extracted email does not have a valid email shape.")
        return value.lower() if value else value


class ResumeFileResult(BaseModel):
    file_name: str
    success: bool
    parser_used: str | None = None
    candidate_profile: CandidateProfile | None = None
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None


class CandidateIntelligenceBatchResponse(BaseModel):
    processed_count: int
    succeeded_count: int
    failed_count: int
    consent_confirmed: bool
    results: list[ResumeFileResult]


class SavedCandidateProfile(BaseModel):
    candidate_profile: CandidateProfile
    uploaded_at: str
