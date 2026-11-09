from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


VerificationType = Literal[
    "identity",
    "employment",
    "education",
    "address",
    "professional_license",
    "reference",
]
VerificationOutcome = Literal[
    "verified",
    "unable_to_verify",
    "discrepancy",
    "not_applicable",
]
EvidenceSourceType = Literal[
    "candidate_document",
    "issuer_confirmation",
    "licensed_provider_report",
    "reference_confirmation",
    "other",
]


class VerificationCaseRequest(BaseModel):
    """Create a check plan; no identity documents or identifier values are accepted."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    candidate_id: str = Field(min_length=1, max_length=100)
    job_title: str = Field(min_length=2, max_length=160)
    recruiter_approved: bool
    recruiter_decision: Literal["advance", "hold", "reject"]
    candidate_consent_confirmed: bool
    check_types: list[VerificationType] = Field(min_length=1, max_length=6)
    jurisdiction: str = Field(default="unspecified", min_length=2, max_length=80)

    @field_validator("check_types")
    @classmethod
    def check_types_must_be_unique(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("Each verification check type can only be selected once.")
        return value

    @model_validator(mode="after")
    def validate_authorisation(self):
        if not self.recruiter_approved:
            raise ValueError("The job must be recruiter-approved before verification.")
        if self.recruiter_decision != "advance":
            raise ValueError("Only candidates explicitly advanced by a recruiter can enter verification.")
        if not self.candidate_consent_confirmed:
            raise ValueError("Candidate consent is required before initiating verification.")
        return self


class VerificationCheck(BaseModel):
    check_id: str
    check_type: VerificationType
    title: str
    purpose: str
    evidence_to_review: list[str]
    status: Literal["awaiting_authorized_review"] = "awaiting_authorized_review"
    execution_mode: Literal["manual_or_future_authorized_provider"] = "manual_or_future_authorized_provider"


class VerificationCaseResponse(BaseModel):
    case_id: str
    candidate_id: str
    job_title: str
    jurisdiction: str
    checks: list[VerificationCheck]
    case_status: Literal["review_required"] = "review_required"
    requires_recruiter_review: Literal[True] = True
    provider_execution_enabled: Literal[False] = False
    persistence_enabled: Literal[False] = False
    final_hiring_decision_enabled: Literal[False] = False
    notice: str = (
        "Checklist only. No provider, employer, institution, government database or referee was contacted. "
        "No identity documents or personal identifier values were uploaded or stored by this API."
    )


class VerificationReviewRequest(BaseModel):
    """Record a reviewer attestation using opaque evidence metadata only."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    case_id: str = Field(min_length=8, max_length=80)
    candidate_id: str = Field(min_length=1, max_length=100)
    check_id: str = Field(min_length=10, max_length=100)
    check_type: VerificationType
    outcome: VerificationOutcome
    reviewer_attested: bool
    source_checked: bool = False
    evidence_source_type: EvidenceSourceType | None = None
    evidence_reference: str | None = Field(default=None, min_length=3, max_length=120)
    evidence_summary: str | None = Field(default=None, max_length=600)
    reviewer_note: str = Field(default="", max_length=500)

    @field_validator("evidence_reference")
    @classmethod
    def validate_opaque_reference(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not re.fullmatch(r"vault:[A-Za-z0-9._:-]{3,114}", value):
            raise ValueError(
                "Evidence reference must use vault:<internal-reference> format, not a URL, document number or raw identifier."
            )
        return value

    @field_validator("evidence_summary", "reviewer_note")
    @classmethod
    def reject_raw_personal_identifiers(cls, value: str | None) -> str | None:
        if value is None:
            return None
        forbidden_terms = re.compile(
            r"\b(?:aadhaar|aadhar|passport\s*(?:number|no\.?|#)|pan\s*(?:number|no\.?|#)|"
            r"social security|ssn|date of birth|dob|bank account|account number|"
            r"phone number|email address)\b",
            re.IGNORECASE,
        )
        if forbidden_terms.search(value) or re.search(r"\d{5,}", value):
            raise ValueError(
                "Do not enter document numbers, contact details, dates of birth or other raw personal identifiers. Use an opaque evidence reference."
            )
        return value

    @model_validator(mode="after")
    def validate_reviewer_attestation(self):
        if not self.reviewer_attested:
            raise ValueError("A human reviewer must attest to this verification update.")
        if self.outcome in {"verified", "discrepancy"}:
            if not self.source_checked:
                raise ValueError("A source must be checked before recording this outcome.")
            if not self.evidence_source_type or not self.evidence_reference:
                raise ValueError("Verified or discrepancy outcomes require evidence source metadata and an opaque reference.")
        if self.outcome == "unable_to_verify" and not self.reviewer_note.strip():
            raise ValueError("Record a brief, non-sensitive explanation when a check cannot be verified.")
        return self


class VerificationReviewResponse(BaseModel):
    case_id: str
    candidate_id: str
    check_id: str
    check_type: VerificationType
    outcome: VerificationOutcome
    evidence_source_type: EvidenceSourceType | None = None
    evidence_reference: str | None = None
    evidence_summary: str | None = None
    reviewer_note: str
    reviewed_at: str
    review_state: Literal["returned_to_client_for_recruiter_review"] = "returned_to_client_for_recruiter_review"
    requires_recruiter_review: Literal[True] = True
    persisted: Literal[False] = False
    hiring_decision_enabled: Literal[False] = False
    notice: str = (
        "This is a stateless review result. Persist it only in an authorised, access-controlled system with retention and audit controls."
    )
