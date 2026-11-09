import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.interview.schemas import InterviewAnswerRequest, InterviewPlanRequest
from app.interview.service import create_interview_plan, evaluate_interview_answer
from app.main import app


client = TestClient(app)


def _plan_request(**overrides):
    values = {
        "candidate_id": "CAND-101",
        "job_title": "Machine Learning Engineer",
        "interview_round": "technical",
        "recruiter_approved": True,
        "recruiter_decision": "advance",
        "candidate_consent_confirmed": True,
        "job_context": "Build and evaluate machine learning models and deploy reliable APIs.",
        "rubric_criteria": [
            {
                "criterion": "Python engineering",
                "weight_percent": 40,
                "evidence_to_look_for": ["testing", "readable code"],
            },
            {
                "criterion": "Model evaluation",
                "weight_percent": 60,
                "evidence_to_look_for": ["validation strategy", "metrics"],
            },
        ],
    }
    values.update(overrides)
    return InterviewPlanRequest(**values)


def _answer_request(**overrides):
    values = {
        "session_id": "INT-12345678",
        "candidate_id": "CAND-101",
        "job_title": "Machine Learning Engineer",
        "interview_round": "technical",
        "question_id": "Q1",
        "question": "Describe how you test a Python service before deployment.",
        "competency": "Python engineering",
        "answer": "I wrote unit tests with pytest and added an integration test for the API.",
        "evidence_to_look_for": ["testing", "API validation"],
        "transcript_processing_consent_confirmed": True,
    }
    values.update(overrides)
    return InterviewAnswerRequest(**values)


@pytest.mark.asyncio
async def test_question_plan_uses_deterministic_fallback_without_ollama():
    result = await create_interview_plan(_plan_request(), Settings(llm_enabled=False))
    assert result.generation_mode == "deterministic_fallback"
    assert 4 <= len(result.questions) <= 8
    assert result.requires_human_review is True
    assert result.audio_recording_enabled is False
    assert result.video_recording_enabled is False
    assert result.persistence_enabled is False
    assert any("Python engineering" in question.competency for question in result.questions)


@pytest.mark.asyncio
async def test_protected_context_sentence_is_removed_from_plan():
    request = _plan_request(
        job_context=(
            "Build APIs and evaluate models. Candidate should be young and energetic. "
            "Maintain reliable deployments."
        )
    )
    result = await create_interview_plan(request, Settings(llm_enabled=False))
    assert len(result.warnings) == 1
    assert all("young" not in item.question.lower() for item in result.questions)


def test_unapproved_job_is_rejected():
    with pytest.raises(ValidationError, match="must be recruiter-approved"):
        _plan_request(recruiter_approved=False)


def test_candidate_must_be_advanced_by_recruiter():
    with pytest.raises(ValidationError, match="explicitly advanced"):
        _plan_request(recruiter_decision="hold")


def test_candidate_consent_is_required_for_planning():
    with pytest.raises(ValidationError, match="Candidate consent"):
        _plan_request(candidate_consent_confirmed=False)


def test_job_context_or_rubric_is_required():
    with pytest.raises(ValidationError, match="approved job context or evaluation rubric"):
        _plan_request(job_context="", rubric_criteria=[])


def test_transcript_consent_is_required():
    with pytest.raises(ValidationError, match="Candidate consent"):
        _answer_request(transcript_processing_consent_confirmed=False)


@pytest.mark.asyncio
async def test_answer_fallback_does_not_fabricate_a_score():
    result = await evaluate_interview_answer(
        _answer_request(), Settings(llm_enabled=False)
    )
    assert result.evaluation_mode == "manual_review_fallback"
    assert result.score is None
    assert result.decision_status == "pending_human_review"
    assert result.requires_human_review is True
    assert result.automated_pass_reject is False
    assert result.review_flags


def test_plan_endpoint_rejects_unapproved_candidate():
    payload = _plan_request(recruiter_decision="hold").model_dump()
    response = client.post("/api/v1/interviews/plan", json=payload)
    assert response.status_code == 422


def test_health_lists_interview_agent():
    response = client.get("/health")
    assert response.status_code == 200
    assert "interview" in response.json()["agents"]


@pytest.mark.asyncio
async def test_answer_protected_context_is_flagged_for_manual_review():
    result = await evaluate_interview_answer(
        _answer_request(
            answer=(
                "I have a medical condition that affects my schedule. "
                "I wrote pytest unit tests and an API integration test."
            )
        ),
        Settings(llm_enabled=False),
    )
    assert result.score is None
    assert any("omitted from the model context" in flag for flag in result.review_flags)
