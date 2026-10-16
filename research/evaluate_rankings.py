"""Ranking evaluation metrics for recruiter-labelled relevance datasets.

CSV schema: job_id,candidate_id,method,score,relevance
- method: e.g. keyword, embedding, llm_only, hybrid
- score: score output by that method; higher ranks first
- relevance: human-labelled graded relevance (0 = not relevant, 1+ = relevant)

Report macro averages over jobs. These metrics evaluate ranked retrieval against
labels; they are not a certification of fairness or job-performance prediction.
"""
from __future__ import annotations

from collections import defaultdict
from statistics import mean
from typing import Any, Dict, Iterable, List, Mapping, Sequence
import argparse
import csv
import json


def precision_at_k(ranked: Sequence[Mapping[str, Any]], k: int) -> float:
    if k <= 0:
        raise ValueError("k must be positive")
    top = list(ranked[:k])
    if not top:
        return 0.0
    return sum(float(row.get("relevance", 0)) > 0 for row in top) / k


def recall_at_k(ranked: Sequence[Mapping[str, Any]], all_rows: Sequence[Mapping[str, Any]], k: int) -> float:
    if k <= 0:
        raise ValueError("k must be positive")
    relevant_total = sum(float(row.get("relevance", 0)) > 0 for row in all_rows)
    if relevant_total == 0:
        return 0.0
    retrieved_relevant = sum(float(row.get("relevance", 0)) > 0 for row in ranked[:k])
    return retrieved_relevant / relevant_total


def reciprocal_rank(ranked: Sequence[Mapping[str, Any]]) -> float:
    for position, row in enumerate(ranked, start=1):
        if float(row.get("relevance", 0)) > 0:
            return 1.0 / position
    return 0.0


def ndcg_at_k(ranked: Sequence[Mapping[str, Any]], k: int) -> float:
    if k <= 0:
        raise ValueError("k must be positive")
    import math

    def dcg(rows):
        return sum((2 ** max(0.0, float(row.get("relevance", 0))) - 1) / math.log2(index + 2)
                   for index, row in enumerate(rows[:k]))

    ideal = sorted(ranked, key=lambda row: float(row.get("relevance", 0)), reverse=True)
    ideal_dcg = dcg(ideal)
    return dcg(ranked) / ideal_dcg if ideal_dcg else 0.0


def evaluate_rankings(records: Iterable[Mapping[str, Any]], k: int = 5) -> Dict[str, Any]:
    if k <= 0:
        raise ValueError("k must be positive")
    grouped = defaultdict(list)
    for source in records:
        row = dict(source)
        for field in ("job_id", "candidate_id", "method", "score", "relevance"):
            if field not in row:
                raise ValueError(f"Missing required field: {field}")
        try:
            row["score"] = float(row["score"])
            row["relevance"] = float(row["relevance"])
        except (TypeError, ValueError) as exc:
            raise ValueError("score and relevance must be numeric") from exc
        if row["relevance"] < 0:
            raise ValueError("relevance must be non-negative")
        grouped[(str(row["job_id"]), str(row["method"]))].append(row)

    per_group = []
    by_method = defaultdict(list)
    for (job_id, method), rows in sorted(grouped.items()):
        ranked = sorted(rows, key=lambda row: row["score"], reverse=True)
        metrics = {
            "job_id": job_id,
            "method": method,
            "candidate_count": len(rows),
            f"precision_at_{k}": precision_at_k(ranked, k),
            f"recall_at_{k}": recall_at_k(ranked, rows, k),
            "mrr": reciprocal_rank(ranked),
            f"ndcg_at_{k}": ndcg_at_k(ranked, k),
        }
        per_group.append(metrics)
        by_method[method].append(metrics)

    macro = {}
    for method, rows in sorted(by_method.items()):
        metric_names = [f"precision_at_{k}", f"recall_at_{k}", "mrr", f"ndcg_at_{k}"]
        macro[method] = {
            "jobs_evaluated": len(rows),
            **{name: round(mean(row[name] for row in rows), 6) for name in metric_names},
        }
    return {"k": k, "jobs_methods": per_group, "macro_by_method": macro}


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate ranked candidate retrieval methods against human relevance labels.")
    parser.add_argument("csv_path", help="CSV with job_id,candidate_id,method,score,relevance")
    parser.add_argument("--k", type=int, default=5, help="Ranking cutoff (default: 5)")
    args = parser.parse_args()
    with open(args.csv_path, newline="", encoding="utf-8-sig") as handle:
        records = list(csv.DictReader(handle))
    print(json.dumps(evaluate_rankings(records, k=args.k), indent=2))


if __name__ == "__main__":
    main()
