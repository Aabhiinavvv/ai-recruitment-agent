from __future__ import annotations

import re
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


Scenario = Literal["conservative", "base", "accelerated"]


class MonthlyWorkforceRecord(BaseModel):
    """Monthly aggregate counts; no employee or candidate-level data is accepted."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    new_requisitions: int = Field(ge=0, le=100000)
    hires_completed: int = Field(ge=0, le=100000)
    employee_exits: int = Field(default=0, ge=0, le=100000)

    @model_validator(mode="after")
    def validate_month(self):
        try:
            date.fromisoformat(self.month + "-01")
        except ValueError as exc:
            raise ValueError("Month must be a valid YYYY-MM calendar month.") from exc
        return self


class WorkforcePlanningRequest(BaseModel):
    """Inputs are aggregate monthly records and recruiter/HR-approved planning assumptions."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    planning_unit: str = Field(default="Organisation", min_length=2, max_length=80)
    historical_months: list[MonthlyWorkforceRecord] = Field(min_length=3, max_length=36)
    current_headcount: int = Field(ge=0, le=10000000)
    target_headcount: int = Field(ge=0, le=10000000)
    open_requisitions_backlog: int = Field(default=0, ge=0, le=100000)
    monthly_hiring_capacity: int = Field(ge=0, le=100000)
    annual_attrition_rate_percent: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2)
    forecast_months: int = Field(default=6, ge=1, le=18)
    scenario: Scenario = "base"

    @model_validator(mode="after")
    def validate_historical_months(self):
        month_keys: list[tuple[int, int]] = []
        for row in self.historical_months:
            year, month = (int(part) for part in row.month.split("-"))
            month_keys.append((year, month))
        if len(month_keys) != len(set(month_keys)):
            raise ValueError("Historical months must be unique.")
        if month_keys != sorted(month_keys):
            raise ValueError("Historical months must be supplied in chronological order.")
        for previous, current in zip(month_keys, month_keys[1:]):
            previous_index = previous[0] * 12 + previous[1]
            current_index = current[0] * 12 + current[1]
            if current_index - previous_index != 1:
                raise ValueError("Historical months must be consecutive with no gaps.")
        return self


class HistoricalSummary(BaseModel):
    months_supplied: int
    average_new_requisitions: Decimal
    average_hires_completed: Decimal
    total_employee_exits: int
    demand_trend_per_month: Decimal


class MonthlyWorkforceForecast(BaseModel):
    month: str
    forecast_new_requisitions: int
    demand_lower_bound: int
    demand_upper_bound: int
    hiring_capacity: int
    planned_hires: int
    opening_backlog: int
    closing_backlog: int
    expected_attrition: int
    projected_headcount: int
    workforce_gap_to_target: int


class WorkforcePlanningResponse(BaseModel):
    planning_unit: str
    generated_at: str
    scenario: Scenario
    forecast_months: int
    forecast_method: Literal["ordinary_least_squares_linear_trend"]
    historical_summary: HistoricalSummary
    scenario_capacity_multiplier: Decimal
    current_headcount: int
    target_headcount: int
    opening_requisitions_backlog: int
    monthly_hiring_capacity_baseline: int
    forecast_new_requisitions_total: int
    planned_hires_total: int
    forecast_ending_backlog: int
    forecast_ending_headcount: int
    forecast_workforce_gap_to_target: int
    estimated_capacity_shortfall: int
    trend_residual_mae: Decimal
    forecast: list[MonthlyWorkforceForecast]
    warnings: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    persisted: Literal[False] = False
    employee_or_candidate_level_data_returned: Literal[False] = False
