from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from math import floor

from app.workforce_planning.schemas import (
    HistoricalSummary,
    MonthlyWorkforceForecast,
    WorkforcePlanningRequest,
    WorkforcePlanningResponse,
)


SCENARIO_MULTIPLIERS = {
    "conservative": Decimal("0.75"),
    "base": Decimal("1.00"),
    "accelerated": Decimal("1.25"),
}


def _month_add(month: str, offset: int) -> str:
    year, month_number = (int(part) for part in month.split("-"))
    absolute = year * 12 + (month_number - 1) + offset
    return f"{absolute // 12:04d}-{absolute % 12 + 1:02d}"


def _round_count(value: float) -> int:
    return max(0, int(floor(value + 0.5)))


def _ols_forecast(values: list[int], steps: int) -> tuple[list[float], float, float]:
    """Return linear trend forecasts, slope and in-sample mean absolute residual."""
    n = len(values)
    x_values = list(range(n))
    x_mean = sum(x_values) / n
    y_mean = sum(values) / n
    denominator = sum((x - x_mean) ** 2 for x in x_values)
    slope = (
        sum((x - x_mean) * (y - y_mean) for x, y in zip(x_values, values))
        / denominator
        if denominator
        else 0.0
    )
    intercept = y_mean - slope * x_mean
    residuals = [
        abs(value - (intercept + slope * x))
        for x, value in zip(x_values, values)
    ]
    mae = sum(residuals) / n if residuals else 0.0
    forecasts = [
        max(0.0, intercept + slope * (n + step))
        for step in range(steps)
    ]
    return forecasts, slope, mae


def _decimal(value: float, places: str = "0.1") -> Decimal:
    return Decimal(str(value)).quantize(
        Decimal(places), rounding=ROUND_HALF_UP
    )


def build_workforce_forecast(
    request: WorkforcePlanningRequest,
) -> WorkforcePlanningResponse:
    history = request.historical_months
    demand_values = [item.new_requisitions for item in history]
    hire_values = [item.hires_completed for item in history]
    exit_total = sum(item.employee_exits for item in history)

    demand_predictions, slope, residual_mae = _ols_forecast(
        demand_values, request.forecast_months
    )
    multiplier = SCENARIO_MULTIPLIERS[request.scenario]
    effective_capacity = int(
        (Decimal(request.monthly_hiring_capacity) * multiplier)
        .quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    )
    uncertainty = max(1, _round_count(residual_mae))

    historical_summary = HistoricalSummary(
        months_supplied=len(history),
        average_new_requisitions=_decimal(
            sum(demand_values) / len(demand_values)
        ),
        average_hires_completed=_decimal(
            sum(hire_values) / len(hire_values)
        ),
        total_employee_exits=exit_total,
        demand_trend_per_month=_decimal(slope),
    )

    current_headcount = request.current_headcount
    target = request.target_headcount
    backlog = request.open_requisitions_backlog
    total_forecast_demand = 0
    total_planned_hires = 0
    forecast_rows: list[MonthlyWorkforceForecast] = []

    # Annual attrition is converted to a simple monthly expected rate.
    # Integer expected exits are rounded per month, so this is a planning approximation.
    monthly_attrition_rate = (
        request.annual_attrition_rate_percent / Decimal("1200")
    )

    last_month = history[-1].month
    for index, prediction in enumerate(demand_predictions, start=1):
        month = _month_add(last_month, index)
        new_demand = _round_count(prediction)
        demand_lower = max(0, new_demand - uncertainty)
        demand_upper = new_demand + uncertainty
        opening_backlog = backlog
        work_available = opening_backlog + new_demand
        planned_hires = min(work_available, effective_capacity)
        backlog = max(0, work_available - planned_hires)

        attrition = _round_count(
            float(Decimal(current_headcount) * monthly_attrition_rate)
        )
        current_headcount = max(
            0, current_headcount + planned_hires - attrition
        )
        workforce_gap = target - current_headcount

        total_forecast_demand += new_demand
        total_planned_hires += planned_hires
        forecast_rows.append(
            MonthlyWorkforceForecast(
                month=month,
                forecast_new_requisitions=new_demand,
                demand_lower_bound=demand_lower,
                demand_upper_bound=demand_upper,
                hiring_capacity=effective_capacity,
                planned_hires=planned_hires,
                opening_backlog=opening_backlog,
                closing_backlog=backlog,
                expected_attrition=attrition,
                projected_headcount=current_headcount,
                workforce_gap_to_target=workforce_gap,
            )
        )

    ending_gap = target - current_headcount
    capacity_shortfall = max(0, total_forecast_demand + request.open_requisitions_backlog - total_planned_hires)
    warnings: list[str] = []
    if len(history) < 6:
        warnings.append(
            "Only 3–5 historical months were supplied. Treat the trend as highly directional and validate it with HR/business owners."
        )
    if len(history) >= 6 and len(history) < 12:
        warnings.append(
            "Less than 12 months of history were supplied; seasonal hiring patterns are not modelled."
        )
    if residual_mae == 0:
        warnings.append(
            "Historical requisition demand has zero in-sample trend error; the forecast band uses a one-requisition minimum and is not a statistical confidence interval."
        )
    if request.monthly_hiring_capacity == 0 and total_forecast_demand + request.open_requisitions_backlog > 0:
        warnings.append(
            "Hiring capacity is set to zero; the forecast carries open demand forward without planned hires."
        )
    if backlog > 0:
        warnings.append(
            "The forecast ends with an open requisition backlog; planned capacity does not clear all forecast demand."
        )
    if ending_gap > 0:
        warnings.append(
            "Projected headcount remains below the target at the end of the forecast horizon."
        )
    elif ending_gap < 0:
        warnings.append(
            "Projected headcount exceeds the supplied target; review whether the target and capacity assumptions are aligned."
        )
    warnings.append(
        "This is a scenario-planning estimate, not a hiring commitment or a calibrated statistical confidence interval."
    )

    assumptions = [
        "New requisition demand is forecast using ordinary least-squares linear trend on the supplied consecutive monthly history.",
        "The demand range is forecast value ± the historical mean absolute trend residual, with a minimum one-requisition range; it is not a 95% confidence interval.",
        "Scenario multipliers change monthly hiring capacity only: conservative 0.75×, base 1.00×, accelerated 1.25×.",
        "Planned hires equal the lower of available requisitions (opening backlog plus forecast new demand) and scenario-adjusted monthly capacity.",
        "Annual attrition rate is divided by 12 and applied to the projected monthly headcount; expected exits are rounded to whole people each month.",
        "Workforce gap = target headcount minus projected headcount; positive means a projected shortage, negative means projected surplus.",
        "All input data is aggregate. Employee names, candidate identifiers, salaries and individual records are neither accepted nor returned.",
    ]

    return WorkforcePlanningResponse(
        planning_unit=request.planning_unit,
        generated_at=datetime.now(timezone.utc).isoformat(),
        scenario=request.scenario,
        forecast_months=request.forecast_months,
        forecast_method="ordinary_least_squares_linear_trend",
        historical_summary=historical_summary,
        scenario_capacity_multiplier=multiplier,
        current_headcount=request.current_headcount,
        target_headcount=target,
        opening_requisitions_backlog=request.open_requisitions_backlog,
        monthly_hiring_capacity_baseline=request.monthly_hiring_capacity,
        forecast_new_requisitions_total=total_forecast_demand,
        planned_hires_total=total_planned_hires,
        forecast_ending_backlog=backlog,
        forecast_ending_headcount=current_headcount,
        forecast_workforce_gap_to_target=ending_gap,
        estimated_capacity_shortfall=capacity_shortfall,
        trend_residual_mae=_decimal(residual_mae),
        forecast=forecast_rows,
        warnings=warnings,
        assumptions=assumptions,
    )
