from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from statistics import median
from collections import defaultdict

from app.analytics.schemas import (
    CostPerHireMetric,
    DecisionMetric,
    PipelineStage,
    RecruiterPerformanceMetric,
    RecruitmentAnalyticsRequest,
    RecruitmentAnalyticsResponse,
    SourceEffectivenessMetric,
    StageMetric,
    TimeToHireMetric,
)


ZERO = Decimal("0")
ONE_DECIMAL = Decimal("0.1")
TWO_DECIMALS = Decimal("0.01")
STAGES: tuple[PipelineStage, ...] = (
    "screening",
    "technical",
    "interview",
    "offered",
    "rejected",
)
DECISIONS = ("pending", "advanced", "not_proceeding", "hired")


def _percent(numerator: int, denominator: int) -> Decimal:
    if denominator <= 0:
        return ZERO
    return (Decimal(numerator) * Decimal("100") / Decimal(denominator)).quantize(
        ONE_DECIMAL, rounding=ROUND_HALF_UP
    )


def _mean(values: list[Decimal]) -> Decimal | None:
    if not values:
        return None
    return (sum(values, ZERO) / Decimal(len(values))).quantize(
        ONE_DECIMAL, rounding=ROUND_HALF_UP
    )


def build_recruitment_analytics(
    request: RecruitmentAnalyticsRequest,
) -> RecruitmentAnalyticsResponse:
    rows = request.candidate_records
    total = len(rows)

    stage_counts: dict[str, int] = {stage: 0 for stage in STAGES}
    stage_counts["unknown"] = 0
    decision_counts = {status: 0 for status in DECISIONS}
    scores: list[Decimal] = []
    source_buckets: dict[str, list] = defaultdict(list)
    recruiter_buckets: dict[str, list] = defaultdict(list)
    hire_durations: list[int] = []

    for row in rows:
        stage_counts[row.stage] += 1
        decision_counts[row.decision_status] += 1
        if row.overall_score is not None:
            scores.append(row.overall_score)
        if row.source_channel:
            source_buckets[row.source_channel].append(row)
        if row.recruiter_label:
            recruiter_buckets[row.recruiter_label].append(row)
        if row.decision_status == "hired" and row.applied_at and row.hired_at:
            hire_durations.append((row.hired_at - row.applied_at).days)

    hired = decision_counts["hired"]
    rejected = decision_counts["not_proceeding"]
    advanced = decision_counts["advanced"]
    pending = decision_counts["pending"]
    decided = advanced + rejected + hired

    stage_funnel = [
        StageMetric(
            stage=stage,  # type: ignore[arg-type]
            candidates=stage_counts[stage],
            share_percent=_percent(stage_counts[stage], total),
        )
        for stage in STAGES
    ]
    if stage_counts["unknown"]:
        stage_funnel.append(
            StageMetric(
                stage="unknown",
                candidates=stage_counts["unknown"],
                share_percent=_percent(stage_counts["unknown"], total),
            )
        )

    decision_breakdown = [
        DecisionMetric(
            status=status,  # type: ignore[arg-type]
            candidates=decision_counts[status],
            share_percent=_percent(decision_counts[status], total),
        )
        for status in DECISIONS
    ]

    source_effectiveness = [
        SourceEffectivenessMetric(
            source_channel=source,  # type: ignore[arg-type]
            applicants=len(source_rows),
            hires=sum(1 for row in source_rows if row.decision_status == "hired"),
            hire_rate_percent=_percent(
                sum(1 for row in source_rows if row.decision_status == "hired"),
                len(source_rows),
            ),
        )
        for source, source_rows in sorted(source_buckets.items())
    ]

    recruiter_performance = []
    for label, recruiter_rows in sorted(recruiter_buckets.items()):
        recruiter_scores = [
            row.overall_score for row in recruiter_rows if row.overall_score is not None
        ]
        recruiter_hires = sum(
            1 for row in recruiter_rows if row.decision_status == "hired"
        )
        recruiter_advanced = sum(
            1
            for row in recruiter_rows
            if row.decision_status in {"advanced", "hired"}
        )
        recruiter_performance.append(
            RecruiterPerformanceMetric(
                recruiter_label=label,
                candidates=len(recruiter_rows),
                advanced_or_hired=recruiter_advanced,
                hires=recruiter_hires,
                average_overall_score=_mean(recruiter_scores),
            )
        )

    if hire_durations:
        average_days = (
            Decimal(sum(hire_durations)) / Decimal(len(hire_durations))
        ).quantize(ONE_DECIMAL, rounding=ROUND_HALF_UP)
        median_days = Decimal(str(median(hire_durations))).quantize(
            ONE_DECIMAL, rounding=ROUND_HALF_UP
        )
        time_to_hire = TimeToHireMetric(
            average_days=average_days,
            median_days=median_days,
            minimum_days=min(hire_durations),
            maximum_days=max(hire_durations),
            sample_size=len(hire_durations),
        )
    else:
        time_to_hire = TimeToHireMetric(sample_size=0)

    cost_per_hire_amount: Decimal | None = None
    if (
        request.total_recruitment_cost is not None
        and request.period_hires is not None
        and request.period_hires > 0
    ):
        cost_per_hire_amount = (
            request.total_recruitment_cost / Decimal(request.period_hires)
        ).quantize(TWO_DECIMALS, rounding=ROUND_HALF_UP)

    cost_per_hire = CostPerHireMetric(
        amount=cost_per_hire_amount,
        currency=request.cost_currency,
        period_hires=request.period_hires,
        total_recruitment_cost=request.total_recruitment_cost,
    )

    warnings: list[str] = []
    if not source_effectiveness:
        warnings.append(
            "Source effectiveness is unavailable because no acquisition source channels were supplied."
        )
    if not recruiter_performance:
        warnings.append(
            "Recruiter performance is unavailable because no anonymised recruiter/team labels were supplied."
        )
    if not scores:
        warnings.append("Average candidate score is unavailable because no scores were supplied.")
    if not hire_durations:
        warnings.append(
            "Time-to-hire is unavailable because no completed hires had both application and hire dates."
        )
    elif len(hire_durations) < hired:
        warnings.append(
            "Time-to-hire uses only completed hires with both dates; some hire records were missing date metadata."
        )
    if request.total_recruitment_cost is None:
        warnings.append(
            "Cost per hire is unavailable because total recruitment spend was not supplied."
        )
    elif not request.period_hires:
        warnings.append(
            "Cost per hire is unavailable because the reporting-period hire count is zero."
        )
    if any(row.source_channel is None for row in rows):
        warnings.append(
            "Some candidates have no acquisition source; source effectiveness covers only attributed records."
        )
    if any(row.recruiter_label is None for row in rows):
        warnings.append(
            "Some candidates have no recruiter/team attribution; recruiter metrics cover only attributed records."
        )
    if any(row.decision_status == "hired" and row.hired_at is None for row in rows):
        warnings.append(
            "Some recruiter-confirmed hires have no hire date; those records are excluded from time-to-hire."
        )

    methodology = [
        "Stage funnel and decision breakdown are a snapshot of the candidate records submitted, not historical stage-entry counts.",
        "Overall hire rate = recruiter-confirmed hires divided by submitted candidate records.",
        "Recruiter advance rate = advanced plus hired decisions divided by all non-pending decisions.",
        "Source hire rate = recruiter-confirmed hires attributed to a source divided by candidates attributed to that source.",
        "Time-to-hire = calendar days from application date to hire date for recruiter-confirmed hires with both dates.",
        "Cost per hire = supplied total recruitment spend divided by the separately supplied number of hires in the same reporting period.",
        "Only pseudonymous row references and aggregate metrics are processed; candidate names, contact details, resumes and raw identifiers are not accepted.",
    ]

    return RecruitmentAnalyticsResponse(
        reporting_period=request.reporting_period,
        generated_at=datetime.now(timezone.utc).isoformat(),
        total_candidates=total,
        hired_count=hired,
        rejected_count=rejected,
        pending_review_count=pending,
        advanced_count=advanced,
        overall_hire_rate_percent=_percent(hired, total),
        recruiter_advance_rate_percent=_percent(advanced + hired, decided) if decided else None,
        average_overall_score=_mean(scores),
        stage_funnel=stage_funnel,
        decision_breakdown=decision_breakdown,
        source_effectiveness=source_effectiveness,
        recruiter_performance=recruiter_performance,
        time_to_hire=time_to_hire,
        cost_per_hire=cost_per_hire,
        source_attributed_candidates=sum(len(items) for items in source_buckets.values()),
        recruiter_attributed_candidates=sum(len(items) for items in recruiter_buckets.values()),
        score_sample_size=len(scores),
        warnings=warnings,
        methodology=methodology,
    )
