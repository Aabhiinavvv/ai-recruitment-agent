"""Group-level selection-rate diagnostics for offline evaluation only."""
from collections import defaultdict
from typing import Any, Dict, Iterable, Mapping


def selection_rate_audit(
    records: Iterable[Mapping[str, Any]],
    score_key: str = "score",
    group_key: str = "audit_group",
    threshold: float = 75.0,
) -> Dict[str, Any]:
    """Report group sample sizes/rates. This is not proof of fairness or compliance.

    Audit-group data must be lawfully collected and must never be used to score
    an individual. Ratios depend on sample size, job context, and jurisdiction.
    """
    totals = defaultdict(int)
    selected = defaultdict(int)
    for row in records:
        group = str(row.get(group_key, "unknown"))
        try:
            score = float(row[score_key])
        except (KeyError, TypeError, ValueError):
            continue
        totals[group] += 1
        selected[group] += int(score >= threshold)
    rates = {g: selected[g] / n for g, n in totals.items() if n}
    positive = [rate for rate in rates.values() if rate > 0]
    ratio = min(positive) / max(positive) if positive else None
    return {
        "threshold": threshold,
        "sample_sizes": dict(totals),
        "selection_rates": rates,
        "min_max_selection_rate_ratio": ratio,
        "warning": "Diagnostic only. Review subgroup sizes, data quality, job relevance, and causes with qualified reviewers.",
    }
