from __future__ import annotations

import re
from datetime import date
from typing import Any

from app.candidate_intelligence.schemas import CandidateProfile, EvidenceItem
from app.matching.retrieval import retrieve_evidence
from app.matching.schemas import (
    CandidateMatchBatchRequest,
    CandidateMatchBatchResponse,
    CandidateMatchResult,
    CriterionMatch,
    SkillMatch,
)


SKILL_ALIASES = {
    "sklearn": "scikit-learn",
    "scikit learn": "scikit-learn",
    "js": "javascript",
    "ts": "typescript",
    "ml": "machine learning",
    "nlp": "natural language processing",
    "cv": "computer vision",
    "postgres": "postgresql",
    "node": "node.js",
    "llms": "llm",
}


def normalize_skill(value: str) -> str:
    key = re.sub(r"\s+", " ", value.casefold().strip()).replace("_", " ")
    return SKILL_ALIASES.get(key, key)


def _evidence_lookup(profile: CandidateProfile) -> dict[str, EvidenceItem]:
    return {item.evidence_id: item for item in profile.evidence}


def _skill_matches(profile: CandidateProfile, required: list[str]) -> list[SkillMatch]:
    detected = {normalize_skill(item.name): item for item in profile.skills}
    evidence = _evidence_lookup(profile)
    results: list[SkillMatch] = []
    for skill in required:
        match = detected.get(normalize_skill(skill))
        evidence_ids = [
            evidence_id for evidence_id in (match.evidence_ids if match else [])
            if evidence_id in evidence
        ]
        results.append(SkillMatch(
            skill=skill,
            status="matched" if match and evidence_ids else "not_detected",
            evidence_ids=evidence_ids,
        ))
    return results


def _profile_chunks(profile: CandidateProfile) -> list[dict[str, Any]]:
    """Only job-related text is searchable; identifiers and demographic signals are excluded."""
    permitted_fields = {"skills", "work_experience", "education", "projects"}
    evidence = _evidence_lookup(profile)
    chunks: list[dict[str, Any]] = []
    for item in profile.evidence:
        if item.field in permitted_fields:
            chunks.append({
                "evidence_id": item.evidence_id,
                "field": item.field,
                "text": item.quote,
            })

    for skill in profile.skills:
        if skill.evidence_ids and any(eid in evidence for eid in skill.evidence_ids):
            chunks.append({
                "evidence_id": next(eid for eid in skill.evidence_ids if eid in evidence),
                "field": "skills",
                "text": skill.name,
            })
    for entry in profile.work_experience:
        for evidence_id in entry.evidence_ids:
            if evidence_id in evidence:
                chunks.append({
                    "evidence_id": evidence_id,
                    "field": "work_experience",
                    "text": entry.raw_entry,
                })
    for entry in profile.education:
        for evidence_id in entry.evidence_ids:
            if evidence_id in evidence:
                chunks.append({
                    "evidence_id": evidence_id,
                    "field": "education",
                    "text": entry.raw_entry,
                })
    for entry in profile.projects:
        for evidence_id in entry.evidence_ids:
            if evidence_id in evidence:
                chunks.append({
                    "evidence_id": evidence_id,
                    "field": "projects",
                    "text": entry.details,
                })
    return chunks


def _month_index(year: int, month: int) -> int:
    return year * 12 + month - 1


def _parse_date_range(value: str) -> tuple[int, int] | None:
    months = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }
    pattern = re.compile(
        r"(?i)(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{4})"
        r"\s*(?:-|–|to)\s*"
        r"(Present|Current|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{4}))"
    )
    match = pattern.search(value or "")
    if match:
        start = _month_index(int(match.group(2)), months[match.group(1).lower()[:3]])
        if match.group(3).lower() in {"present", "current"}:
            now = date.today()
            end = _month_index(now.year, now.month)
        else:
            end = _month_index(int(match.group(5)), months[match.group(4).lower()[:3]])
        return (start, max(start, end))

    year_pattern = re.search(
        r"\b((?:19|20)\d{2})\s*(?:-|–|to)\s*((?:19|20)\d{2}|present|current)\b",
        value or "", re.I
    )
    if year_pattern:
        start_year = int(year_pattern.group(1))
        end_token = year_pattern.group(2)
        end_year = date.today().year if end_token.lower() in {"present", "current"} else int(end_token)
        return (_month_index(start_year, 1), _month_index(max(start_year, end_year), 12))
    return None


def estimate_experience_months(profile: CandidateProfile) -> int | None:
    intervals = [
        interval for entry in profile.work_experience
        if entry.date_range
        for interval in [_parse_date_range(entry.date_range)]
        if interval is not None
    ]
    if not intervals:
        return None
    intervals.sort()
    merged: list[list[int]] = []
    for start, end in intervals:
        if not merged or start > merged[-1][1] + 1:
            merged.append([start, end])
        else:
            merged[-1][1] = max(merged[-1][1], end)
    return sum(end - start + 1 for start, end in merged)


def _criterion_kind(criterion: str) -> str:
    value = criterion.casefold()
    if any(term in value for term in ("skill", "technical", "competenc", "qualification")):
        return "skills"
    if any(term in value for term in ("experience", "tenure", "years in")):
        return "experience"
    if any(term in value for term in ("education", "degree", "academic")):
        return "education"
    if any(term in value for term in ("project", "portfolio", "work sample")):
        return "projects"
    return "general"


def _evidence_for_ids(
    evidence_lookup: dict[str, EvidenceItem],
    evidence_ids: list[str],
) -> list[str]:
    return list(dict.fromkeys(
        evidence_id for evidence_id in evidence_ids if evidence_id in evidence_lookup
    ))


def _score_criterion(
    profile: CandidateProfile,
    criterion: str,
    weight_percent: int,
    evidence_to_look_for: list[str],
    job: Any,
    chunks: list[dict[str, Any]],
) -> tuple[CriterionMatch, str]:
    kind = _criterion_kind(criterion)
    evidence_lookup = _evidence_lookup(profile)
    if kind == "skills":
        target_skills = job.required_skills or job.preferred_skills
        if not target_skills:
            return CriterionMatch(
                criterion=criterion, weight_percent=weight_percent, status="not_evaluable",
                rationale="The approved job brief contains no skill requirements for this criterion.",
            ), "not_applicable"
        if not profile.skills:
            return CriterionMatch(
                criterion=criterion, weight_percent=weight_percent, status="not_evaluable",
                rationale="No skills were extracted reliably; this is an extraction uncertainty, not evidence of absence.",
            ), "not_applicable"
        matched = [item for item in _skill_matches(profile, target_skills) if item.status == "matched"]
        ids = _evidence_for_ids(
            evidence_lookup, [eid for item in matched for eid in item.evidence_ids]
        )
        score = round(100 * len(matched) / len(target_skills), 2)
        return CriterionMatch(
            criterion=criterion, weight_percent=weight_percent, score=score, status="scored",
            rationale=f"Resume evidence for {len(matched)} of {len(target_skills)} target skills was detected.",
            evidence_ids=ids,
        ), "structured-skill-evidence"

    if kind == "experience":
        if job.minimum_experience_months is None:
            return CriterionMatch(
                criterion=criterion, weight_percent=weight_percent, status="not_evaluable",
                rationale="The approved job brief does not specify a minimum experience duration.",
            ), "not_applicable"
        months = estimate_experience_months(profile)
        if months is None:
            return CriterionMatch(
                criterion=criterion, weight_percent=weight_percent, status="not_evaluable",
                rationale="Explicit work date ranges were not available; experience duration cannot be reliably calculated.",
            ), "not_applicable"
        score = 100.0 if months >= job.minimum_experience_months else round(
            100 * months / max(1, job.minimum_experience_months), 2
        )
        ids = _evidence_for_ids(
            evidence_lookup,
            [eid for entry in profile.work_experience for eid in entry.evidence_ids],
        )
        return CriterionMatch(
            criterion=criterion, weight_percent=weight_percent, score=score, status="scored",
            rationale=f"Approximately {months} months of non-overlapping dated experience was identified; the job specifies {job.minimum_experience_months} months.",
            evidence_ids=ids,
        ), "dated-experience-evidence"

    if kind == "education":
        if not job.education_requirements:
            return CriterionMatch(
                criterion=criterion, weight_percent=weight_percent, status="not_evaluable",
                rationale="No education requirements were specified in the approved job brief.",
            ), "not_applicable"
        if not profile.education or profile.field_confidence.get("education", 0) <= 0:
            return CriterionMatch(
                criterion=criterion, weight_percent=weight_percent, status="not_evaluable",
                rationale="Education information was not extracted reliably; verify the original resume.",
            ), "not_applicable"
        query = " ".join([*job.education_requirements, *evidence_to_look_for, criterion])
        education_chunks = [item for item in chunks if item["field"] == "education"]
        retrieved, method, coverage = retrieve_evidence(query, education_chunks)
        ids = _evidence_for_ids(evidence_lookup, [item["evidence_id"] for item in retrieved])
        if not retrieved:
            return CriterionMatch(
                criterion=criterion, weight_percent=weight_percent, status="not_evaluable",
                rationale="Education text exists but no matching source evidence was retrieved.",
            ), method
        return CriterionMatch(
            criterion=criterion, weight_percent=weight_percent, score=round(coverage * 100, 2),
            status="scored",
            rationale="This advisory score reflects keyword coverage between the stated education criteria and retrieved education excerpts; verify the credential.",
            evidence_ids=ids,
        ), method

    allowed_fields = {"projects", "work_experience"} if kind == "projects" else {
        "skills", "work_experience", "education", "projects"
    }
    eligible_chunks = [item for item in chunks if item["field"] in allowed_fields]
    query = " ".join([criterion, *evidence_to_look_for, *job.responsibilities]).strip()
    retrieved, method, coverage = retrieve_evidence(query, eligible_chunks)
    if not retrieved:
        return CriterionMatch(
            criterion=criterion, weight_percent=weight_percent, status="not_evaluable",
            rationale="No relevant supporting evidence could be retrieved from the parsed resume.",
        ), method
    ids = _evidence_for_ids(evidence_lookup, [item["evidence_id"] for item in retrieved])
    if not ids:
        return CriterionMatch(
            criterion=criterion, weight_percent=weight_percent, status="not_evaluable",
            rationale="Retrieved text could not be connected to source evidence IDs.",
        ), method
    return CriterionMatch(
        criterion=criterion, weight_percent=weight_percent, score=round(coverage * 100, 2),
        status="scored",
        rationale="This advisory score reflects lexical coverage of the rubric's evidence prompts in retrieved resume excerpts; review the cited excerpts.",
        evidence_ids=ids,
    ), method


def _build_match(profile: CandidateProfile, job: Any) -> tuple[CandidateMatchResult, float | None]:
    chunks = _profile_chunks(profile)
    criteria: list[CriterionMatch] = []
    retrieval_methods: set[str] = set()
    for item in job.rubric.criteria:
        criterion_result, method = _score_criterion(
            profile, item.criterion, item.weight_percent,
            item.evidence_to_look_for, job, chunks
        )
        criteria.append(criterion_result)
        if method != "not_applicable":
            retrieval_methods.add(method)

    evaluated = [item for item in criteria if item.status == "scored" and item.score is not None]
    total_weight = sum(item.weight_percent for item in job.rubric.criteria)
    scored_weight = sum(item.weight_percent for item in evaluated)
    match_index = (
        round(sum((item.score or 0) * item.weight_percent for item in evaluated) / scored_weight, 2)
        if scored_weight else None
    )
    coverage_percent = round(100 * scored_weight / max(1, total_weight), 2)

    required_matches = _skill_matches(profile, job.required_skills)
    preferred_matches = _skill_matches(profile, job.preferred_skills)
    matched_required = [item for item in required_matches if item.status == "matched"]
    matched_preferred = [item for item in preferred_matches if item.status == "matched"]

    strengths: list[str] = []
    if matched_required:
        strengths.append(
            "Resume evidence was detected for these required skills: "
            + ", ".join(item.skill for item in matched_required) + "."
        )
    if matched_preferred:
        strengths.append(
            "Resume evidence was detected for these preferred skills: "
            + ", ".join(item.skill for item in matched_preferred) + "."
        )
    for criterion in evaluated:
        if criterion.score is not None and criterion.score >= 70 and criterion.evidence_ids:
            strengths.append(f"{criterion.criterion}: supporting evidence is available for recruiter review.")

    not_detected = [
        f"Required skill not detected in the parsed resume: {item.skill}."
        for item in required_matches if item.status == "not_detected"
    ]
    if job.minimum_experience_months is not None and estimate_experience_months(profile) is None:
        not_detected.append("Experience duration could not be calculated from explicit date ranges.")
    if not job.education_requirements:
        not_detected.append("Education was not scored because the job brief supplied no education requirement.")

    review_flags = [f"{flag.code}: {flag.message}" for flag in profile.review_flags]
    if profile.extraction_status == "needs_review":
        review_flags.append("Candidate profile extraction itself is marked needs_review.")
    if coverage_percent < 60:
        review_flags.append(
            "Less than 60% of the approved rubric weight was evaluable; review missing information before comparing indices."
        )
    if match_index is None:
        review_flags.append("No rubric criteria could be scored from the available evidence.")

    retrieval_method = "+".join(sorted(retrieval_methods)) if retrieval_methods else "no-retrievable-evidence"
    result = CandidateMatchResult(
        rank=0,
        candidate_id=profile.candidate_id,
        source_file=profile.source_file,
        evidence_alignment_index=match_index,
        evidence_coverage_percent=coverage_percent,
        scored_weight_percent=scored_weight,
        required_skill_matches=required_matches,
        preferred_skill_matches=preferred_matches,
        criteria=criteria,
        strengths_supported_by_evidence=list(dict.fromkeys(strengths)),
        not_detected_or_unverified=list(dict.fromkeys(not_detected)),
        review_flags=list(dict.fromkeys(review_flags)),
        retrieval_method=retrieval_method,
    )
    return result, match_index


def match_candidate_batch(request: CandidateMatchBatchRequest) -> CandidateMatchBatchResponse:
    results_with_scores = [
        _build_match(profile, request.job) for profile in request.candidates
    ]
    results_with_scores.sort(
        key=lambda pair: (
            pair[0].evidence_alignment_index is not None,
            pair[0].evidence_alignment_index if pair[0].evidence_alignment_index is not None else -1,
            pair[0].evidence_coverage_percent,
            pair[0].candidate_id,
        ),
        reverse=True,
    )
    results = []
    for rank, (result, _) in enumerate(results_with_scores, start=1):
        result.rank = rank
        results.append(result)

    return CandidateMatchBatchResponse(
        job_id=request.job.job_id,
        job_title=request.job.job_title,
        processed_candidates=len(results),
        results=results,
    )
