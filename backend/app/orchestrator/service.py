from __future__ import annotations

from collections import Counter
from uuid import uuid4

from app.orchestrator.schemas import (
    CandidateOrchestrationState,
    OrchestrationCounts,
    OrchestrationPlanRequest,
    OrchestrationPlanResponse,
    OrchestrationTask,
    TaskStatus,
)


def _task(
    agent_number: int,
    agent_name: str,
    scope_ref: str,
    status: TaskStatus,
    action: str,
    blockers: list[str] | None = None,
    dependencies: list[int] | None = None,
) -> OrchestrationTask:
    return OrchestrationTask(
        agent_number=agent_number,
        agent_name=agent_name,
        scope_ref=scope_ref,
        status=status,
        recommended_action=action,
        blockers=blockers or [],
        dependencies=dependencies or [],
        requires_human_approval=True,
    )


def _candidate_tasks(
    candidate: CandidateOrchestrationState,
    job_approved: bool,
) -> list[OrchestrationTask]:
    ref = candidate.candidate_ref
    tasks: list[OrchestrationTask] = []

    # Agent 2 — Candidate Intelligence
    if not job_approved:
        tasks.append(_task(
            2, "Candidate Intelligence", ref, "blocked",
            "Process and validate the candidate resume after the role is approved.",
            ["Job description and rubric approval is required before role-specific processing."],
            [1],
        ))
    elif candidate.profile_ready:
        tasks.append(_task(2, "Candidate Intelligence", ref, "completed",
                           "Candidate profile is marked ready for recruiter review.", dependencies=[1]))
    else:
        tasks.append(_task(2, "Candidate Intelligence", ref, "ready",
                           "Upload the consented resume and run structured candidate extraction.", dependencies=[1]))

    # Agent 3 — Matching & Ranking
    if not job_approved or not candidate.profile_ready:
        blockers = []
        if not job_approved:
            blockers.append("The job description and evaluation rubric are not approved.")
        if not candidate.profile_ready:
            blockers.append("A structured candidate profile is not available.")
        tasks.append(_task(3, "Matching & Ranking", ref, "blocked",
                           "Review job-related, evidence-backed matching once its inputs are ready.",
                           blockers, [1, 2]))
    elif candidate.matching_reviewed:
        tasks.append(_task(3, "Matching & Ranking", ref, "completed",
                           "Recruiter has reviewed the evidence-backed matching output.", dependencies=[1, 2]))
    else:
        tasks.append(_task(3, "Matching & Ranking", ref, "ready",
                           "Run explainable matching and have the recruiter review evidence and flags.", dependencies=[1, 2]))

    # Agent 4 — Communication
    if not candidate.communication_consent_confirmed:
        tasks.append(_task(4, "Communication", ref, "blocked",
                           "Obtain and record candidate communication consent before preparing personalised outreach.",
                           ["Candidate communication consent has not been confirmed."], [2]))
    elif candidate.communication_status in {"approved", "external_delivery_recorded", "responded"}:
        tasks.append(_task(4, "Communication", ref, "completed",
                           "Communication draft approval or externally recorded communication step is complete.",
                           dependencies=[2]))
    elif candidate.communication_status == "drafted":
        tasks.append(_task(4, "Communication", ref, "ready",
                           "Review the communication draft and record recruiter approval.", dependencies=[2]))
    else:
        tasks.append(_task(4, "Communication", ref, "ready",
                           "Prepare a recruiter-reviewable acknowledgement or status communication draft.", dependencies=[2]))

    # Agent 5 — AI Interview
    if candidate.recruiter_decision not in {"advance", "hire_approved"}:
        tasks.append(_task(5, "AI Interview", ref, "blocked",
                           "Wait for an explicit recruiter decision to advance the candidate.",
                           ["Candidate has not been explicitly advanced by the recruiter."], [3]))
    elif not candidate.matching_reviewed:
        tasks.append(_task(5, "AI Interview", ref, "blocked",
                           "Complete recruiter review of the explainable matching result before interview planning.",
                           ["Matching and ranking evidence has not been reviewed by the recruiter."], [3]))
    elif not candidate.interview_consent_confirmed:
        tasks.append(_task(5, "AI Interview", ref, "blocked",
                           "Confirm candidate consent before preparing or processing interview responses.",
                           ["Candidate interview consent has not been confirmed."], [3]))
    elif candidate.interview_status == "completed":
        tasks.append(_task(5, "AI Interview", ref, "completed",
                           "Recruiter-led interview is marked complete; retain human review of the evidence.",
                           dependencies=[3]))
    elif candidate.interview_status == "needs_review":
        tasks.append(_task(5, "AI Interview", ref, "needs_human_review",
                           "A recruiter must resolve the interview review flags before proceeding.",
                           ["Interview response or evaluation requires human review."], [3]))
    elif candidate.interview_status == "scheduled":
        tasks.append(_task(5, "AI Interview", ref, "waiting_external_action",
                           "Conduct the interview through the authorised recruiter-led process and record its outcome.",
                           ["Interview conduct and outcome recording are human-controlled."], [3]))
    else:
        tasks.append(_task(5, "AI Interview", ref, "ready",
                           "Prepare the role-specific question plan for a recruiter-led interview.", dependencies=[3]))

    # Agent 6 — Background Verification
    if candidate.recruiter_decision not in {"advance", "hire_approved"}:
        tasks.append(_task(6, "Background Verification", ref, "blocked",
                           "Wait for an explicit recruiter advance decision.",
                           ["Recruiter advancement is required before verification."], [5]))
    elif candidate.interview_status != "completed":
        tasks.append(_task(6, "Background Verification", ref, "blocked",
                           "Complete and review the recruiter-led interview before starting background verification.",
                           ["Interview is not marked completed and reviewed."], [5]))
    elif not candidate.verification_consent_confirmed:
        tasks.append(_task(6, "Background Verification", ref, "blocked",
                           "Obtain candidate authorisation for each proportionate, lawful check.",
                           ["Candidate verification consent has not been confirmed."], [5]))
    elif candidate.verification_status == "completed":
        tasks.append(_task(6, "Background Verification", ref, "completed",
                           "Verification checks are marked complete; retain source evidence and recruiter review.",
                           dependencies=[5]))
    elif candidate.verification_status in {"discrepancy", "unable_to_verify"}:
        tasks.append(_task(6, "Background Verification", ref, "needs_human_review",
                           "Resolve the discrepancy or unavailable source with an authorised reviewer; do not auto-reject.",
                           ["Verification requires a documented human resolution."], [5]))
    elif candidate.verification_status == "in_progress":
        tasks.append(_task(6, "Background Verification", ref, "waiting_external_action",
                           "Complete the authorised manual or licensed-provider checks and return the evidence for review.",
                           ["An authorised source/provider must complete the check."], [5]))
    else:
        tasks.append(_task(6, "Background Verification", ref, "ready",
                           "Prepare the candidate-authorised verification checklist for an eligible candidate.",
                           dependencies=[5]))

    # Agent 7 — Offer Management & Onboarding
    if candidate.offer_status in {"declined", "withdrawn"}:
        tasks.append(_task(7, "Offer & Onboarding", ref, "not_applicable",
                           "This offer path is closed; a recruiter must decide whether a new process is appropriate.",
                           dependencies=[6]))
    elif candidate.verification_status in {"discrepancy", "unable_to_verify"}:
        tasks.append(_task(7, "Offer & Onboarding", ref, "needs_human_review",
                           "Resolve the verification discrepancy or unavailable source with an authorised reviewer before any offer.",
                           ["Background verification requires a documented human resolution."], [6]))
    elif candidate.recruiter_decision != "hire_approved":
        tasks.append(_task(7, "Offer & Onboarding", ref, "blocked",
                           "Obtain an explicit final hire approval from an authorised recruiter.",
                           ["Final recruiter hire approval is not recorded."], [5, 6]))
    elif candidate.interview_status != "completed":
        tasks.append(_task(7, "Offer & Onboarding", ref, "blocked",
                           "Complete and review the recruiter-led interview before preparing an offer.",
                           ["Interview is not marked completed and reviewed."], [5]))
    elif candidate.verification_status != "completed":
        tasks.append(_task(7, "Offer & Onboarding", ref, "blocked",
                           "Complete the background verification review before preparing an offer.",
                           ["Background verification is not marked complete."], [6]))
    elif candidate.offer_status == "accepted":
        if candidate.onboarding_status == "completed":
            tasks.append(_task(7, "Offer & Onboarding", ref, "completed",
                               "Offer acceptance and onboarding checklist are marked complete.", dependencies=[6]))
        elif candidate.onboarding_status == "in_progress":
            tasks.append(_task(7, "Offer & Onboarding", ref, "waiting_external_action",
                               "Continue HR, manager, IT and candidate onboarding tasks in authorised systems.",
                               ["Onboarding tasks are still in progress."], [6]))
        else:
            tasks.append(_task(7, "Offer & Onboarding", ref, "ready",
                               "Create the onboarding checklist after the recorded offer acceptance.", dependencies=[6]))
    elif candidate.offer_status in {"draft", "approved", "sent"}:
        tasks.append(_task(7, "Offer & Onboarding", ref, "waiting_external_action",
                           "Continue the recruiter-controlled offer review and record the candidate response when received.",
                           ["Offer approval, delivery and response are not performed automatically."], [6]))
    else:
        tasks.append(_task(7, "Offer & Onboarding", ref, "ready",
                           "Prepare a non-binding offer draft using HR-approved terms and approval references.", dependencies=[6]))

    return tasks


def build_orchestration_plan(
    request: OrchestrationPlanRequest,
) -> OrchestrationPlanResponse:
    job_approved = request.job_status == "approved"
    tasks: list[OrchestrationTask] = []

    # Agent 1 — Job Intelligence
    if job_approved:
        tasks.append(_task(1, "Job Intelligence", request.role_ref, "completed",
                           "Approved job description and evaluation rubric are available."))
    elif request.job_status == "draft":
        tasks.append(_task(1, "Job Intelligence", request.role_ref, "ready",
                           "Review and approve the job description and evaluation rubric."))
    else:
        tasks.append(_task(1, "Job Intelligence", request.role_ref, "ready",
                           "Create the role brief and generate a recruiter-reviewable job description and rubric."))

    if request.candidate is not None:
        tasks.extend(_candidate_tasks(request.candidate, job_approved))
    else:
        for number, name in [
            (2, "Candidate Intelligence"),
            (3, "Matching & Ranking"),
            (4, "Communication"),
            (5, "AI Interview"),
            (6, "Background Verification"),
            (7, "Offer & Onboarding"),
        ]:
            tasks.append(_task(
                number, name, request.role_ref, "blocked",
                "A pseudonymous candidate workflow snapshot is required to plan this agent.",
                ["Select a candidate and provide only the necessary workflow status and consent facts."],
                [1] if number in {2, 3, 4} else [3, 5, 6],
            ))

    # Agent 8 — Recruitment Analytics
    if request.analytics_snapshot_generated:
        tasks.append(_task(8, "Recruitment Analytics", request.role_ref, "completed",
                           "Recruitment analytics snapshot is marked generated."))
    elif request.candidate_count_in_pipeline > 0:
        tasks.append(_task(8, "Recruitment Analytics", request.role_ref, "ready",
                           "Generate an aggregate recruitment analytics snapshot from available pipeline records."))
    else:
        tasks.append(_task(8, "Recruitment Analytics", request.role_ref, "blocked",
                           "Load candidate pipeline records before generating analytics.",
                           ["No candidate records are available for the role."]))

    # Agent 9 — Workforce Planning
    if request.workforce_forecast_generated:
        tasks.append(_task(9, "Workforce Planning", request.role_ref, "completed",
                           "Workforce forecast is marked generated."))
    elif (
        request.workforce_history_months_available >= 3
        and request.workforce_assumptions_confirmed
    ):
        tasks.append(_task(9, "Workforce Planning", request.role_ref, "ready",
                           "Generate a workforce demand and capacity scenario using the verified aggregate history."))
    else:
        blockers = []
        if request.workforce_history_months_available < 3:
            blockers.append("At least three consecutive months of aggregate workforce history are required.")
        if not request.workforce_assumptions_confirmed:
            blockers.append("HR/business owners must confirm current/target headcount, capacity and attrition assumptions.")
        tasks.append(_task(9, "Workforce Planning", request.role_ref, "blocked",
                           "Collect aggregate workforce history and confirm planning assumptions.", blockers))

    status_counts = Counter(task.status for task in tasks)
    total = len(tasks)
    completed = status_counts["completed"]
    completion = round((completed / total) * 100, 1) if total else 0.0
    counts = OrchestrationCounts(
        total=total,
        completed=completed,
        ready=status_counts["ready"],
        blocked=status_counts["blocked"],
        needs_human_review=status_counts["needs_human_review"],
        waiting_external_action=status_counts["waiting_external_action"],
        not_applicable=status_counts["not_applicable"],
    )
    next_actions = [
        task for task in tasks
        if task.status in {"ready", "needs_human_review"}
    ]
    warnings = [
        "Agent 10 produces a plan only. It does not dispatch or invoke Agents 1–9.",
        "All state and approval facts are supplied by the client; production needs authenticated, server-authoritative workflow state and immutable audit history.",
    ]
    if request.candidate is not None:
        if request.candidate.recruiter_decision == "not_proceeding":
            warnings.append(
                "The recruiter has marked this candidate as not proceeding. The planner will not recommend interview, verification or offer progression."
            )
        if request.candidate.verification_status in {"discrepancy", "unable_to_verify"}:
            warnings.append(
                "A verification discrepancy or unavailable source requires human resolution and is never an automatic rejection."
            )
    if request.candidate_count_in_pipeline > 0 and request.candidate is None:
        warnings.append(
            "Role-level analytics can be planned, but candidate-specific dependencies cannot be evaluated until a pseudonymous candidate snapshot is supplied."
        )

    return OrchestrationPlanResponse(
        orchestration_id="ORCH-" + uuid4().hex[:12].upper(),
        role_ref=request.role_ref,
        candidate_ref=request.candidate.candidate_ref if request.candidate else None,
        tasks=tasks,
        next_actions=next_actions,
        counts=counts,
        completion_percent=completion,
        warnings=warnings,
    )
