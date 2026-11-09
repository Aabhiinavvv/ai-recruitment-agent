import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.verification.schemas import VerificationCaseRequest, VerificationReviewRequest
from app.verification.service import create_verification_case, record_verification_review
from app.main import app


client = TestClient(app)


def _case_request(**overrides):
    values = {
        "candidate_id": "CAND-201",
        "job_title": "Backend Engineer",
        "recruiter_approved": True,
        "recruiter_decision": "advance",
        "candidate_consent_confirmed": True,
        "check_types": ["employment", "education"],
        "jurisdiction": "IN",
    }
    values.update(overrides)
    return VerificationCaseRequest(**values)


def _review_request(case, check, **overrides):
    values = {
        "case_id": case.case_id,
        "candidate_id": case.candidate_id,
        "check_id": check.check_id,
        "check_type": check.check_type,
        "outcome": "verified",
        "reviewer_attested": True,
        "source_checked": True,
        "evidence_source_type": "issuer_confirmation",
        "evidence_reference": "vault:report:abc123",
        "evidence_summary": "Issuer confirmed the qualification and award year.",
        "reviewer_note": "Reviewed against the approved role requirement.",
    }
    values.update(overrides)
    return VerificationReviewRequest(**values)


def test_case_builds_selected_checklist_only():
    result = create_verification_case(_case_request())
    assert len(result.checks) == 2
    assert {check.check_type for check in result.checks} == {"employment", "education"}
    assert result.provider_execution_enabled is False
    assert result.persistence_enabled is False
    assert result.final_hiring_decision_enabled is False
    assert all(check.status == "awaiting_authorized_review" for check in result.checks)


def test_case_requires_approved_job():
    with pytest.raises(ValidationError, match="job must be recruiter-approved"):
        _case_request(recruiter_approved=False)


def test_case_requires_candidate_advance():
    with pytest.raises(ValidationError, match="explicitly advanced"):
        _case_request(recruiter_decision="hold")


def test_case_requires_candidate_consent():
    with pytest.raises(ValidationError, match="Candidate consent"):
        _case_request(candidate_consent_confirmed=False)


def test_case_rejects_duplicate_check_types():
    with pytest.raises(ValidationError, match="only be selected once"):
        _case_request(check_types=["identity", "identity"])


def test_case_rejects_unapproved_or_unsupported_check_type():
    with pytest.raises(ValidationError):
        _case_request(check_types=["criminal_record"])


def test_review_requires_human_attestation():
    case = create_verification_case(_case_request())
    with pytest.raises(ValidationError, match="human reviewer must attest"):
        _review_request(case, case.checks[0], reviewer_attested=False)


def test_verified_result_requires_checked_source_and_evidence_reference():
    case = create_verification_case(_case_request())
    with pytest.raises(ValidationError, match="source must be checked"):
        _review_request(case, case.checks[0], source_checked=False)


def test_review_rejects_raw_document_or_personal_identifiers():
    with pytest.raises(ValidationError, match="raw personal identifiers"):
        _case_sensitive_review()


def _case_sensitive_review():
    case = create_verification_case(_case_request())
    return _review_request(
        case,
        case.checks[0],
        evidence_summary="Passport number 123456789 verified.",
    )


def test_review_returns_human_review_record_without_persisting():
    case = create_verification_case(_case_request())
    result = record_verification_review(_review_request(case, case.checks[0]))
    assert result.outcome == "verified"
    assert result.persisted is False
    assert result.hiring_decision_enabled is False
    assert result.requires_recruiter_review is True


def test_review_validates_case_and_check_type_relationship():
    case = create_verification_case(_case_request())
    with pytest.raises(ValueError, match="does not match"):
        record_verification_review(
            _review_request(case, case.checks[0], check_type="identity")
        )


def test_review_unable_to_verify_requires_note():
    case = create_verification_case(_case_request())
    with pytest.raises(ValidationError, match="brief, non-sensitive explanation"):
        _review_request(
            case,
            case.checks[0],
            outcome="unable_to_verify",
            source_checked=False,
            evidence_source_type=None,
            evidence_reference=None,
            evidence_summary=None,
            reviewer_note="   ",
        )


def test_case_endpoint_and_review_endpoint():
    payload = _case_request().model_dump()
    case_response = client.post("/api/v1/verification/cases", json=payload)
    assert case_response.status_code == 200
    case = case_response.json()
    check = case["checks"][0]

    review_payload = {
        "case_id": case["case_id"],
        "candidate_id": case["candidate_id"],
        "check_id": check["check_id"],
        "check_type": check["check_type"],
        "outcome": "verified",
        "reviewer_attested": True,
        "source_checked": True,
        "evidence_source_type": "issuer_confirmation",
        "evidence_reference": "vault:report:abc123",
        "evidence_summary": "Issuer confirmed the qualification.",
        "reviewer_note": "Reviewed for the role.",
    }
    review_response = client.post("/api/v1/verification/reviews", json=review_payload)
    assert review_response.status_code == 200
    assert review_response.json()["persisted"] is False


def test_health_lists_background_verification_agent():
    response = client.get("/health")
    assert response.status_code == 200
    assert "background-verification" in response.json()["agents"]
