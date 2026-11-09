from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.candidate_intelligence.schemas import CandidateProfile
from app.schemas import EvaluationRubric


class JobMatchContext(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    job_id: str = Field(min_length=1, max_length=100)
    job_title: str = Field(min_length=2, max_length=160)
    approved_for_matching: bool
    required_skills: list[str] = Field(default_factory=list, max_length=80)
    preferred_skills: list[str] = Field(default_factory=list, max_length=80)
    responsibilities: list[str] = Field(default_factory=list, max_length=40)
    education_requirements: list[str] = Field(default_factory=list, max_length=20)
    minimum_experience_months: int | None = Field(default=None, ge=0, le=600)
    rubric: EvaluationRubric

    @model_validator(mode="after")
    def validate_approval_and_rubric(self):
        if not self.approved_for_matching:
            raise ValueError("Only a recruiter-approved job can be used for matching.")
        if not self.required_skills and not self.responsibilities and not self.education_requirements:
            raise ValueError("Provide job-related skills, responsibilities or education criteria.")
        total = sum(item.weight_percent for item in self.rubric.criteria)
        if total != 100:
            raise ValueError("Approved rubric weights must total exactly 100.")
        return self


class CandidateMatchBatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job: JobMatchContext
    candidates: list[CandidateProfile] = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def unique_candidate_ids(self):
        identifiers = [item.candidate_id for item in self.candidates]
        if len(identifiers) != len(set(identifiers)):
            raise ValueError("Candidate IDs must be unique within a matching batch.")
        return self


class SkillMatch(BaseModel):
    skill: str
    status: Literal["matched", "not_detected"]
    evidence_ids: list[str] = Field(default_factory=list)


class CriterionMatch(BaseModel):
    criterion: str
    weight_percent: int
    score: float | None = Field(default=None, ge=0, le=100)
    status: Literal["scored", "not_evaluable"]
    rationale: str
    evidence_ids: list[str] = Field(default_factory=list)


class CandidateMatchResult(BaseModel):
    rank: int
    candidate_id: str
    source_file: str
    evidence_alignment_index: float | None = Field(default=None, ge=0, le=100)
    evidence_coverage_percent: float = Field(ge=0, le=100)
    scored_weight_percent: int = Field(ge=0, le=100)
    required_skill_matches: list[SkillMatch] = Field(default_factory=list)
    preferred_skill_matches: list[SkillMatch] = Field(default_factory=list)
    criteria: list[CriterionMatch] = Field(default_factory=list)
    strengths_supported_by_evidence: list[str] = Field(default_factory=list)
    not_detected_or_unverified: list[str] = Field(default_factory=list)
    review_flags: list[str] = Field(default_factory=list)
    retrieval_method: str
    decision_boundary: str = (
        "Advisory evidence alignment only. This result is not a hiring probability, "
        "eligibility decision, shortlist, rejection or recommendation to hire."
    )
    recruiter_decision: Literal["pending_review"] = "pending_review"


class CandidateMatchBatchResponse(BaseModel):
    job_id: str
    job_title: str
    processed_candidates: int
    results: list[CandidateMatchResult]
    methodology: str = (
        "The index is a weighted summary of observable job-related resume evidence. "
        "Only evaluable rubric criteria contribute to the index. Evidence coverage shows "
        "how much of the approved rubric could be assessed. Missing evidence is not proof "
        "that a candidate lacks a skill or qualification."
    )
