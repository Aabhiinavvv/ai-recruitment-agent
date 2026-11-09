from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


JobStatus = Literal["not_started", "draft", "approved"]
RecruiterDecision = Literal["pending", "advance", "not_proceeding", "hire_approved"]
CommunicationStatus = Literal[
    "not_started", "drafted", "approved", "external_delivery_recorded", "responded"
]
InterviewStatus = Literal["not_started", "scheduled", "completed", "needs_review"]
VerificationStatus = Literal[
    "not_started", "in_progress", "completed", "discrepancy", "unable_to_verify"
]
OfferStatus = Literal[
    "not_started", "draft", "approved", "sent", "accepted", "declined", "withdrawn"
]
OnboardingStatus = Literal["not_started", "in_progress", "completed"]
TaskStatus = Literal[
    "completed",
    "ready",
    "blocked",
    "needs_human_review",
    "waiting_external_action",
    "not_applicable",
]


class CandidateOrchestrationState(BaseModel):
    """Pseudonymous workflow facts; no candidate identity or resume content is accepted."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    candidate_ref: str = Field(pattern=r"^candidate-[A-Za-z0-9_-]{1,32}$", max_length=42)
    profile_ready: bool = False
    matching_reviewed: bool = False
    recruiter_decision: RecruiterDecision = "pending"

    communication_consent_confirmed: bool = False
    communication_status: CommunicationStatus = "not_started"

    interview_consent_confirmed: bool = False
    interview_status: InterviewStatus = "not_started"

    verification_consent_confirmed: bool = False
    verification_status: VerificationStatus = "not_started"

    offer_status: OfferStatus = "not_started"
    onboarding_status: OnboardingStatus = "not_started"

    @model_validator(mode="after")
    def validate_state_dependencies(self):
        if self.interview_status != "not_started" and not self.matching_reviewed:
            raise ValueError("Interview status requires recruiter-reviewed matching evidence.")
        if self.verification_status != "not_started" and self.interview_status != "completed":
            raise ValueError("Verification status requires a completed and reviewed interview.")
        if self.offer_status in {"draft", "approved", "sent", "accepted"} and self.recruiter_decision != "hire_approved":
            raise ValueError("An offer state requires a recruiter-approved hire decision.")
        if self.offer_status in {"draft", "approved", "sent", "accepted"} and self.interview_status != "completed":
            raise ValueError("An offer state requires a completed and reviewed interview.")
        if self.offer_status in {"draft", "approved", "sent", "accepted"} and self.verification_status != "completed":
            raise ValueError("An offer state requires completed background verification.")
        if self.onboarding_status != "not_started" and self.offer_status != "accepted":
            raise ValueError("Onboarding can only progress after an accepted offer.")
        if self.verification_status != "not_started" and not self.verification_consent_confirmed:
            raise ValueError("Verification status requires candidate verification consent.")
        if self.interview_status != "not_started" and not self.interview_consent_confirmed:
            raise ValueError("Interview status requires candidate interview consent.")
        if self.communication_status != "not_started" and not self.communication_consent_confirmed:
            raise ValueError("Communication status requires candidate communication consent.")
        return self


class OrchestrationPlanRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    role_ref: str = Field(pattern=r"^role-[A-Za-z0-9_-]{1,32}$", max_length=38)
    job_status: JobStatus
    candidate_count_in_pipeline: int = Field(ge=0, le=100000)
    candidate: CandidateOrchestrationState | None = None

    analytics_snapshot_generated: bool = False
    workforce_history_months_available: int = Field(default=0, ge=0, le=36)
    workforce_assumptions_confirmed: bool = False
    workforce_forecast_generated: bool = False

    @model_validator(mode="after")
    def validate_candidate_count(self):
        if self.candidate is not None and self.candidate_count_in_pipeline < 1:
            raise ValueError("Candidate count must be at least one when a candidate workflow is supplied.")
        return self


class OrchestrationTask(BaseModel):
    agent_number: int = Field(ge=1, le=9)
    agent_name: str
    scope_ref: str
    status: TaskStatus
    recommended_action: str
    blockers: list[str] = Field(default_factory=list)
    dependencies: list[int] = Field(default_factory=list)
    requires_human_approval: bool = True


class OrchestrationCounts(BaseModel):
    total: int
    completed: int
    ready: int
    blocked: int
    needs_human_review: int
    waiting_external_action: int
    not_applicable: int


class OrchestrationPlanResponse(BaseModel):
    orchestration_id: str
    role_ref: str
    candidate_ref: str | None = None
    tasks: list[OrchestrationTask]
    next_actions: list[OrchestrationTask]
    counts: OrchestrationCounts
    completion_percent: float = Field(ge=0, le=100)
    orchestration_mode: Literal["dependency_aware_plan_only"] = "dependency_aware_plan_only"
    agent_dispatch_enabled: Literal[False] = False
    communication_dispatch_enabled: Literal[False] = False
    provider_execution_enabled: Literal[False] = False
    persistence_enabled: Literal[False] = False
    autonomous_hiring_decisions_enabled: Literal[False] = False
    warnings: list[str] = Field(default_factory=list)
    note: str = (
        "This planner evaluates the supplied workflow snapshot and returns ordered handoffs. "
        "It does not invoke other agents, dispatch messages, contact providers, persist state or decide whom to hire."
    )
