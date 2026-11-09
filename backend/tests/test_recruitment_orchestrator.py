import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.orchestrator.schemas import OrchestrationPlanRequest
from app.orchestrator.service import build_orchestration_plan


client = TestClient(app)


def _request(**overrides):
    values = {
        "role_ref": "role-001",
        "job_status": "approved",
        "candidate_count_in_pipeline": 1,
        "candidate": {
            "candidate_ref": "candidate-001",
            "profile_ready": True,
            "matching_reviewed": False,
            "recruiter_decision": "advance",
            "communication_consent_confirmed": True,
            "communication_status": "drafted",
            "interview_consent_confirmed": True,
            "interview_status": "not_started",
            "verification_consent_confirmed": True,
            "verification_status": "not_started",
            "offer_status": "not_started",
            "onboarding_status": "not_started",
        },
        "analytics_snapshot_generated": False,
        "workforce_history_months_available": 6,
        "workforce_assumptions_confirmed": True,
        "workforce_forecast_generated": False,
    }
    values.update(overrides)
    return OrchestrationPlanRequest(**values)


def test_plan_contains_agents_one_to_nine_and_candidate_scope():
    result = build_orchestration_plan(_request())
    assert [task.agent_number for task in result.tasks] == list(range(1, 10))
    assert result.candidate_ref == "candidate-001"
    assert result.agent_dispatch_enabled is False
    assert result.persistence_enabled is False
    assert result.autonomous_hiring_decisions_enabled is False


def test_job_approval_blocks_candidate_processing_and_matching():
    result = build_orchestration_plan(_request(job_status="draft"))
    by_agent = {task.agent_number: task for task in result.tasks}
    assert by_agent[1].status == "ready"
    assert by_agent[2].status == "blocked"
    assert by_agent[3].status == "blocked"


def test_candidate_profile_blocks_matching_until_ready():
    state = _request().candidate.model_copy(update={"profile_ready": False})
    result = build_orchestration_plan(_request(candidate=state))
    by_agent = {task.agent_number: task for task in result.tasks}
    assert by_agent[2].status == "ready"
    assert by_agent[3].status == "blocked"


def test_matching_reviewed_is_completed():
    state = _request().candidate.model_copy(update={"matching_reviewed": True})
    result = build_orchestration_plan(_request(candidate=state))
    assert next(task for task in result.tasks if task.agent_number == 3).status == "completed"


def test_communication_requires_explicit_candidate_consent():
    state = _request().candidate.model_copy(update={
        "communication_consent_confirmed": False,
        "communication_status": "not_started",
    })
    result = build_orchestration_plan(_request(candidate=state))
    task = next(task for task in result.tasks if task.agent_number == 4)
    assert task.status == "blocked"
    assert task.blockers


def test_interview_requires_recruiter_advancement_and_consent():
    state = _request().candidate.model_copy(update={
        "recruiter_decision": "pending",
        "interview_consent_confirmed": False,
    })
    result = build_orchestration_plan(_request(candidate=state))
    task = next(task for task in result.tasks if task.agent_number == 5)
    assert task.status == "blocked"


def test_interview_waits_for_recruiter_matching_review():
    state = _request().candidate.model_copy(update={
        "matching_reviewed": False,
        "recruiter_decision": "advance",
        "interview_consent_confirmed": True,
    })
    result = build_orchestration_plan(_request(candidate=state))
    task = next(task for task in result.tasks if task.agent_number == 5)
    assert task.status == "blocked"
    assert "matching" in task.blockers[0].lower()


def test_verification_waits_for_completed_interview():
    state = _request().candidate.model_copy(update={
        "matching_reviewed": True,
        "recruiter_decision": "advance",
        "interview_consent_confirmed": True,
        "interview_status": "scheduled",
        "verification_consent_confirmed": True,
    })
    result = build_orchestration_plan(_request(candidate=state))
    task = next(task for task in result.tasks if task.agent_number == 6)
    assert task.status == "blocked"
    assert "interview" in task.blockers[0].lower()


def test_interview_status_is_waiting_for_human_interview_when_scheduled():
    state = _request().candidate.model_copy(update={
        "matching_reviewed": True,
        "interview_status": "scheduled",
    })
    result = build_orchestration_plan(_request(candidate=state))
    task = next(task for task in result.tasks if task.agent_number == 5)
    assert task.status == "waiting_external_action"


def test_verification_discrepancy_requires_human_review():
    state = _request().candidate.model_copy(update={
        "matching_reviewed": True,
        "interview_status": "completed",
        "verification_status": "discrepancy",
    })
    result = build_orchestration_plan(_request(candidate=state))
    by_agent = {task.agent_number: task for task in result.tasks}
    assert by_agent[6].status == "needs_human_review"
    assert by_agent[7].status == "needs_human_review"


def test_offer_requires_final_hire_approval_and_verified_background_check():
    state = _request().candidate.model_copy(update={
        "matching_reviewed": True,
        "interview_status": "completed",
        "recruiter_decision": "advance",
        "verification_status": "completed",
    })
    result = build_orchestration_plan(_request(candidate=state))
    task = next(task for task in result.tasks if task.agent_number == 7)
    assert task.status == "blocked"


def test_accepted_offer_enables_onboarding():
    state = _request().candidate.model_copy(update={
        "matching_reviewed": True,
        "interview_status": "completed",
        "recruiter_decision": "hire_approved",
        "verification_status": "completed",
        "offer_status": "accepted",
        "onboarding_status": "not_started",
    })
    result = build_orchestration_plan(_request(candidate=state))
    task = next(task for task in result.tasks if task.agent_number == 7)
    assert task.status == "ready"
    assert "onboarding checklist" in task.recommended_action


def test_role_level_analytics_and_workforce_tasks_have_independent_gates():
    result = build_orchestration_plan(_request(
        analytics_snapshot_generated=False,
        workforce_history_months_available=2,
        workforce_assumptions_confirmed=False,
    ))
    by_agent = {task.agent_number: task for task in result.tasks}
    assert by_agent[8].status == "ready"
    assert by_agent[9].status == "blocked"


def test_no_candidate_snapshot_does_not_claim_candidate_progress():
    result = build_orchestration_plan(_request(candidate=None))
    assert result.candidate_ref is None
    assert all(task.status == "blocked" for task in result.tasks if task.agent_number in {2, 3, 4, 5, 6, 7})


def test_rejects_identity_fields_in_candidate_snapshot():
    data = _request().model_dump()
    data["candidate"]["email"] = "candidate@example.com"
    with pytest.raises(ValidationError):
        OrchestrationPlanRequest(**data)


def test_rejects_invalid_offer_and_onboarding_state_dependencies():
    with pytest.raises(ValidationError, match="recruiter-approved hire decision"):
        _request(candidate={
            "candidate_ref": "candidate-001",
            "offer_status": "draft",
        })
    with pytest.raises(ValidationError, match="only progress after an accepted offer"):
        _request(candidate={
            "candidate_ref": "candidate-001",
            "recruiter_decision": "hire_approved",
            "onboarding_status": "in_progress",
        })

    with pytest.raises(ValidationError, match="recruiter-reviewed matching evidence"):
        _request(candidate={
            "candidate_ref": "candidate-001",
            "interview_consent_confirmed": True,
            "interview_status": "scheduled",
        })

    with pytest.raises(ValidationError, match="completed and reviewed interview"):
        _request(candidate={
            "candidate_ref": "candidate-001",
            "matching_reviewed": True,
            "interview_consent_confirmed": True,
            "interview_status": "scheduled",
            "verification_consent_confirmed": True,
            "verification_status": "in_progress",
        })

    with pytest.raises(ValidationError, match="completed background verification"):
        _request(candidate={
            "candidate_ref": "candidate-001",
            "matching_reviewed": True,
            "interview_consent_confirmed": True,
            "interview_status": "completed",
            "recruiter_decision": "hire_approved",
            "offer_status": "draft",
        })


def test_api_endpoint_returns_plan_only_mode():
    response = client.post("/api/v1/orchestrator/plan", json=_request().model_dump(mode="json"))
    assert response.status_code == 200
    body = response.json()
    assert body["orchestration_mode"] == "dependency_aware_plan_only"
    assert body["agent_dispatch_enabled"] is False
    assert body["communication_dispatch_enabled"] is False
    assert body["autonomous_hiring_decisions_enabled"] is False


def test_health_lists_recruitment_orchestrator_agent():
    response = client.get("/health")
    assert response.status_code == 200
    assert "recruitment-orchestrator" in response.json()["agents"]
