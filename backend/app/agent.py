from __future__ import annotations

import logging
import re
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from app.config import Settings, get_settings
from app.llm import generate_with_ollama
from app.schemas import (
    EvaluationRubric,
    JobDraftContent,
    JobIntelligenceResponse,
    JobRequirementInput,
    ReviewFlag,
    RubricCriterion,
)

logger = logging.getLogger(__name__)


class JobAgentState(TypedDict, total=False):
    brief: JobRequirementInput
    normalized_brief: JobRequirementInput
    status: str
    clarification_questions: list[str]
    review_flags: list[ReviewFlag]
    warnings: list[str]
    content: JobDraftContent
    job_description_markdown: str
    generation_mode: str
    model_name: str
    response: JobIntelligenceResponse


SENSITIVE_CRITERIA_PATTERNS = [
    (r"\b(male|men)\s+only\b", "Gender-specific wording may be inappropriate."),
    (r"\b(female|women)\s+only\b", "Gender-specific wording may be inappropriate."),
    (r"\b(under|below)\s+\d{1,2}\b|\b\d{1,2}\s*(years old|yrs old)\b", "An age-related restriction needs careful legal and job-related review."),
    (r"\b(single|unmarried|married)\s+(candidate|applicant|person)s?\b", "Marital-status criteria should not be used without a lawful, job-specific basis."),
    (r"\b(native english speaker|native speaker)\b", "Native-speaker wording may be unnecessarily exclusionary; specify actual job-related language proficiency."),
    (r"\b(no disabled|able[- ]bodied only)\b", "Disability-related exclusion requires legal and accessibility review."),
    (r"\b(religion|caste|race)\s+(required|preferred|only)\b", "Sensitive personal characteristics should not be used as selection criteria."),
]


def _split_requirement_text(value: str) -> list[str]:
    parts = re.split(r"[\n,;•]+", value or "")
    return list(dict.fromkeys(" ".join(p.split()).strip(" .-") for p in parts if p.strip(" .-")))


def _normalise_brief(brief: JobRequirementInput) -> JobRequirementInput:
    required = brief.required_skills or _split_requirement_text(brief.requirements)
    return brief.model_copy(
        update={
            "required_skills": required,
            "preferred_skills": list(dict.fromkeys(brief.preferred_skills)),
            "responsibilities": list(dict.fromkeys(brief.responsibilities)),
            "education_requirements": list(dict.fromkeys(brief.education_requirements)),
        }
    )


def _find_review_flags(brief: JobRequirementInput) -> list[ReviewFlag]:
    source_text = " ".join(
        [
            brief.job_title,
            brief.requirements,
            brief.additional_context,
            *brief.required_skills,
            *brief.preferred_skills,
            *brief.responsibilities,
        ]
    )
    flags: list[ReviewFlag] = []
    for pattern, message in SENSITIVE_CRITERIA_PATTERNS:
        match = re.search(pattern, source_text, flags=re.IGNORECASE)
        if match:
            flags.append(
                ReviewFlag(
                    category="Potentially sensitive selection criterion",
                    evidence=match.group(0),
                    action=message + " Recruiter review is required before publication.",
                )
            )
    return flags


def _clarification_questions(brief: JobRequirementInput) -> list[str]:
    questions: list[str] = []
    if not (brief.required_skills or brief.requirements.strip() or brief.responsibilities):
        questions.append(
            "What are the role's essential responsibilities and must-have skills? "
            "Please list skills or describe the work the person will perform."
        )
    if not brief.location:
        questions.append("What is the job location?")
    if brief.workplace_type == "unspecified":
        questions.append("Is the role onsite, hybrid, or remote?")
    if not brief.seniority and brief.min_experience_months is None:
        questions.append(
            "What experience level should applicants have (entry-level, mid-level, senior, or a number of years)?"
        )
    if brief.employment_type == "unspecified":
        questions.append(
            "Is this a full-time, part-time, contract, internship, or temporary position?"
        )
    return questions


def _make_fallback_content(brief: JobRequirementInput) -> JobDraftContent:
    required_skills = brief.required_skills or _split_requirement_text(brief.requirements)
    responsibilities = brief.responsibilities or [
        f"Deliver the core responsibilities of the {brief.job_title} role as agreed with the hiring team.",
        "Collaborate with relevant stakeholders and communicate progress, risks, and decisions.",
        "Follow documented professional practices relevant to the role.",
    ]
    criteria = [
        RubricCriterion(
            criterion="Evidence of required job-related skills",
            weight_percent=40,
            evidence_to_look_for=[
                "Specific skills stated in the approved job requirements",
                "Examples demonstrating practical application",
            ],
        ),
        RubricCriterion(
            criterion="Relevant experience and responsibility alignment",
            weight_percent=25,
            evidence_to_look_for=[
                "Work examples relevant to the role",
                "Scope and ownership described by the applicant",
            ],
        ),
        RubricCriterion(
            criterion="Projects, work samples, or demonstrated outcomes",
            weight_percent=20,
            evidence_to_look_for=[
                "Relevant projects or portfolio evidence",
                "Candidate's individual contribution and outcomes",
            ],
        ),
        RubricCriterion(
            criterion="Role-related problem solving",
            weight_percent=10,
            evidence_to_look_for=[
                "Structured approach to a role-relevant problem",
                "Reasoning supported by examples",
            ],
        ),
        RubricCriterion(
            criterion="Communication of job-related evidence",
            weight_percent=5,
            evidence_to_look_for=["Clear explanation of relevant work and decisions"],
        ),
    ]

    experience = "Not specified by the company."
    if brief.min_experience_months is not None:
        experience = f"At least {brief.min_experience_months / 12:g} years of relevant experience."
    if brief.max_experience_months is not None:
        experience += f" Maximum: {brief.max_experience_months / 12:g} years."
    if brief.seniority:
        experience = f"{brief.seniority}. {experience}"

    education = (
        "; ".join(brief.education_requirements)
        if brief.education_requirements
        else "No specific education requirement was provided. Confirm whether one is genuinely necessary."
    )

    return JobDraftContent(
        role_summary=(
            f"{brief.company_name or 'The hiring organisation'} is seeking a {brief.job_title}. "
            "The role will be scoped around responsibilities and qualifications confirmed by the hiring team."
        ),
        responsibilities=responsibilities,
        required_qualifications=[
            "Demonstrate the job-related skills and experience specified in the approved hiring brief."
        ],
        required_skills=required_skills,
        preferred_skills=brief.preferred_skills,
        experience_expectation=experience,
        education_expectation=education,
        success_criteria=[
            "Deliver agreed role outcomes using the required skills.",
            "Provide clear, verifiable examples of relevant work.",
        ],
        rubric=EvaluationRubric(criteria=criteria),
    )


def _normalise_rubric_weights(content: JobDraftContent) -> JobDraftContent:
    criteria = content.rubric.criteria
    total = sum(item.weight_percent for item in criteria)
    if total == 100:
        return content
    scaled = [item.weight_percent * 100 / total for item in criteria]
    floors = [int(value) for value in scaled]
    remainder = 100 - sum(floors)
    order = sorted(
        range(len(criteria)),
        key=lambda index: scaled[index] - floors[index],
        reverse=True,
    )
    for index in order[:remainder]:
        floors[index] += 1
    normalised = [
        item.model_copy(update={"weight_percent": max(1, weight)})
        for item, weight in zip(criteria, floors)
    ]
    difference = 100 - sum(item.weight_percent for item in normalised)
    if difference:
        normalised[0] = normalised[0].model_copy(
            update={"weight_percent": normalised[0].weight_percent + difference}
        )
    rubric = content.rubric.model_copy(update={"criteria": normalised})
    return content.model_copy(update={"rubric": rubric})


def _render_job_description(brief: JobRequirementInput, content: JobDraftContent) -> str:
    company = brief.company_name or "Hiring organisation"
    lines = [
        f"# {brief.job_title}",
        "",
        f"**Company:** {company}",
        f"**Location:** {brief.location or 'Not specified'}",
        f"**Work arrangement:** {brief.workplace_type.replace('_', ' ').title()}",
        f"**Employment type:** {brief.employment_type.replace('_', ' ').title()}",
        f"**Open positions:** {brief.headcount}",
        f"**Compensation:** {brief.salary_budget or 'Not specified'}",
        f"**Hiring timeline:** {brief.hiring_timeline or 'Not specified'}",
        "",
        "## About the role",
        content.role_summary,
        "",
        "## Key responsibilities",
        *[f"- {item}" for item in content.responsibilities],
        "",
        "## Required qualifications",
        *[f"- {item}" for item in content.required_qualifications],
        "",
        "## Must-have skills",
        *([f"- {item}" for item in content.required_skills] or ["- To be confirmed with the hiring team."]),
        "",
        "## Preferred skills",
        *([f"- {item}" for item in content.preferred_skills] or ["- No preferred skills specified."]),
        "",
        "## Experience",
        content.experience_expectation,
        "",
        "## Education",
        content.education_expectation,
        "",
        "## What success looks like",
        *[f"- {item}" for item in content.success_criteria],
        "",
        "## Evaluation process",
        "Candidates will be assessed against the job-related rubric below. The rubric supports consistent review; it does not make an autonomous hiring decision.",
        "",
    ]
    for item in content.rubric.criteria:
        lines.append(f"- **{item.criterion} ({item.weight_percent}%)**")
        for evidence in item.evidence_to_look_for:
            lines.append(f"  - Evidence: {evidence}")
    lines.extend(
        [
            "",
            "## Equal opportunity and accessibility",
            "The hiring team should assess applicants using consistent, job-related criteria and provide reasonable accommodations where applicable. Do not use protected or sensitive personal characteristics as selection criteria.",
            "",
            "## Application",
            "Applicants should submit a current resume and any role-relevant work samples requested by the hiring team.",
        ]
    )
    return "\n".join(lines)


class JobIntelligenceAgent:
    """LangGraph-powered job description and evaluation-rubric agent."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        builder = StateGraph(JobAgentState)
        builder.add_node("normalize", self._normalize_node)
        builder.add_node("assess", self._assess_node)
        builder.add_node("clarify", self._clarify_node)
        builder.add_node("generate", self._generate_node)
        builder.add_node("finalize", self._finalize_node)
        builder.add_edge(START, "normalize")
        builder.add_edge("normalize", "assess")
        builder.add_conditional_edges(
            "assess",
            lambda state: (
                "clarify"
                if state.get("status") == "needs_clarification"
                else "generate"
            ),
            {"clarify": "clarify", "generate": "generate"},
        )
        builder.add_edge("clarify", "finalize")
        builder.add_edge("generate", "finalize")
        builder.add_edge("finalize", END)
        self.graph = builder.compile()

    def _normalize_node(self, state: JobAgentState) -> dict[str, Any]:
        brief = _normalise_brief(state["brief"])
        return {
            "normalized_brief": brief,
            "review_flags": _find_review_flags(brief),
        }

    def _assess_node(self, state: JobAgentState) -> dict[str, Any]:
        brief = state["normalized_brief"]
        questions = _clarification_questions(brief)
        missing_critical_requirements = not (
            brief.required_skills or brief.requirements.strip() or brief.responsibilities
        )
        return {
            "status": "needs_clarification" if missing_critical_requirements else "draft_ready",
            "clarification_questions": questions,
        }

    def _clarify_node(self, state: JobAgentState) -> dict[str, Any]:
        return {
            "generation_mode": "not_generated",
            "warnings": [
                "A draft was not generated because essential role requirements are missing."
            ],
        }

    async def _generate_node(self, state: JobAgentState) -> dict[str, Any]:
        brief = state["normalized_brief"]
        warnings: list[str] = []
        generation_mode = "template_fallback"
        model_name = None

        if self.settings.llm_enabled:
            try:
                content = await generate_with_ollama(brief, self.settings)
                content = _normalise_rubric_weights(content)
                generation_mode = "ollama"
                model_name = self.settings.ollama_model
            except Exception as exc:
                logger.warning("Local LLM unavailable; using deterministic fallback: %s", exc)
                warnings.append(
                    "The local LLM could not be reached or returned invalid structured output. "
                    "A deterministic template was used instead; this is not an LLM-generated draft."
                )
                content = _make_fallback_content(brief)
        else:
            content = _make_fallback_content(brief)
            warnings.append("LLM generation is disabled; a deterministic template was used.")

        return {
            "content": content,
            "job_description_markdown": _render_job_description(brief, content),
            "rubric": content.rubric,
            "required_skills": content.required_skills,
            "preferred_skills": content.preferred_skills,
            "generation_mode": generation_mode,
            "model_name": model_name,
            "warnings": warnings,
        }

    def _finalize_node(self, state: JobAgentState) -> dict[str, Any]:
        if state.get("status") == "needs_clarification":
            response = JobIntelligenceResponse(
                status="needs_clarification",
                clarification_questions=state.get("clarification_questions", []),
                review_flags=state.get("review_flags", []),
                warnings=state.get("warnings", []),
                generation_mode="not_generated",
                requires_company_approval=True,
            )
            return {"response": response}

        response = JobIntelligenceResponse(
            status="draft_ready",
            job_description_markdown=state["job_description_markdown"],
            structured_job=state["content"],
            rubric=state["rubric"],
            required_skills=state.get("required_skills", []),
            preferred_skills=state.get("preferred_skills", []),
            clarification_questions=state.get("clarification_questions", []),
            review_flags=state.get("review_flags", []),
            warnings=state.get("warnings", []),
            generation_mode=state["generation_mode"],
            model_name=state.get("model_name"),
            requires_company_approval=True,
        )
        return {"response": response}

    async def draft(self, brief: JobRequirementInput) -> JobIntelligenceResponse:
        state = await self.graph.ainvoke({"brief": brief})
        return state["response"]
