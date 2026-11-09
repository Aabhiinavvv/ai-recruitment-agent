from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.workforce_planning.schemas import WorkforcePlanningRequest
from app.workforce_planning.service import build_workforce_forecast


client = TestClient(app)


def _recent_months():
    today = date.today()
    month_index = today.year * 12 + today.month - 1
    rows = []
    for offset, demand, hires, exits in [
        (5, 8, 6, 1),
        (4, 9, 7, 1),
        (3, 10, 7, 1),
        (2, 11, 8, 1),
        (1, 12, 8, 1),
        (0, 13, 9, 1),
    ]:
        absolute = month_index - offset
        year, month = absolute // 12, absolute % 12 + 1
        rows.append({
            "month": f"{year:04d}-{month:02d}",
            "new_requisitions": demand,
            "hires_completed": hires,
            "employee_exits": exits,
        })
    return rows


def _request(**overrides):
    values = {
        "planning_unit": "Engineering",
        "historical_months": _recent_months(),
        "current_headcount": 100,
        "target_headcount": 120,
        "open_requisitions_backlog": 8,
        "monthly_hiring_capacity": 10,
        "annual_attrition_rate_percent": "12.00",
        "forecast_months": 6,
        "scenario": "base",
    }
    values.update(overrides)
    return WorkforcePlanningRequest(**values)


def test_forecast_projects_months_and_workforce_gap():
    result = build_workforce_forecast(_request())
    assert len(result.forecast) == 6
    assert result.forecast[0].forecast_new_requisitions >= 13
    assert result.forecast[0].hiring_capacity == 10
    assert result.forecast_method == "ordinary_least_squares_linear_trend"
    assert result.employee_or_candidate_level_data_returned is False


def test_base_scenario_capacity_equals_baseline():
    result = build_workforce_forecast(_request(scenario="base"))
    assert all(item.hiring_capacity == 10 for item in result.forecast)


def test_conservative_scenario_reduces_hiring_capacity():
    base = build_workforce_forecast(_request(scenario="base"))
    conservative = build_workforce_forecast(_request(scenario="conservative"))
    assert conservative.forecast[0].hiring_capacity == 8
    assert conservative.planned_hires_total <= base.planned_hires_total
    assert conservative.forecast_ending_backlog >= base.forecast_ending_backlog


def test_accelerated_scenario_increases_capacity():
    result = build_workforce_forecast(_request(scenario="accelerated"))
    assert result.scenario_capacity_multiplier == Decimal("1.25")
    assert result.forecast[0].hiring_capacity == 13


def test_backlog_carries_forward_when_capacity_is_constrained():
    result = build_workforce_forecast(
        _request(monthly_hiring_capacity=2, open_requisitions_backlog=10)
    )
    assert result.forecast[0].opening_backlog == 10
    assert result.forecast[0].closing_backlog > 0
    assert result.forecast[1].opening_backlog == result.forecast[0].closing_backlog


def test_workforce_gap_uses_target_minus_projected_headcount():
    result = build_workforce_forecast(_request())
    final = result.forecast[-1]
    assert final.workforce_gap_to_target == 120 - final.projected_headcount
    assert result.forecast_workforce_gap_to_target == final.workforce_gap_to_target


def test_attrition_is_applied_to_projected_headcount():
    result = build_workforce_forecast(
        _request(
            current_headcount=100,
            target_headcount=100,
            monthly_hiring_capacity=0,
            open_requisitions_backlog=0,
            annual_attrition_rate_percent="12.00",
        )
    )
    assert result.forecast[0].expected_attrition == 1
    assert result.forecast[0].projected_headcount == 99


def test_zero_capacity_preserves_open_demand():
    result = build_workforce_forecast(
        _request(monthly_hiring_capacity=0, open_requisitions_backlog=4)
    )
    assert result.planned_hires_total == 0
    assert result.forecast_ending_backlog > 0
    assert any("capacity is set to zero" in item for item in result.warnings)


def test_requires_at_least_three_months_of_history():
    with pytest.raises(ValidationError):
        _request(historical_months=_recent_months()[:2])


def test_rejects_non_consecutive_historical_months():
    rows = _recent_months()
    rows[3]["month"] = "2020-01"
    with pytest.raises(ValidationError, match="chronological order|consecutive"):
        _request(historical_months=rows)


def test_rejects_duplicate_historical_months():
    rows = _recent_months()
    rows[-1]["month"] = rows[-2]["month"]
    with pytest.raises(ValidationError, match="must be unique"):
        _request(historical_months=rows)


def test_rejects_unknown_employee_level_fields():
    rows = _recent_months()
    rows[0]["employee_name"] = "Not allowed"
    with pytest.raises(ValidationError):
        _request(historical_months=rows)


def test_rejects_invalid_attrition_rate_and_horizon():
    with pytest.raises(ValidationError):
        _request(annual_attrition_rate_percent="140")
    with pytest.raises(ValidationError):
        _request(forecast_months=24)


def test_api_returns_aggregate_forecast_only():
    response = client.post(
        "/api/v1/workforce-planning/forecast",
        json=_request().model_dump(mode="json"),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["forecast_months"] == 6
    assert body["persisted"] is False
    assert body["employee_or_candidate_level_data_returned"] is False
    assert "historical_months" not in body


def test_health_lists_workforce_planning_agent():
    response = client.get("/health")
    assert response.status_code == 200
    assert "workforce-planning" in response.json()["agents"]
