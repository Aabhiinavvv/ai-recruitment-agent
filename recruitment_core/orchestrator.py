"""LangGraph-based recruitment workflow: validate -> match -> plan -> prepare review.

The specialist nodes here are narrow workflow agents. Candidate scores are
transparent rubric-based decision support; the graph never hires/rejects.
"""
from __future__ import annotations

from typing import Any, Dict, List, TypedDict

from langgraph.graph import END, START, StateGraph

from recruitment_core.matching import CandidateProfile, JobCriteria, score_candidate


class HiringWorkflowState(TypedDict, total=False):
    job: Dict[str, Any]
    candidates: List[Dict[str, Any]]
    criteria: Dict[str, Any]
    matches: List[Dict[str, Any]]
    interview_plan: List[Dict[str, str]]
    verification_plan: List[Dict[str, str]]
    errors: List[str]
    status: str
    summary: Dict[str, Any]


def _job_analysis_agent(state: HiringWorkflowState) -> Dict[str, Any]:
    job = state.get("job") or {}
    title = str(job.get("title") or job.get("role_title") or "").strip()
    required = job.get("required_skills") or []
    preferred = job.get("preferred_skills") or []
    if isinstance(required, str):
        required = [part.strip() for part in required.split(",") if part.strip()]
    if isinstance(preferred, str):
        preferred = [part.strip() for part in preferred.split(",") if part.strip()]
    errors = []
    if not title:
        errors.append("Job title is required.")
    if not required and not preferred:
        errors.append("At least one required or preferred skill is required for matching.")
    return {
        "criteria": {
            "role_title": title,
            "required_skills": required,
            "preferred_skills": preferred,
            "minimum_experience_years": float(job.get("min_exp", job.get("minimum_experience_years", 0)) or 0),
        },
        "errors": errors,
    }


def _candidate_matching_agent(state: HiringWorkflowState) -> Dict[str, Any]:
    criteria = state["criteria"]
    if state.get("errors"):
        return {"matches": []}
    job = JobCriteria(
        role_title=criteria["role_title"],
        required_skills=criteria["required_skills"],
        preferred_skills=criteria["preferred_skills"],
        minimum_experience_years=criteria["minimum_experience_years"],
    )
    matches = []
    for row in state.get("candidates", []):
        raw_skills = row.get("skills", row.get("Skills", []))
        if isinstance(raw_skills, str):
            skills = [part.strip() for part in raw_skills.split(",") if part.strip()]
        else:
            skills = [str(skill).strip() for skill in (raw_skills or []) if str(skill).strip()]
        candidate = CandidateProfile(
            candidate_id=str(row.get("id") or row.get("ID") or row.get("Candidate") or "unknown"),
            skills=skills,
            experience_years=float(row.get("experience_years", row.get("Experience", 0)) or 0),
        )
        result = score_candidate(candidate, job)
        matches.append({
            "candidate_id": candidate.candidate_id,
            "candidate": str(row.get("Candidate") or row.get("name") or candidate.candidate_id),
            "role": job.role_title,
            "score": result.score,
            "matched_required_skills": result.matched_required_skills,
            "missing_required_skills": result.missing_required_skills,
            "matched_preferred_skills": result.matched_preferred_skills,
            "explanation": result.explanation,
            "next_step": "Prioritise for recruiter review" if result.score >= 75 else "Review evidence and criteria",
            "decision": "Pending human review",
        })
    matches.sort(key=lambda item: item["score"], reverse=True)
    return {"matches": matches}


def _interview_planning_agent(state: HiringWorkflowState) -> Dict[str, Any]:
    criteria = state.get("criteria", {})
    required = criteria.get("required_skills", [])
    questions = []
    for skill in required[:8]:
        questions.append({
            "competency": str(skill),
            "question": f"Describe a project or work example where you used {skill}. What was your personal contribution and how did you validate the result?",
            "evaluation_focus": f"Evidence of {skill}, technical reasoning, personal contribution, and verification of claims.",
        })
    questions.append({
        "competency": "Problem solving",
        "question": "Describe a difficult problem relevant to this role, the trade-offs you considered, and the outcome.",
        "evaluation_focus": "Structured reasoning, trade-offs, and concrete evidence.",
    })
    return {"interview_plan": questions}


def _verification_coordination_agent(state: HiringWorkflowState) -> Dict[str, Any]:
    # This creates a checklist only. It does not contact vendors or authorities.
    checks = [
        {"check": "Education", "status": "Not requested", "gate": "Candidate notice/consent + authorised provider/process"},
        {"check": "Employment", "status": "Not requested", "gate": "Candidate notice/consent + authorised provider/process"},
        {"check": "Identity", "status": "Not requested", "gate": "Candidate notice/consent + authorised provider/process"},
        {"check": "Address/background", "status": "Not requested", "gate": "Jurisdiction-specific rules + authorised provider/process"},
    ]
    return {"verification_plan": checks}


def _review_packet_agent(state: HiringWorkflowState) -> Dict[str, Any]:
    matches = state.get("matches", [])
    errors = state.get("errors", [])
    return {
        "status": "needs_job_criteria" if errors else "pending_recruiter_review",
        "summary": {
            "role": (state.get("criteria") or {}).get("role_title", ""),
            "candidate_count": len(matches),
            "review_candidates": sum(1 for row in matches if row["score"] >= 75),
            "required_skills": (state.get("criteria") or {}).get("required_skills", []),
            "errors": errors,
            "human_approval_required": True,
        },
    }


def build_hiring_graph():
    graph = StateGraph(HiringWorkflowState)
    graph.add_node("job_analysis_agent", _job_analysis_agent)
    graph.add_node("candidate_matching_agent", _candidate_matching_agent)
    graph.add_node("interview_planning_agent", _interview_planning_agent)
    graph.add_node("verification_coordination_agent", _verification_coordination_agent)
    graph.add_node("review_packet_agent", _review_packet_agent)
    graph.add_edge(START, "job_analysis_agent")
    graph.add_edge("job_analysis_agent", "candidate_matching_agent")
    graph.add_edge("candidate_matching_agent", "interview_planning_agent")
    graph.add_edge("interview_planning_agent", "verification_coordination_agent")
    graph.add_edge("verification_coordination_agent", "review_packet_agent")
    graph.add_edge("review_packet_agent", END)
    return graph.compile()


def run_hiring_workflow(job: Dict[str, Any], candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Execute a recruitment-planning graph and return a recruiter-review packet."""
    return build_hiring_graph().invoke({"job": job, "candidates": candidates})
