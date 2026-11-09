from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.analytics.schemas import RecruitmentAnalyticsRequest
from app.analytics.service import build_recruitment_analytics
from app.main import app


client = TestClient(app)


def _request(**overrides):
    today = date.today()
    values = {
        "reporting_period": "Q4 2026",
        "candidate_records": [
            {
                "record_ref": "row-001",
                "stage": "offered",
                "decision_status": "hired",
                "overall_score": "86.5",
                "source_channel": "referral",
                "recruiter_label": "Recruiter A",
                "applied_at": today - timedelta(days=32),
                "hired_at": today - timedelta(days=5),
            },
            {
                "record_ref": "row-002",
                "stage": "interview",
                "decision_status": "advanced",
                "overall_score": "78",
                "source_channel": "linkedin",
                "recruiter_label": "Recruiter A",
                "applied_at": today - timedelta(days=12),
            },
            {
                "record_ref": "row-003",
                "stage": "rejected",
                "decision_status": "not_proceeding",
                "overall_score": "51",
                "source_channel": "job_board",
                "recruiter_label": "Recruiter B",
                "applied_at": today - timedelta(days=10),
            },
            {
                "record_ref": "row-004",
                "stage": "screening",
                "decision_status": "pending",
                "overall_score": "70",
                "applied_at": today - timedelta(days=2),
            },
        ],
        "total_recruitment_cost": "60000.00",
        "cost_currency": "INR",
        "period_hires": 3,
    }
    values.update(overrides)
    return RecruitmentAnalyticsRequest(**values)


def test_aggregates_funnel_decisions_and_hire_rate():
    result = build_recruitment_analytics(_request())
    assert result.total_candidates == 4
    assert result.hired_count == 1
    assert result.rejected_count == 1
    assert result.pending_review_count == 1
    assert result.advanced_count == 1
    assert result.overall_hire_rate_percent == Decimal("25.0")
    assert result.recruiter_advance_rate_percent == Decimal("66.7")
    assert {item.stage: item.candidates for item in result.stage_funnel}["offered"] == 1


def test_calculates_time_to_hire_from_hire_records_only():
    result = build_recruitment_analytics(_request())
    assert result.time_to_hire.sample_size == 1
    assert result.time_to_hire.average_days == Decimal("27.0")
    assert result.time_to_hire.median_days == Decimal("27.0")


def test_calculates_cost_per_hire_using_same_period_count():
    result = build_recruitment_analytics(_request())
    assert result.cost_per_hire.amount == Decimal("20000.00")
    assert result.cost_per_hire.currency == "INR"
    assert result.cost_per_hire.period_hires == 3


def test_source_effectiveness_uses_only_attributed_rows():
    result = build_recruitment_analytics(_request())
    sources = {item.source_channel: item for item in result.source_effectiveness}
    assert sources["referral"].applicants == 1
    assert sources["referral"].hires == 1
    assert sources["linkedin"].hire_rate_percent == Decimal("0.0")
    assert result.source_attributed_candidates == 3


def test_recruiter_metrics_use_anonymised_labels():
    result = build_recruitment_analytics(_request())
    recruiters = {item.recruiter_label: item for item in result.recruiter_performance}
    assert recruiters["Recruiter A"].candidates == 2
    assert recruiters["Recruiter A"].hires == 1
    assert recruiters["Recruiter B"].advanced_or_hired == 0


def test_missing_metadata_is_reported_not_invented():
    req = _request(
        total_recruitment_cost=None,
        cost_currency=None,
        period_hires=None,
    )
    result = build_recruitment_analytics(req)
    assert result.time_to_hire.sample_size == 1
    assert result.cost_per_hire.amount is None
    assert any("Cost per hire is unavailable" in warning for warning in result.warnings)


def test_zero_period_hires_does_not_divide_by_zero():
    result = build_recruitment_analytics(
        _request(period_hires=0)
    )
    assert result.cost_per_hire.amount is None
    assert any("hire count is zero" in warning for warning in result.warnings)


def test_rejects_duplicate_pseudonymous_references():
    req = _request()
    data = req.model_dump()
    data["candidate_records"][1]["record_ref"] = "row-001"
    with pytest.raises(ValidationError, match="must be unique"):
        RecruitmentAnalyticsRequest(**data)


def test_rejects_personal_identifiers_in_recruiter_labels():
    req = _request()
    data = req.model_dump()
    data["candidate_records"][0]["recruiter_label"] = "recruiter@example.com"
    with pytest.raises(ValidationError, match="anonymised recruiter alias"):
        RecruitmentAnalyticsRequest(**data)


def test_hire_date_requires_application_date_and_hired_status():
    req = _request()
    data = req.model_dump()
    data["candidate_records"][1]["hired_at"] = date.today()
    with pytest.raises(ValidationError, match="only be supplied for a recruiter-confirmed hire"):
        RecruitmentAnalyticsRequest(**data)


def test_hire_date_cannot_precede_application_date():
    req = _request()
    data = req.model_dump()
    data["candidate_records"][0]["applied_at"] = date.today()
    data["candidate_records"][0]["hired_at"] = date.today() - timedelta(days=1)
    with pytest.raises(ValidationError, match="cannot be earlier"):
        RecruitmentAnalyticsRequest(**data)


def test_api_endpoint_returns_aggregate_only():
    payload = _request().model_dump(mode="json")
    response = client.post("/api/v1/analytics/recruitment", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["total_candidates"] == 4
    assert body["candidate_level_data_returned"] is False
    assert body["persisted"] is False
    assert "candidate_records" not in body


def test_health_lists_recruitment_analytics_agent():
    response = client.get("/health")
    assert response.status_code == 200
    assert "recruitment-analytics" in response.json()["agents"]
