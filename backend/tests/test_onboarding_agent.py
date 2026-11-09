from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.onboarding.schemas import (
    OfferDraftRequest,
    OfferEventRequest,
    OnboardingPlanRequest,
    OnboardingTaskEventRequest,
)
from app.onboarding.service import (
    create_offer_draft,
    create_onboarding_plan,
    record_offer_event,
    record_onboarding_task_event,
)


client = TestClient(app)


def _offer_request(**overrides):
    today = date.today()
    values = {
        "candidate_id": "CAND-301",
        "job_title": "Data Engineer",
        "company_name": "Example Systems",
        "recruiter_hire_approved": True,
        "hire_approval_reference": "vault:hire:approval001",
        "verification_review_completed": True,
        "verification_review_reference": "vault:bgc:review001",
        "unresolved_verification_items": 0,
        "employment_type": "full_time",
        "currency": "INR",
        "compensation_amount": "1200000.00",
        "pay_frequency": "annual",
        "work_mode": "hybrid",
        "work_location_label": "Noida, India",
        "start_date": today + timedelta(days=45),
        "offer_expiry_date": today + timedelta(days=20),
        "probation_months": 3,
        "benefits": ["Health cover as supplied by HR"],
        "additional_terms": ["Subject to final legal and HR review"],
    }
    values.update(overrides)
    return OfferDraftRequest(**values)


def test_offer_draft_uses_only_supplied_terms():
    result = create_offer_draft(_offer_request())
    assert "INR 1200000.00 (annual)" in result.draft_text
    assert "Health cover as supplied by HR" in result.draft_text
    assert result.legally_binding is False
    assert result.hire_approval_reference == "vault:hire:approval001"
    assert result.verification_review_reference == "vault:bgc:review001"
    assert result.offer_dispatch_enabled is False
    assert result.signature_enabled is False
    assert result.persistence_enabled is False
    assert result.status == "draft_pending_approval"


def test_offer_requires_recruiter_hire_approval():
    with pytest.raises(ValidationError, match="explicitly approve the hire"):
        _offer_request(recruiter_hire_approved=False)


def test_offer_requires_opaque_hire_and_verification_references():
    with pytest.raises(ValidationError):
        _offer_request(hire_approval_reference="approval-record-123")
    with pytest.raises(ValidationError):
        _offer_request(verification_review_reference="https://example.com/report")


def test_offer_requires_verification_review_and_no_open_items():
    with pytest.raises(ValidationError, match="verification must be reviewed"):
        _offer_request(verification_review_completed=False)
    with pytest.raises(ValidationError, match="outstanding verification items"):
        _offer_request(unresolved_verification_items=1)


def test_offer_rejects_invalid_currency_and_expiry_dates():
    with pytest.raises(ValidationError):
        _offer_request(currency="rupees")
    with pytest.raises(ValidationError, match="start date must be after"):
        _offer_request(start_date=date.today() + timedelta(days=10),
                       offer_expiry_date=date.today() + timedelta(days=20))


def test_offer_approval_and_manual_dispatch_are_separate_events():
    draft = create_offer_draft(_offer_request())
    approved = record_offer_event(OfferEventRequest(
        offer_id=draft.offer_id, candidate_id=draft.candidate_id,
        current_status="draft_pending_approval", event="approve",
        recruiter_attested=True, offer_expiry_date=draft.offer_expiry_date,
    ))
    assert approved.current_status == "approved_not_sent"
    sent = record_offer_event(OfferEventRequest(
        offer_id=draft.offer_id, candidate_id=draft.candidate_id,
        current_status="approved_not_sent", event="mark_sent",
        recruiter_attested=True, event_reference="vault:offer:sent001",
        offer_expiry_date=draft.offer_expiry_date,
    ))
    assert sent.current_status == "sent_outside_platform"
    assert sent.dispatch_performed is False
    assert sent.persisted is False


def test_offer_expiry_cannot_be_marked_before_expiry_date():
    draft = create_offer_draft(_offer_request())
    with pytest.raises(ValidationError, match="only be marked expired after"):
        OfferEventRequest(
            offer_id=draft.offer_id, candidate_id=draft.candidate_id,
            current_status="sent_outside_platform", event="mark_expired",
            recruiter_attested=True, offer_expiry_date=draft.offer_expiry_date,
        )


def test_offer_acceptance_requires_candidate_response_reference():
    draft = create_offer_draft(_offer_request())
    with pytest.raises(ValidationError, match="Candidate response events"):
        OfferEventRequest(
            offer_id=draft.offer_id, candidate_id=draft.candidate_id,
            current_status="sent_outside_platform", event="record_acceptance",
            recruiter_attested=True, candidate_response_confirmed=False,
            offer_expiry_date=draft.offer_expiry_date,
        )


def test_offer_transition_rejects_acceptance_before_manual_send():
    draft = create_offer_draft(_offer_request())
    with pytest.raises(ValueError, match="not allowed"):
        record_offer_event(OfferEventRequest(
            offer_id=draft.offer_id, candidate_id=draft.candidate_id,
            current_status="approved_not_sent", event="record_acceptance",
            recruiter_attested=True, candidate_response_confirmed=True,
            event_reference="vault:reply:abc123",
            offer_expiry_date=draft.offer_expiry_date,
        ))


def test_offer_rejects_raw_personal_data_in_event_note():
    with pytest.raises(ValidationError, match="personal identifiers"):
        OfferEventRequest(
            offer_id="OFR-12345678", candidate_id="CAND-1",
            current_status="sent_outside_platform", event="record_acceptance",
            recruiter_attested=True, candidate_response_confirmed=True,
            event_reference="vault:reply:abc123",
            offer_expiry_date=date.today() + timedelta(days=5),
            reviewer_note="Passport 123456789",
        )


def test_onboarding_plan_requires_accepted_offer_and_recruiter_approval():
    with pytest.raises(ValidationError):
        OnboardingPlanRequest(
            offer_id="OFR-12345678", candidate_id="CAND-301",
            job_title="Data Engineer", employment_type="full_time",
            offer_status="sent_outside_platform", recruiter_start_approved=True,
            start_date=date.today() + timedelta(days=30),
        )
    with pytest.raises(ValidationError, match="Recruiter approval"):
        OnboardingPlanRequest(
            offer_id="OFR-12345678", candidate_id="CAND-301",
            job_title="Data Engineer", employment_type="full_time",
            offer_status="accepted", recruiter_start_approved=False,
            start_date=date.today() + timedelta(days=30),
        )


def test_onboarding_plan_generates_generic_tasks_without_collecting_documents():
    request = OnboardingPlanRequest(
        offer_id="OFR-12345678", candidate_id="CAND-301",
        job_title="Data Engineer", employment_type="full_time",
        offer_status="accepted", recruiter_start_approved=True,
        start_date=date.today() + timedelta(days=30),
    )
    result = create_onboarding_plan(request)
    assert len(result.tasks) >= 5
    assert result.persistence_enabled is False
    assert result.document_collection_enabled is False
    assert result.external_account_creation_enabled is False


def test_onboarding_task_updates_require_attestation_and_valid_transition():
    plan = create_onboarding_plan(OnboardingPlanRequest(
        offer_id="OFR-12345678", candidate_id="CAND-301",
        job_title="Data Engineer", employment_type="full_time",
        offer_status="accepted", recruiter_start_approved=True,
        start_date=date.today() + timedelta(days=30),
    ))
    task = plan.tasks[0]
    with pytest.raises(ValidationError, match="human reviewer must attest"):
        OnboardingTaskEventRequest(
            plan_id=plan.plan_id, offer_id=plan.offer_id, candidate_id=plan.candidate_id,
            task_id=task.task_id, current_status="pending", target_status="in_progress",
            reviewer_attested=False,
        )
    with pytest.raises(ValidationError, match="status transition is not allowed"):
        OnboardingTaskEventRequest(
            plan_id=plan.plan_id, offer_id=plan.offer_id, candidate_id=plan.candidate_id,
            task_id=task.task_id, current_status="completed", target_status="pending",
            reviewer_attested=True,
        )


def test_blocked_task_requires_note_and_completed_state_does_not_reopen():
    plan = create_onboarding_plan(OnboardingPlanRequest(
        offer_id="OFR-12345678", candidate_id="CAND-301",
        job_title="Data Engineer", employment_type="full_time",
        offer_status="accepted", recruiter_start_approved=True,
        start_date=date.today() + timedelta(days=30),
    ))
    task = plan.tasks[0]
    with pytest.raises(ValidationError, match="reason when blocking"):
        OnboardingTaskEventRequest(
            plan_id=plan.plan_id, offer_id=plan.offer_id, candidate_id=plan.candidate_id,
            task_id=task.task_id, current_status="pending", target_status="blocked",
            reviewer_attested=True,
        )
    with pytest.raises(ValidationError, match="status transition is not allowed"):
        OnboardingTaskEventRequest(
            plan_id=plan.plan_id, offer_id=plan.offer_id, candidate_id=plan.candidate_id,
            task_id=task.task_id, current_status="completed", target_status="in_progress",
            reviewer_attested=True,
        )


def test_onboarding_task_id_must_belong_to_plan():
    plan = create_onboarding_plan(OnboardingPlanRequest(
        offer_id="OFR-12345678", candidate_id="CAND-301",
        job_title="Data Engineer", employment_type="full_time",
        offer_status="accepted", recruiter_start_approved=True,
        start_date=date.today() + timedelta(days=30),
    ))
    with pytest.raises(ValueError, match="does not belong"):
        record_onboarding_task_event(OnboardingTaskEventRequest(
            plan_id=plan.plan_id, offer_id=plan.offer_id, candidate_id=plan.candidate_id,
            task_id="ONB-OTHER-EMPLOYMENT", current_status="pending",
            target_status="in_progress", reviewer_attested=True,
        ))


def test_api_endpoints_for_offer_and_onboarding():
    offer_response = client.post("/api/v1/onboarding/offers/drafts", json=_offer_request().model_dump(mode="json"))
    assert offer_response.status_code == 200
    offer = offer_response.json()

    plan_response = client.post("/api/v1/onboarding/plans", json={
        "offer_id": offer["offer_id"],
        "candidate_id": offer["candidate_id"],
        "job_title": offer["job_title"],
        "employment_type": offer["employment_type"],
        "offer_status": "accepted",
        "recruiter_start_approved": True,
        "start_date": (date.today() + timedelta(days=30)).isoformat(),
    })
    assert plan_response.status_code == 200
    assert plan_response.json()["persistence_enabled"] is False


def test_health_lists_offer_onboarding_agent():
    response = client.get("/health")
    assert response.status_code == 200
    assert "offer-onboarding" in response.json()["agents"]
