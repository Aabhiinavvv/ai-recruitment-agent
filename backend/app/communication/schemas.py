from __future__ import annotations

import re
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


CommunicationType = Literal[
    "application_acknowledgement",
    "interview_invitation",
    "scheduling_request",
    "schedule_confirmation",
    "status_update",
    "not_selected",
    "follow_up",
]
RecruiterDecision = Literal["pending_review", "advanced", "not_proceeding"]


class CommunicationDraftRequest(BaseModel):
    """A controlled request for a draft; it never triggers message delivery."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    communication_type: CommunicationType
    candidate_id: str = Field(min_length=1, max_length=100)
    candidate_name: str = Field(min_length=1, max_length=160)
    recipient_email: str = Field(min_length=5, max_length=254)
    job_title: str = Field(min_length=2, max_length=160)
    company_name: str = Field(default="the recruitment team", max_length=160)
    recruiter_decision: RecruiterDecision = "pending_review"
    contact_authorized: bool
    recruiter_context: str = Field(default="", max_length=1200)
    interview_round: str = Field(default="interview", max_length=120)
    interview_date: str | None = Field(default=None, max_length=10)
    interview_time: str | None = Field(default=None, max_length=5)
    timezone: str = Field(default="local time", max_length=80)
    interview_format: str = Field(default="video interview", max_length=80)
    meeting_url: str | None = Field(default=None, max_length=500)

    @field_validator("recipient_email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("A valid candidate email address is required.")
        return value

    @field_validator("candidate_name", "job_title", "company_name")
    @classmethod
    def reject_control_characters(cls, value: str) -> str:
        if any(ord(char) < 32 for char in value):
            raise ValueError("Text fields cannot contain control characters.")
        return value

    @field_validator("interview_date")
    @classmethod
    def validate_date_shape(cls, value: str | None) -> str | None:
        if value is not None:
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                raise ValueError("interview_date must use YYYY-MM-DD.")
            from datetime import date
            try:
                date.fromisoformat(value)
            except ValueError as exc:
                raise ValueError("interview_date is not a valid calendar date.") from exc
        return value

    @field_validator("interview_time")
    @classmethod
    def validate_time_shape(cls, value: str | None) -> str | None:
        if value is not None and not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value):
            raise ValueError("interview_time must use 24-hour HH:MM.")
        return value

    @field_validator("meeting_url")
    @classmethod
    def validate_meeting_url(cls, value: str | None) -> str | None:
        if value:
            parsed = urlparse(value)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                raise ValueError("meeting_url must be a valid HTTPS or HTTP URL.")
        return value

    @model_validator(mode="after")
    def validate_decision_and_consent(self):
        if not self.contact_authorized:
            raise ValueError("Candidate contact authorisation must be confirmed before drafting.")
        positive_communications = {
            "interview_invitation", "scheduling_request", "schedule_confirmation"
        }
        if self.communication_type in positive_communications and self.recruiter_decision != "advanced":
            raise ValueError(
                "Interview communications require an explicit recruiter decision to advance the candidate."
            )
        if self.communication_type == "not_selected" and self.recruiter_decision != "not_proceeding":
            raise ValueError(
                "A not-selected draft requires an explicit recruiter non-progression decision."
            )
        if self.communication_type == "schedule_confirmation":
            if not self.interview_date or not self.interview_time:
                raise ValueError("Schedule confirmation requires an interview date and time.")
        return self


class CommunicationDraftResponse(BaseModel):
    draft_id: str
    communication_type: CommunicationType
    candidate_id: str
    recipient_email: str
    subject: str
    body: str
    call_script: str
    warnings: list[str] = Field(default_factory=list)
    status: Literal["draft_pending_recruiter_review"] = "draft_pending_recruiter_review"
    requires_recruiter_approval: Literal[True] = True
    delivery_enabled: Literal[False] = False
    delivery_note: str = (
        "Draft only. No email, SMS, WhatsApp message, calendar invitation or phone call has been sent."
    )
