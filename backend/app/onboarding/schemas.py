from __future__ import annotations

import re
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


EmploymentType = Literal["full_time", "part_time", "contract", "internship", "temporary"]
PayFrequency = Literal["annual", "monthly", "hourly"]
WorkMode = Literal["onsite", "hybrid", "remote"]
OfferStatus = Literal[
    "draft_pending_approval",
    "approved_not_sent",
    "sent_outside_platform",
    "accepted",
    "declined",
    "withdrawn",
    "expired",
]
OfferEvent = Literal[
    "approve",
    "mark_sent",
    "record_acceptance",
    "record_decline",
    "withdraw",
    "mark_expired",
]
OnboardingTaskStatus = Literal["pending", "in_progress", "completed", "blocked"]


class OfferDraftRequest(BaseModel):
    """Offer terms are supplied by a recruiter; no compensation or benefits are invented."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    candidate_id: str = Field(min_length=1, max_length=100)
    job_title: str = Field(min_length=2, max_length=160)
    company_name: str = Field(min_length=2, max_length=160)
    recruiter_hire_approved: bool
    hire_approval_reference: str = Field(pattern=r"^vault:[A-Za-z0-9._:-]{3,114}$")
    verification_review_completed: bool
    verification_review_reference: str = Field(pattern=r"^vault:[A-Za-z0-9._:-]{3,114}$")
    unresolved_verification_items: int = Field(default=0, ge=0, le=100)
    employment_type: EmploymentType
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    compensation_amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    pay_frequency: PayFrequency
    work_mode: WorkMode
    work_location_label: str = Field(min_length=2, max_length=100)
    start_date: date
    offer_expiry_date: date
    probation_months: int | None = Field(default=None, ge=0, le=36)
    benefits: list[str] = Field(default_factory=list, max_length=12)
    additional_terms: list[str] = Field(default_factory=list, max_length=12)

    @field_validator("benefits", "additional_terms")
    @classmethod
    def clean_supplied_terms(cls, values: list[str]) -> list[str]:
        cleaned = [item.strip() for item in values if item and item.strip()]
        if any(len(item) > 240 for item in cleaned):
            raise ValueError("Each supplied offer term must be 240 characters or fewer.")
        return cleaned

    @model_validator(mode="after")
    def validate_approval_and_dates(self):
        if not self.recruiter_hire_approved:
            raise ValueError("A recruiter must explicitly approve the hire before preparing an offer.")
        if not self.verification_review_completed:
            raise ValueError("Background verification must be reviewed before preparing an offer.")
        if self.unresolved_verification_items:
            raise ValueError("Resolve or explicitly disposition all outstanding verification items before preparing an offer.")
        if self.offer_expiry_date < date.today():
            raise ValueError("Offer expiry date cannot be in the past.")
        if self.start_date <= self.offer_expiry_date:
            raise ValueError("Employment start date must be after the offer expiry date.")
        return self


class OfferDraftResponse(BaseModel):
    offer_id: str
    candidate_id: str
    job_title: str
    company_name: str
    hire_approval_reference: str
    verification_review_reference: str
    employment_type: EmploymentType
    currency: str
    compensation_amount: Decimal
    pay_frequency: PayFrequency
    work_mode: WorkMode
    work_location_label: str
    start_date: date
    offer_expiry_date: date
    probation_months: int | None = None
    benefits: list[str]
    additional_terms: list[str]
    draft_text: str
    status: OfferStatus = "draft_pending_approval"
    requires_recruiter_approval: Literal[True] = True
    offer_dispatch_enabled: Literal[False] = False
    signature_enabled: Literal[False] = False
    persistence_enabled: Literal[False] = False
    legally_binding: Literal[False] = False
    notice: str = (
        "Draft only, based solely on recruiter-supplied terms. It is not legal advice, "
        "a signed agreement, or a binding offer. No message was sent."
    )


class OfferEventRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    offer_id: str = Field(min_length=8, max_length=80)
    candidate_id: str = Field(min_length=1, max_length=100)
    current_status: OfferStatus
    event: OfferEvent
    recruiter_attested: bool
    candidate_response_confirmed: bool = False
    event_reference: str | None = Field(default=None, min_length=3, max_length=120)
    offer_expiry_date: date
    reviewer_note: str = Field(default="", max_length=400)

    @field_validator("event_reference")
    @classmethod
    def validate_event_reference(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not re.fullmatch(r"vault:[A-Za-z0-9._:-]{3,114}", value):
            raise ValueError("Use an opaque vault:<internal-reference> event reference; do not enter URLs or raw personal identifiers.")
        return value

    @field_validator("reviewer_note")
    @classmethod
    def reject_raw_identifiers(cls, value: str) -> str:
        if re.search(r"\b(?:aadhaar|aadhar|passport|pan number|date of birth|dob|bank account|phone number|email address)\b", value, re.I) or re.search(r"\d{5,}", value):
            raise ValueError("Do not enter personal identifiers or contact details in offer event notes.")
        return value

    @model_validator(mode="after")
    def validate_event_requirements(self):
        if not self.recruiter_attested:
            raise ValueError("A recruiter attestation is required for offer status events.")
        if self.event in {"record_acceptance", "record_decline"}:
            if not self.candidate_response_confirmed or not self.event_reference:
                raise ValueError("Candidate response events require confirmation and an opaque evidence reference.")
        if self.event == "mark_sent" and not self.event_reference:
            raise ValueError("Record a secure internal reference for the manually sent offer.")
        if self.event in {"approve", "mark_sent"} and date.today() > self.offer_expiry_date:
            raise ValueError("An expired offer cannot be approved or marked as sent.")
        if self.event in {"record_acceptance", "record_decline"} and date.today() > self.offer_expiry_date:
            raise ValueError("Candidate responses cannot be recorded after the offer expiry date.")
        if self.event == "mark_expired" and date.today() <= self.offer_expiry_date:
            raise ValueError("An offer can only be marked expired after its expiry date.")
        return self


class OfferEventResponse(BaseModel):
    offer_id: str
    candidate_id: str
    previous_status: OfferStatus
    current_status: OfferStatus
    event: OfferEvent
    event_reference: str | None = None
    reviewer_note: str
    status_recorded: Literal["returned_to_client_for_recruiter_review"] = "returned_to_client_for_recruiter_review"
    recruiter_attested: Literal[True] = True
    persisted: Literal[False] = False
    dispatch_performed: Literal[False] = False
    signature_performed: Literal[False] = False
    hiring_decision_enabled: Literal[False] = False


class OnboardingPlanRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    offer_id: str = Field(min_length=8, max_length=80)
    candidate_id: str = Field(min_length=1, max_length=100)
    job_title: str = Field(min_length=2, max_length=160)
    employment_type: EmploymentType
    offer_status: Literal["accepted"]
    recruiter_start_approved: bool
    start_date: date

    @model_validator(mode="after")
    def validate_acceptance(self):
        if not self.recruiter_start_approved:
            raise ValueError("Recruiter approval is required to start onboarding.")
        if self.start_date < date.today():
            raise ValueError("Onboarding start date cannot be in the past.")
        return self


class OnboardingTask(BaseModel):
    task_id: str
    title: str
    description: str
    owner: Literal["hr", "manager", "it", "candidate", "recruiter"]
    status: OnboardingTaskStatus = "pending"
    evidence_required: bool = False


class OnboardingPlanResponse(BaseModel):
    plan_id: str
    offer_id: str
    candidate_id: str
    job_title: str
    employment_type: EmploymentType
    start_date: date
    tasks: list[OnboardingTask]
    status: Literal["onboarding_plan_created"] = "onboarding_plan_created"
    requires_human_oversight: Literal[True] = True
    external_account_creation_enabled: Literal[False] = False
    document_collection_enabled: Literal[False] = False
    persistence_enabled: Literal[False] = False
    notice: str = (
        "Checklist only. No documents, payroll data, bank details, tax IDs, accounts or equipment orders were collected or created."
    )


class OnboardingTaskEventRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    plan_id: str = Field(min_length=8, max_length=80)
    offer_id: str = Field(min_length=8, max_length=80)
    candidate_id: str = Field(min_length=1, max_length=100)
    task_id: str = Field(min_length=8, max_length=100)
    current_status: OnboardingTaskStatus
    target_status: OnboardingTaskStatus
    reviewer_attested: bool
    reviewer_note: str = Field(default="", max_length=400)

    @field_validator("reviewer_note")
    @classmethod
    def reject_sensitive_notes(cls, value: str) -> str:
        if re.search(r"\b(?:aadhaar|aadhar|passport|pan number|date of birth|dob|bank account|phone number|email address)\b", value, re.I) or re.search(r"\d{5,}", value):
            raise ValueError("Do not include personal identifiers or contact details in onboarding notes.")
        return value

    @model_validator(mode="after")
    def validate_transition(self):
        if not self.reviewer_attested:
            raise ValueError("A human reviewer must attest to onboarding task updates.")
        allowed = {
            "pending": {"in_progress", "blocked", "completed"},
            "in_progress": {"blocked", "completed"},
            "blocked": {"in_progress"},
            "completed": set(),
        }
        if self.target_status not in allowed[self.current_status]:
            raise ValueError("This onboarding task status transition is not allowed.")
        if self.target_status == "blocked" and not self.reviewer_note.strip():
            raise ValueError("Provide a non-sensitive reason when blocking an onboarding task.")
        return self


class OnboardingTaskEventResponse(BaseModel):
    plan_id: str
    offer_id: str
    candidate_id: str
    task_id: str
    previous_status: OnboardingTaskStatus
    current_status: OnboardingTaskStatus
    reviewer_note: str
    status_recorded: Literal["returned_to_client_for_recruiter_review"] = "returned_to_client_for_recruiter_review"
    reviewer_attested: Literal[True] = True
    persisted: Literal[False] = False
