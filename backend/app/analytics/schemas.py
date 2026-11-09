from __future__ import annotations

import re
from datetime import date
from decimal import Decimal
from statistics import median
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


PipelineStage = Literal["screening", "technical", "interview", "offered", "rejected", "unknown"]
DecisionStatus = Literal["pending", "advanced", "not_proceeding", "hired"]
SourceChannel = Literal[
    "careers_site",
    "job_board",
    "linkedin",
    "referral",
    "agency",
    "campus",
    "direct",
    "other",
]


class CandidateAnalyticsRecord(BaseModel):
    """Pseudonymous row; candidate names, emails, resumes and contact details are not accepted."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    record_ref: str = Field(pattern=r"^row-[A-Za-z0-9_-]{1,40}$", max_length=48)
    stage: PipelineStage
    decision_status: DecisionStatus
    overall_score: Decimal | None = Field(default=None, ge=0, le=100, max_digits=5, decimal_places=2)
    source_channel: SourceChannel | None = None
    recruiter_label: str | None = Field(default=None, min_length=1, max_length=40)
    applied_at: date | None = None
    hired_at: date | None = None

    @model_validator(mode="after")
    def validate_dates_and_labels(self):
        if self.recruiter_label and (
            "@" in self.recruiter_label
            or re.search(r"\d{5,}", self.recruiter_label)
            or re.search(r"\b(?:gmail|yahoo|outlook|phone|email)\b", self.recruiter_label, re.I)
        ):
            raise ValueError("Use a team label or anonymised recruiter alias, not contact details.")
        if self.hired_at and self.decision_status != "hired":
            raise ValueError("A hire date can only be supplied for a recruiter-confirmed hire.")
        if self.hired_at and not self.applied_at:
            raise ValueError("Application date is required when supplying a hire date.")
        if self.hired_at and self.applied_at and self.hired_at < self.applied_at:
            raise ValueError("Hire date cannot be earlier than application date.")
        return self


class RecruitmentAnalyticsRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    reporting_period: str = Field(default="Current loaded pipeline", min_length=2, max_length=80)
    candidate_records: list[CandidateAnalyticsRecord] = Field(min_length=1, max_length=5000)
    total_recruitment_cost: Decimal | None = Field(default=None, ge=0, max_digits=16, decimal_places=2)
    cost_currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    period_hires: int | None = Field(default=None, ge=0, le=100000)

    @model_validator(mode="after")
    def validate_aggregate_inputs(self):
        refs = [item.record_ref for item in self.candidate_records]
        if len(refs) != len(set(refs)):
            raise ValueError("Analytics record references must be unique.")
        if self.total_recruitment_cost is not None and not self.cost_currency:
            raise ValueError("Supply a three-letter currency when providing recruitment cost.")
        if self.cost_currency and self.total_recruitment_cost is None:
            raise ValueError("Recruitment cost is required when cost currency is supplied.")
        if self.total_recruitment_cost is not None and self.period_hires is None:
            raise ValueError("Supply the number of hires in the same reporting period to calculate cost per hire.")
        return self


class StageMetric(BaseModel):
    stage: PipelineStage
    candidates: int
    share_percent: Decimal


class DecisionMetric(BaseModel):
    status: DecisionStatus
    candidates: int
    share_percent: Decimal


class SourceEffectivenessMetric(BaseModel):
    source_channel: SourceChannel
    applicants: int
    hires: int
    hire_rate_percent: Decimal


class RecruiterPerformanceMetric(BaseModel):
    recruiter_label: str
    candidates: int
    advanced_or_hired: int
    hires: int
    average_overall_score: Decimal | None = None


class TimeToHireMetric(BaseModel):
    average_days: Decimal | None = None
    median_days: Decimal | None = None
    minimum_days: int | None = None
    maximum_days: int | None = None
    sample_size: int = 0


class CostPerHireMetric(BaseModel):
    amount: Decimal | None = None
    currency: str | None = None
    period_hires: int | None = None
    total_recruitment_cost: Decimal | None = None


class RecruitmentAnalyticsResponse(BaseModel):
    reporting_period: str
    generated_at: str
    total_candidates: int
    hired_count: int
    rejected_count: int
    pending_review_count: int
    advanced_count: int
    overall_hire_rate_percent: Decimal
    recruiter_advance_rate_percent: Decimal | None = None
    average_overall_score: Decimal | None = None
    stage_funnel: list[StageMetric]
    decision_breakdown: list[DecisionMetric]
    source_effectiveness: list[SourceEffectivenessMetric]
    recruiter_performance: list[RecruiterPerformanceMetric]
    time_to_hire: TimeToHireMetric
    cost_per_hire: CostPerHireMetric
    source_attributed_candidates: int
    recruiter_attributed_candidates: int
    score_sample_size: int
    warnings: list[str] = Field(default_factory=list)
    methodology: list[str] = Field(default_factory=list)
    persisted: Literal[False] = False
    candidate_level_data_returned: Literal[False] = False
