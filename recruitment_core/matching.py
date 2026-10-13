"""Deterministic, explainable candidate-to-role matching.

Decision support only: this module never makes an autonomous hire/reject decision.
Protected attributes are not accepted as scoring inputs.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import re


def _normalise(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


@dataclass
class CandidateProfile:
    candidate_id: str
    skills: List[str] = field(default_factory=list)
    experience_years: float = 0.0
    education: Optional[str] = None
    evidence: Dict[str, str] = field(default_factory=dict)


@dataclass
class JobCriteria:
    role_title: str
    required_skills: List[str] = field(default_factory=list)
    preferred_skills: List[str] = field(default_factory=list)
    minimum_experience_years: float = 0.0
    skill_weight: float = 0.75
    experience_weight: float = 0.25

    def __post_init__(self):
        if self.skill_weight < 0 or self.experience_weight < 0:
            raise ValueError("Weights must be non-negative")
        total = self.skill_weight + self.experience_weight
        if total <= 0:
            raise ValueError("At least one weight must be positive")
        self.skill_weight /= total
        self.experience_weight /= total


@dataclass
class MatchResult:
    candidate_id: str
    role_title: str
    score: float
    matched_required_skills: List[str]
    missing_required_skills: List[str]
    matched_preferred_skills: List[str]
    experience_score: float
    evidence: Dict[str, str]
    explanation: str
    review_required: bool = True


def score_candidate(candidate: CandidateProfile, job: JobCriteria) -> MatchResult:
    """Compute a reproducible 0-100 score and expose its evidence and gaps."""
    candidate_skills = {_normalise(s): s.strip() for s in candidate.skills if s and s.strip()}
    required = [s for s in job.required_skills if s and s.strip()]
    preferred = [s for s in job.preferred_skills if s and s.strip()]
    matched_required = [s for s in required if _normalise(s) in candidate_skills]
    missing_required = [s for s in required if _normalise(s) not in candidate_skills]
    matched_preferred = [s for s in preferred if _normalise(s) in candidate_skills]

    if required and preferred:
        skill_score = 80 * len(matched_required) / len(required) + 20 * len(matched_preferred) / len(preferred)
    elif required:
        skill_score = 100 * len(matched_required) / len(required)
    elif preferred:
        skill_score = 100 * len(matched_preferred) / len(preferred)
    else:
        skill_score = 0.0

    minimum = max(0.0, float(job.minimum_experience_years or 0.0))
    years = max(0.0, float(candidate.experience_years or 0.0))
    experience_score = 100.0 if minimum == 0 else min(100.0, years / minimum * 100.0)
    no_criteria = not required and not preferred and minimum == 0
    if no_criteria:
        experience_score = 0.0
        score = 0.0
    else:
        score = round(job.skill_weight * skill_score + job.experience_weight * experience_score, 2)

    evidence = {
        skill: candidate.evidence.get(skill, "Candidate-listed skill; supporting evidence needs review.")
        for skill in matched_required + matched_preferred
    }
    if no_criteria:
        explanation = "Insufficient job criteria to calculate a meaningful match. Add required/preferred skills or a minimum experience requirement."
    elif missing_required:
        explanation = (
            f"{score}/100 preliminary match for {job.role_title}. "
            f"Listed evidence matches {len(matched_required)}/{len(required)} required skills. "
            f"Skills to verify: {', '.join(missing_required)}. This is not a hiring decision."
        )
    else:
        explanation = (
            f"{score}/100 preliminary match for {job.role_title}. Listed required skills are present; "
            "verify evidence and interview performance before making a decision."
        )
    return MatchResult(
        candidate_id=candidate.candidate_id, role_title=job.role_title, score=score,
        matched_required_skills=matched_required, missing_required_skills=missing_required,
        matched_preferred_skills=matched_preferred, experience_score=round(experience_score, 2),
        evidence=evidence, explanation=explanation, review_required=True,
    )
