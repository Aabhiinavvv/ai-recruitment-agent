"""
Scoring Engine — Multi-Dimensional Candidate-Job Matching
==========================================================
Implements the 6-dimension weighted scoring framework from Research Area 6:

  Dimension          Weight   Method
  ─────────────────────────────────────────────────────────────
  Technical Skills    30%    Per-skill RAG/LLM scores + keyword
  Experience          20%    Rule-based years + seniority match
  Education           10%    Degree-level rubric match
  Projects            15%    Semantic similarity to JD
  Domain Knowledge    15%    Concept/tool overlap
  Communication       10%    Interview evaluation (default 70)
  ─────────────────────────────────────────────────────────────
  TOTAL              100%

Usage
-----
    from scoring_engine import compute_multidim_score

    result = compute_multidim_score(
        resume_text="...",
        jd_text="...",
        required_skills=["Python", "ML", "SQL"],
        skill_scores={"Python": 9, "ML": 7, "SQL": 5},
        interview_eval={"score": 82, "notes": "Clear communicator"},  # optional
    )
    # result["final_score"]           → 83.4
    # result["dimension_scores"]      → {"technical": 88, "experience": 78, ...}
    # result["dimension_evidence"]    → human-readable evidence per dimension
"""

from __future__ import annotations

import re
import math
from typing import TypedDict


# ---------------------------------------------------------------------------
# Weights (must sum to 1.0)
# ---------------------------------------------------------------------------

DIMENSION_WEIGHTS: dict[str, float] = {
    "technical":     0.30,
    "experience":    0.20,
    "education":     0.10,
    "projects":      0.15,
    "domain":        0.15,
    "communication": 0.10,
}

assert abs(sum(DIMENSION_WEIGHTS.values()) - 1.0) < 1e-9, "Dimension weights must sum to 1.0"

# Degree levels for education scoring
DEGREE_LEVELS: dict[str, int] = {
    "phd": 5, "doctorate": 5, "d.phil": 5,
    "mtech": 4, "m.tech": 4, "msc": 4, "m.sc": 4, "ms": 4, "mba": 4,
    "master": 4, "pg diploma": 3, "pgd": 3,
    "btech": 3, "b.tech": 3, "be": 3, "b.e": 3, "bsc": 3, "b.sc": 3,
    "ba": 2, "b.a": 2, "bca": 2, "bcom": 2, "b.com": 2,
    "diploma": 1, "associate": 1,
    "10th": 0, "12th": 0, "ssc": 0, "hsc": 0,
}

# Seniority levels for experience scoring
SENIORITY_LEVELS: dict[str, int] = {
    "intern": 0, "trainee": 0, "apprentice": 0,
    "junior": 1, "associate": 1, "entry": 1,
    "mid": 2, "engineer": 2, "developer": 2, "analyst": 2,
    "senior": 3, "sr": 3, "lead": 3, "principal": 3,
    "staff": 4, "manager": 3, "tech lead": 3,
    "director": 5, "head": 5, "vp": 5, "chief": 5, "cto": 5,
}

# Minimum years typically expected per seniority
SENIORITY_MIN_YEARS: dict[int, float] = {
    0: 0, 1: 0, 2: 2, 3: 5, 4: 8, 5: 12
}


# ---------------------------------------------------------------------------
# Output type
# ---------------------------------------------------------------------------

class MultidimScore(TypedDict):
    final_score: float
    dimension_scores: dict[str, float]      # {dimension: 0-100}
    dimension_evidence: dict[str, str]       # human-readable evidence
    weighted_contributions: dict[str, float] # {dimension: weighted_score}
    strengths: list[str]
    gaps: list[str]
    recommendation: str                      # "Advance" | "Hold" | "Reject"
    disclaimer: str
    assessment_method: str


_DISCLAIMER = (
    "This multi-dimensional score is advisory only. All hiring decisions must be "
    "reviewed and approved by a human recruiter. Scores reflect job-related evidence "
    "only and do not consider any protected characteristics."
)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_multidim_score(
    resume_text: str,
    jd_text: str,
    required_skills: list[str],
    skill_scores: dict[str, float],
    interview_eval: dict | None = None,
    cutoff_score: float = 75.0,
) -> MultidimScore:
    """
    Compute the full 6-dimension weighted score for a candidate.

    Parameters
    ----------
    resume_text:    Full resume text (after PII redaction)
    jd_text:        Job description text (may be empty string)
    required_skills: Skills list extracted from JD / recruiter input
    skill_scores:   {skill: 0-10} from analyze_skills (LLM or keyword)
    interview_eval: Optional dict with "score" (0-100) and "notes" keys
    cutoff_score:   Threshold for Advance vs Hold recommendation

    Returns
    -------
    MultidimScore TypedDict
    """
    scores: dict[str, float] = {}
    evidence: dict[str, str] = {}

    # ── 1. Technical Skills (30%) ──────────────────────────────────────────
    scores["technical"], evidence["technical"] = _score_technical(
        skill_scores, required_skills
    )

    # ── 2. Experience (20%) ───────────────────────────────────────────────
    scores["experience"], evidence["experience"] = _score_experience(
        resume_text, jd_text
    )

    # ── 3. Education (10%) ───────────────────────────────────────────────
    scores["education"], evidence["education"] = _score_education(
        resume_text, jd_text
    )

    # ── 4. Projects (15%) ────────────────────────────────────────────────
    scores["projects"], evidence["projects"] = _score_projects(
        resume_text, jd_text, required_skills
    )

    # ── 5. Domain Knowledge (15%) ────────────────────────────────────────
    scores["domain"], evidence["domain"] = _score_domain(
        resume_text, jd_text, required_skills
    )

    # ── 6. Communication (10%) ───────────────────────────────────────────
    scores["communication"], evidence["communication"] = _score_communication(
        interview_eval
    )

    # ── Weighted composite ────────────────────────────────────────────────
    weighted = {
        dim: round(scores[dim] * DIMENSION_WEIGHTS[dim], 2)
        for dim in DIMENSION_WEIGHTS
    }
    final = round(sum(weighted.values()), 2)

    # ── Strengths & Gaps ──────────────────────────────────────────────────
    strengths = [dim for dim, s in scores.items() if s >= 75]
    gaps = [dim for dim, s in scores.items() if s < 55]

    # ── Recommendation ───────────────────────────────────────────────────
    if final >= cutoff_score:
        recommendation = "Advance"
    elif final >= cutoff_score * 0.85:
        recommendation = "Hold — borderline, review manually"
    else:
        recommendation = "Reject — below threshold"

    return MultidimScore(
        final_score=final,
        dimension_scores={d: round(s, 1) for d, s in scores.items()},
        dimension_evidence=evidence,
        weighted_contributions=weighted,
        strengths=strengths,
        gaps=gaps,
        recommendation=recommendation,
        disclaimer=_DISCLAIMER,
        assessment_method="Multi-dimensional weighted scoring (Technical 30%, Experience 20%, Education 10%, Projects 15%, Domain 15%, Communication 10%)",
    )


# ---------------------------------------------------------------------------
# Dimension scorers
# ---------------------------------------------------------------------------

def _score_technical(
    skill_scores: dict[str, float],
    required_skills: list[str],
) -> tuple[float, str]:
    """
    Convert per-skill 0-10 scores into a 0-100 technical dimension score.
    Applies depth weighting: skills scored 8+ are "demonstrated", 5-7 "familiar", <5 "gap".
    """
    if not skill_scores or not required_skills:
        return 0.0, "No skill scores available."

    scored_skills = [s for s in required_skills if s in skill_scores]
    if not scored_skills:
        return 0.0, "No required skills were scored."

    total = sum(skill_scores[s] for s in scored_skills)
    raw = (total / (10.0 * len(scored_skills))) * 100

    demonstrated = [s for s in scored_skills if skill_scores[s] >= 8]
    familiar = [s for s in scored_skills if 5 <= skill_scores[s] < 8]
    gaps = [s for s in scored_skills if skill_scores[s] < 5]

    evidence_parts = []
    if demonstrated:
        evidence_parts.append(f"Strong evidence: {', '.join(demonstrated)}")
    if familiar:
        evidence_parts.append(f"Familiar: {', '.join(familiar)}")
    if gaps:
        evidence_parts.append(f"Gaps: {', '.join(gaps)}")
    evidence = ". ".join(evidence_parts) or "Skill evidence not available."

    return round(min(raw, 100.0), 1), evidence


def _score_experience(
    resume_text: str,
    jd_text: str,
) -> tuple[float, str]:
    """
    Score experience dimension:
    - Extract total years from resume (date range parsing)
    - Extract required years from JD
    - Match seniority level
    """
    candidate_years = _extract_total_experience_years(resume_text)
    required_years = _extract_required_years(jd_text)
    candidate_level = _extract_seniority_level(resume_text)
    required_level = _extract_seniority_level(jd_text)

    # Years alignment (60% of dimension)
    if required_years and required_years > 0:
        years_ratio = min(1.0, candidate_years / required_years)
    else:
        years_ratio = 1.0 if candidate_years >= 1 else 0.5

    years_score = years_ratio * 60.0

    # Seniority match (40% of dimension)
    if required_level is not None and candidate_level is not None:
        level_diff = candidate_level - required_level
        if level_diff >= 0:      # meets or exceeds
            seniority_score = 40.0
        elif level_diff == -1:   # one level below
            seniority_score = 25.0
        else:                    # significantly below
            seniority_score = 10.0
    else:
        seniority_score = 20.0   # no clear signal → neutral

    total = years_score + seniority_score

    # Evidence
    parts = []
    if candidate_years > 0:
        parts.append(f"{candidate_years:.1f} years detected in resume")
    if required_years:
        parts.append(f"JD requires {required_years:.0f}+ years")
    if candidate_level is not None:
        level_names = {v: k for k, v in SENIORITY_LEVELS.items() if k.isalpha()}
        parts.append(f"Candidate seniority: {candidate_level}")
    evidence = ". ".join(parts) if parts else "Experience details not parsed."

    return round(min(total, 100.0), 1), evidence


def _score_education(
    resume_text: str,
    jd_text: str,
) -> tuple[float, str]:
    """
    Compare candidate's highest degree vs JD-stated minimum education.
    Maps degree levels to ordinal scores and gaps/matches accordingly.
    """
    candidate_level = _extract_degree_level(resume_text)
    required_level = _extract_degree_level(jd_text)

    if candidate_level is None:
        return 50.0, "Education details not clearly detected in resume."

    candidate_score = candidate_level * 20  # 0 → 0, 5 → 100

    if required_level is None:
        # No explicit requirement — score based on candidate degree alone
        score = min(candidate_score, 100.0)
        evidence = f"Candidate degree level: {candidate_level}/5 (no explicit JD requirement detected)."
    else:
        gap = candidate_level - required_level
        if gap >= 0:
            score = min(80.0 + gap * 5, 100.0)
            evidence = f"Meets or exceeds education requirement (candidate: {candidate_level}/5, required: {required_level}/5)."
        elif gap == -1:
            score = 65.0
            evidence = f"One degree level below requirement (candidate: {candidate_level}/5, required: {required_level}/5)."
        else:
            score = max(30.0, 50.0 + gap * 10)
            evidence = f"Below education requirement by {abs(gap)} level(s) (candidate: {candidate_level}/5, required: {required_level}/5)."

    return round(score, 1), evidence


def _score_projects(
    resume_text: str,
    jd_text: str,
    required_skills: list[str],
) -> tuple[float, str]:
    """
    Score project alignment with JD by measuring how many required skills/concepts
    appear in the Projects section of the resume.
    Uses keyword overlap as the primary signal; returns 60 if no project section found.
    """
    project_text = _extract_section_text(resume_text, ("project", "portfolio", "open source"))

    if not project_text:
        return 60.0, "No dedicated projects section detected; default neutral score assigned."

    jd_keywords = _extract_keywords(jd_text) | set(s.lower() for s in required_skills)
    project_keywords = _extract_keywords(project_text)

    if not jd_keywords:
        # Fall back to checking if required skills appear in project section
        matched = [s for s in required_skills if s.lower() in project_text.lower()]
        coverage = len(matched) / max(len(required_skills), 1)
        evidence = f"{len(matched)}/{len(required_skills)} required skills found in projects."
        return round(50 + coverage * 50, 1), evidence

    overlap = jd_keywords & project_keywords
    coverage = len(overlap) / max(len(jd_keywords), 1)
    score = round(40 + coverage * 60, 1)

    top_matches = sorted(overlap)[:6]
    evidence = (
        f"{len(overlap)} concept(s) from JD found in projects section"
        + (f": {', '.join(top_matches)}" if top_matches else "")
        + "."
    )
    return min(score, 100.0), evidence


def _score_domain(
    resume_text: str,
    jd_text: str,
    required_skills: list[str],
) -> tuple[float, str]:
    """
    Score domain knowledge by measuring overlap between:
    - JD concepts/tools/frameworks
    - All resume content (not just projects)
    Weighted by specificity of matched terms.
    """
    if not jd_text and not required_skills:
        return 70.0, "No JD provided; domain score defaulted to neutral."

    jd_keywords = _extract_keywords(jd_text) | set(s.lower() for s in required_skills)
    resume_keywords = _extract_keywords(resume_text)

    if not jd_keywords:
        return 70.0, "JD keywords could not be parsed."

    overlap = jd_keywords & resume_keywords
    coverage = len(overlap) / max(len(jd_keywords), 1)

    # Penalise very low coverage, reward high coverage
    if coverage >= 0.7:
        score = 90.0 + (coverage - 0.7) * 33.3   # 90–100
    elif coverage >= 0.4:
        score = 65.0 + (coverage - 0.4) * 83.3   # 65–90
    else:
        score = coverage * 162.5                   # 0–65

    top_matches = sorted(overlap)[:8]
    evidence = (
        f"{len(overlap)}/{len(jd_keywords)} JD concepts found in resume"
        + (f": {', '.join(top_matches)}" if top_matches else "")
        + "."
    )
    return round(min(score, 100.0), 1), evidence


def _score_communication(
    interview_eval: dict | None,
) -> tuple[float, str]:
    """
    Score communication based on interview evaluation if available.
    Returns a neutral default (70) pre-interview.
    """
    if not interview_eval:
        return 70.0, "No interview data yet; communication defaulted to 70 (neutral pre-interview)."

    raw_score = interview_eval.get("score")
    notes = str(interview_eval.get("notes") or interview_eval.get("feedback") or "")

    if isinstance(raw_score, (int, float)) and 0 <= raw_score <= 100:
        score = float(raw_score)
        evidence = f"Interview communication score: {score:.0f}/100."
        if notes:
            evidence += f" Notes: {notes[:200]}"
        return round(score, 1), evidence

    # Try to parse score from notes text
    match = re.search(r"(\d{1,3})\s*/\s*100", notes)
    if match:
        score = min(float(match.group(1)), 100.0)
        return round(score, 1), f"Score extracted from notes: {score:.0f}/100."

    return 70.0, "Interview data present but score not parseable; defaulted to 70."


# ---------------------------------------------------------------------------
# Parsers / helpers
# ---------------------------------------------------------------------------

def _extract_total_experience_years(text: str) -> float:
    """
    Estimate total years of experience by summing up non-overlapping date ranges.
    Simple heuristic: finds (YYYY – YYYY|present) patterns and sums durations.
    """
    import datetime  # noqa: PLC0415
    current_year = datetime.date.today().year

    date_range_pat = re.compile(
        r"\b((?:19|20)\d{2})\s*[-–—to]+\s*((?:19|20)\d{2}|present|current|now|till date)\b",
        re.IGNORECASE,
    )
    total_years = 0.0
    for m in date_range_pat.finditer(text):
        start = int(m.group(1))
        end_raw = m.group(2).lower()
        end = current_year if end_raw in ("present", "current", "now", "till date") else int(end_raw)
        if start <= end <= current_year + 1:
            total_years += max(0, end - start)

    # Cap at 40 (sanity check) and clamp overlapping ranges roughly to 60% of sum
    return min(total_years * 0.65, 40.0) if total_years > 5 else total_years


def _extract_required_years(jd_text: str) -> float | None:
    """Extract minimum years of experience mentioned in a JD (e.g. '3+ years')."""
    if not jd_text:
        return None
    pat = re.compile(r"(\d+)\+?\s*(?:to\s*\d+\s*)?years?\s+(?:of\s+)?(?:experience|exp)", re.IGNORECASE)
    matches = [int(m.group(1)) for m in pat.finditer(jd_text)]
    return float(min(matches)) if matches else None


def _extract_seniority_level(text: str) -> int | None:
    """Return seniority level integer (0–5) from text, or None if not found."""
    if not text:
        return None
    text_lower = text.lower()
    best_level = None
    for keyword, level in sorted(SENIORITY_LEVELS.items(), key=lambda x: len(x[0]), reverse=True):
        if keyword in text_lower:
            if best_level is None or level > best_level:
                best_level = level
    return best_level


def _extract_degree_level(text: str) -> int | None:
    """Return the highest degree level (0–5) found in text, or None."""
    if not text:
        return None
    text_lower = text.lower()
    highest = None
    for degree_key, level in DEGREE_LEVELS.items():
        if degree_key in text_lower:
            if highest is None or level > highest:
                highest = level
    return highest


def _extract_section_text(text: str, section_aliases: tuple[str, ...]) -> str:
    """Extract text from a named section of a resume-like document."""
    if not text:
        return ""
    lines = text.splitlines()
    collecting = False
    collected: list[str] = []

    for line in lines:
        normalized = re.sub(r"\s+", " ", line).strip().lower().strip(":|-– ")
        is_heading = len(normalized) < 50 and any(alias in normalized for alias in section_aliases)
        is_other_heading = (
            len(normalized) < 50
            and not any(alias in normalized for alias in section_aliases)
            and re.match(r"^[a-z]", normalized)
            and len(normalized.split()) <= 5
            and normalized not in ("", "and", "or")
        )

        if is_heading:
            collecting = True
            continue
        elif collecting and is_other_heading and not is_heading:
            break  # hit a different section
        elif collecting:
            collected.append(line.strip())

    return "\n".join(collected)


def _extract_keywords(text: str, min_len: int = 3) -> set[str]:
    """
    Extract meaningful keywords from text.
    Filters common English stop words to focus on technical/domain terms.
    """
    STOPWORDS = {
        "the", "and", "for", "with", "that", "this", "will", "from", "have",
        "are", "was", "were", "has", "been", "you", "our", "your", "their",
        "able", "all", "also", "any", "can", "its", "not", "but", "use",
        "using", "used", "work", "working", "worked", "role", "team", "both",
        "into", "did", "may", "over", "more", "such", "must", "should",
        "which", "what", "when", "where", "who", "how", "than", "then",
        "they", "them", "time", "year", "years", "good", "well", "new",
        "including", "across", "within", "based", "help", "ensure",
    }
    tokens = re.findall(r"[a-zA-Z][a-zA-Z0-9+#.]{" + str(min_len - 1) + r",}", text.lower())
    return {t for t in tokens if t not in STOPWORDS}


# ---------------------------------------------------------------------------
# Score explanation formatter (for UI display)
# ---------------------------------------------------------------------------

def format_score_card(multidim: MultidimScore, cutoff: float = 75.0) -> str:
    """
    Format a MultidimScore as a readable text card for Streamlit display.
    Returns a markdown-formatted string.
    """
    emoji = {"Advance": "✅", "Hold": "⚠️", "Reject": "❌"}
    rec = multidim["recommendation"]
    icon = next((v for k, v in emoji.items() if k in rec), "📊")

    lines = [
        f"### {icon} Composite Score: **{multidim['final_score']:.1f} / 100**",
        f"**Recommendation:** {rec}",
        "",
        "| Dimension | Score | Weight | Contribution | Evidence |",
        "|---|---|---|---|---|",
    ]
    for dim, weight in DIMENSION_WEIGHTS.items():
        score = multidim["dimension_scores"].get(dim, 0)
        contrib = multidim["weighted_contributions"].get(dim, 0)
        evid = multidim["dimension_evidence"].get(dim, "")[:120]
        bar = "█" * int(score / 10) + "░" * (10 - int(score / 10))
        lines.append(
            f"| **{dim.title()}** | {score:.0f} `{bar}` | {weight*100:.0f}% | {contrib:.1f} | {evid} |"
        )

    lines += [
        "",
        f"**Strengths:** {', '.join(s.title() for s in multidim['strengths']) or 'None above threshold'}",
        f"**Gaps:** {', '.join(g.title() for g in multidim['gaps']) or 'None below threshold'}",
        "",
        f"> _{multidim['disclaimer']}_",
    ]
    return "\n".join(lines)
