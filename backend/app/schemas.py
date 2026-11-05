from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

WorkplaceType = Literal["onsite", "hybrid", "remote", "unspecified"]
EmploymentType = Literal[
    "full_time", "part_time", "contract", "internship", "temporary", "unspecified"
]


class JobRequirementInput(BaseModel):
    """Company-provided brief. Missing facts remain unspecified; they are not invented."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    company_name: str = Field(default="", max_length=160)
    job_title: str = Field(min_length=2, max_length=160)
    department: str = Field(default="", max_length=120)
    location: str = Field(default="", max_length=160)
    workplace_type: WorkplaceType = "unspecified"
    headcount: int = Field(default=1, ge=1, le=10000)
    employment_type: EmploymentType = "unspecified"
    seniority: str = Field(default="", max_length=100)
    min_experience_months: int | None = Field(default=None, ge=0, le=600)
    max_experience_months: int | None = Field(default=None, ge=0, le=600)
    salary_budget: str = Field(default="", max_length=160)
    currency: str = Field(default="INR", max_length=8)
    hiring_timeline: str = Field(default="", max_length=160)
    requirements: str = Field(default="", max_length=12000)
    required_skills: list[str] = Field(default_factory=list, max_length=80)
    preferred_skills: list[str] = Field(default_factory=list, max_length=80)
    responsibilities: list[str] = Field(default_factory=list, max_length=40)
    education_requirements: list[str] = Field(default_factory=list, max_length=20)
    industry: str = Field(default="", max_length=120)
    additional_context: str = Field(default="", max_length=5000)

    @field_validator(
        "required_skills", "preferred_skills", "responsibilities", "education_requirements"
    )
    @classmethod
    def clean_string_lists(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for value in values:
            item = " ".join(value.split()).strip(" ,;")
            key = item.casefold()
            if item and key not in seen:
                cleaned.append(item)
                seen.add(key)
        return cleaned

    @model_validator(mode="after")
    def validate_experience_range(self):
        if (
            self.min_experience_months is not None
            and self.max_experience_months is not None
            and self.max_experience_months < self.min_experience_months
        ):
            raise ValueError("max_experience_months cannot be lower than min_experience_months")
        return self


class RubricCriterion(BaseModel):
    criterion: str = Field(min_length=3, max_length=240)
    weight_percent: int = Field(ge=1, le=100)
    evidence_to_look_for: list[str] = Field(default_factory=list, max_length=10)


class EvaluationRubric(BaseModel):
    scoring_scale: str = "0–100 role-related evidence index; not a hiring probability."
    criteria: list[RubricCriterion] = Field(min_length=2, max_length=10)
    decision_boundary: str = (
        "Advisory support only. A recruiter must review the evidence before any candidate decision."
    )

class JobDraftContent(BaseModel):
    role_summary: str = Field(min_length=20, max_length=1800)
    responsibilities: list[str] = Field(min_length=2, max_length=15)
    required_qualifications: list[str] = Field(default_factory=list, max_length=15)
    required_skills: list[str] = Field(default_factory=list, max_length=40)
    preferred_skills: list[str] = Field(default_factory=list, max_length=40)
    experience_expectation: str = "Not specified by the company."
    education_expectation: str = "Not specified by the company."
    success_criteria: list[str] = Field(default_factory=list, max_length=10)
    rubric: EvaluationRubric


class ReviewFlag(BaseModel):
    category: str
    evidence: str
    action: str


class JobIntelligenceResponse(BaseModel):
    status: Literal["draft_ready", "needs_clarification"]
    job_description_markdown: str | None = None
    structured_job: JobDraftContent | None = None
    rubric: EvaluationRubric | None = None
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    clarification_questions: list[str] = Field(default_factory=list)
    review_flags: list[ReviewFlag] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    generation_mode: Literal["ollama", "template_fallback", "not_generated"]
    model_name: str | None = None
    requires_company_approval: bool = True
