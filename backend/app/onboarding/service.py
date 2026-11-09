from __future__ import annotations

from uuid import uuid4

from app.onboarding.schemas import (
    OfferDraftRequest,
    OfferDraftResponse,
    OfferEventRequest,
    OfferEventResponse,
    OnboardingPlanRequest,
    OnboardingPlanResponse,
    OnboardingTask,
    OnboardingTaskEventRequest,
    OnboardingTaskEventResponse,
)


def create_offer_draft(request: OfferDraftRequest) -> OfferDraftResponse:
    offer_id = "OFR-" + uuid4().hex[:12].upper()
    employment_label = request.employment_type.replace("_", " ").title()
    pay_label = request.pay_frequency.replace("_", " ")
    benefits_text = "\n".join(f"- {item}" for item in request.benefits) or "- No benefits were supplied in this draft."
    terms_text = "\n".join(f"- {item}" for item in request.additional_terms) or "- No additional terms were supplied."
    probation = (
        f"{request.probation_months} month(s)"
        if request.probation_months is not None
        else "Not specified"
    )
    draft_text = (
        f"NON-BINDING OFFER DRAFT — REQUIRES REVIEW\n\n"
        f"Company: {request.company_name}\n"
        f"Candidate reference: {request.candidate_id}\n"
        f"Role: {request.job_title}\n"
        f"Employment type: {employment_label}\n"
        f"Compensation supplied by recruiter: {request.currency} {request.compensation_amount} ({pay_label})\n"
        f"Work mode: {request.work_mode}\n"
        f"Work location: {request.work_location_label}\n"
        f"Proposed start date: {request.start_date.isoformat()}\n"
        f"Offer expiry date: {request.offer_expiry_date.isoformat()}\n"
        f"Probation: {probation}\n\n"
        f"Benefits supplied by recruiter:\n{benefits_text}\n\n"
        f"Additional terms supplied by recruiter:\n{terms_text}\n\n"
        "This is a draft for internal review only. It is not a signed agreement or a binding offer. "
        "The organisation must verify all terms, applicable law and required approvals before issuing it."
    )
    return OfferDraftResponse(
        offer_id=offer_id,
        candidate_id=request.candidate_id,
        job_title=request.job_title,
        company_name=request.company_name,
        employment_type=request.employment_type,
        currency=request.currency,
        compensation_amount=request.compensation_amount,
        pay_frequency=request.pay_frequency,
        work_mode=request.work_mode,
        work_location_label=request.work_location_label,
        start_date=request.start_date,
        offer_expiry_date=request.offer_expiry_date,
        probation_months=request.probation_months,
        benefits=request.benefits,
        additional_terms=request.additional_terms,
        draft_text=draft_text,
    )


OFFER_TRANSITIONS = {
    ("draft_pending_approval", "approve"): "approved_not_sent",
    ("approved_not_sent", "mark_sent"): "sent_outside_platform",
    ("sent_outside_platform", "record_acceptance"): "accepted",
    ("sent_outside_platform", "record_decline"): "declined",
    ("approved_not_sent", "withdraw"): "withdrawn",
    ("sent_outside_platform", "withdraw"): "withdrawn",
    ("sent_outside_platform", "mark_expired"): "expired",
}


def record_offer_event(request: OfferEventRequest) -> OfferEventResponse:
    transition_key = (request.current_status, request.event)
    next_status = OFFER_TRANSITIONS.get(transition_key)
    if not next_status:
        raise ValueError(
            f"Offer event '{request.event}' is not allowed from status '{request.current_status}'."
        )
    return OfferEventResponse(
        offer_id=request.offer_id,
        candidate_id=request.candidate_id,
        previous_status=request.current_status,
        current_status=next_status,  # type: ignore[arg-type]
        event=request.event,
        event_reference=request.event_reference,
        reviewer_note=request.reviewer_note,
    )


def _default_tasks() -> list[tuple[str, str, str, str, bool]]:
    return [
        (
            "employment_documents",
            "Review and sign employment documents",
            "HR prepares the approved documents and collects signatures using the organisation's secure document workflow.",
            "hr",
            True,
        ),
        (
            "role_and_policy_orientation",
            "Complete role and policy orientation",
            "Manager or HR explains role expectations, policies, reporting lines and points of contact.",
            "manager",
            False,
        ),
        (
            "payroll_setup",
            "Complete payroll setup in the secure HR system",
            "Collect payroll and statutory information only in the approved, access-controlled payroll system.",
            "candidate",
            True,
        ),
        (
            "equipment_and_access",
            "Prepare equipment and role-based access",
            "IT provisions only the equipment and least-privilege accounts approved for this role.",
            "it",
            False,
        ),
        (
            "first_week_plan",
            "Prepare first-week goals and check-ins",
            "Manager agrees the first-week plan, support contacts and check-in schedule.",
            "manager",
            False,
        ),
        (
            "training_requirements",
            "Review role-specific training requirements",
            "HR or the manager identifies any training actually required for this role and jurisdiction.",
            "hr",
            False,
        ),
    ]


def create_onboarding_plan(request: OnboardingPlanRequest) -> OnboardingPlanResponse:
    plan_id = "ONB-" + uuid4().hex[:12].upper()
    tasks = [
        OnboardingTask(
            task_id=f"{plan_id}-{code.upper()}",
            title=title,
            description=description,
            owner=owner,  # type: ignore[arg-type]
            evidence_required=evidence_required,
        )
        for code, title, description, owner, evidence_required in _default_tasks()
    ]
    return OnboardingPlanResponse(
        plan_id=plan_id,
        offer_id=request.offer_id,
        candidate_id=request.candidate_id,
        job_title=request.job_title,
        employment_type=request.employment_type,
        start_date=request.start_date,
        tasks=tasks,
    )


def record_onboarding_task_event(
    request: OnboardingTaskEventRequest,
) -> OnboardingTaskEventResponse:
    if not request.task_id.startswith(request.plan_id + "-"):
        raise ValueError("The task ID does not belong to the supplied onboarding plan.")
    return OnboardingTaskEventResponse(
        plan_id=request.plan_id,
        offer_id=request.offer_id,
        candidate_id=request.candidate_id,
        task_id=request.task_id,
        previous_status=request.current_status,
        current_status=request.target_status,
        reviewer_note=request.reviewer_note,
    )
