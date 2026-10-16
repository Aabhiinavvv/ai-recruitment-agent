"""Group-level selection-rate diagnostics for offline model audits only."""
from collections import defaultdict
from typing import Any, Dict, Iterable, Mapping


def selection_rate_audit(
    records: Iterable[Mapping[str, Any]],
    score_key: str = "score",
    group_key: str = "audit_group",
    threshold: float = 75.0,
) -> Dict[str, Any]:
    """Report per-group sample size, selection rate, and min/max rate ratio.

    Audit-group attributes must not be used to score an individual. Collect
    such data only with an appropriate lawful basis, purpose limitation and
    safeguards. This descriptive measure does not establish legal compliance.
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

    rates = {group: selected[group] / count for group, count in totals.items() if count}
    values = list(rates.values())
    ratio = min(values) / max(values) if values and max(values) > 0 else None
    return {
        "threshold": float(threshold),
        "sample_sizes": dict(totals),
        "selection_rates": rates,
        "min_max_selection_rate_ratio": ratio,
        "warning": (
            "Diagnostic only. Investigate subgroup sample sizes, data quality, role criteria, "
            "and potential causes with qualified reviewers; no single ratio proves fairness."
        ),
    }
