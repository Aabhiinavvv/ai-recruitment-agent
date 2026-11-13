import pytest
from pydantic import ValidationError

from app.communication.agent import build_communication_draft
from app.communication.schemas import CommunicationDraftRequest


def _request(**overrides):
    values = {

        "communication_type": "application_acknowledgement",
        "candidate_id": "CAND-001",
        "candidate_name": "Jordan Lee",
        "recipient_email": "jordan@example.com",
        "job_title": "Data Analyst",
        "company_name": "Example Hiring Team",
        "contact_authorized": True,
    }
    values.update(overrides)
    return CommunicationDraftRequest(**values)


def test_application_acknowledgement_creates_recruiter_review_draft():
    result = build_communication_draft(_request())
    assert result.status == "draft_pending_recruiter_review"
    assert result.requires_recruiter_approval is True
    assert result.delivery_enabled is False
    assert "received your application" in result.body.lower()
    assert result.recipient_email == "jordan@example.com"


def test_interview_invitation_requires_recruiter_advance_decision():
    with pytest.raises(ValidationError, match="explicit recruiter decision"):
        _request(communication_type="interview_invitation")


def test_interview_invitation_generates_call_script_for_human_caller():
    result = build_communication_draft(_request(
        communication_type="interview_invitation",
        recruiter_decision="advanced",
        interview_round="Technical interview",
    ))
    assert result.call_script
    assert "Technical interview" in result.call_script
    assert result.delivery_enabled is False


def test_not_selected_requires_explicit_recruiter_decision():
    with pytest.raises(ValidationError, match="explicit recruiter non-progression"):
        _request(communication_type="not_selected")


def test_not_selected_uses_neutral_wording_and_does_not_include_score():
    result = build_communication_draft(_request(
        communication_type="not_selected",
        recruiter_decision="not_proceeding",
        recruiter_context="Candidate score was 42 and ranked last.",
    ))
    assert "will not be moving forward" in result.body
    assert "42" not in result.body
    assert result.warnings


def test_sensitive_recruiter_context_is_omitted():
    result = build_communication_draft(_request(
        communication_type="status_update",
        recruiter_context="Candidate disclosed a medical diagnosis.",
    ))
    assert "medical diagnosis" not in result.body
    assert result.warnings


def test_schedule_confirmation_requires_date_and_time():
    with pytest.raises(ValidationError, match="requires an interview date and time"):
        _request(
            communication_type="schedule_confirmation",
            recruiter_decision="advanced",
        )


def test_schedule_confirmation_contains_only_supplied_schedule_details():
    result = build_communication_draft(_request(
        communication_type="schedule_confirmation",
        recruiter_decision="advanced",
        interview_round="Technical Interview",
        interview_date="2026-12-01",
        interview_time="14:30",
        timezone="Asia/Kolkata",
        meeting_url="https://meet.example.com/abc",
    ))
    assert "2026-12-01" in result.body
    assert "14:30 (Asia/Kolkata)" in result.body
    assert "https://meet.example.com/abc" in result.body


def test_contact_authorization_is_mandatory():
    with pytest.raises(ValidationError, match="authorisation"):
        _request(contact_authorized=False)


def test_invalid_email_is_rejected():
    with pytest.raises(ValidationError, match="valid candidate email"):
        _request(recipient_email="not-an-email")



def test_follow_up_uses_safe_recruiter_context():
    result = build_communication_draft(_request(
        communication_type="follow_up",
        recruiter_context="The hiring team expects to share an update next week.",
    ))
    assert "expects to share an update next week" in result.body
