from datetime import date, datetime, timezone
import json
import math
import re
from typing import Any
from urllib.parse import urlsplit


def rank_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Order candidates by job-related skill evidence only; never make a hiring decision."""
    return sorted(
        candidates,
        key=lambda candidate: (
            -float(candidate.get("overall_score", 0)),
            str(candidate.get("candidate_id", "")),
        ),
    )


def summarize_hiring_funnel(candidates: list[dict[str, Any]]) -> dict[str, Any]:
    """Summarize recorded recruiter outcomes without inferring why they occurred."""
    round_outcomes = {}
    for round_name in ("coding", "technical", "hr"):
        decisions = [
            candidate.get("rounds", {}).get(round_name, {}).get("decision")
            for candidate in candidates
        ]
        passed = decisions.count("pass")
        not_proceeding = decisions.count("not_proceeding")
        round_outcomes[round_name] = {
            "passed": passed,
            "not_proceeding": not_proceeding,
            "pending_or_unrecorded": len(candidates) - passed - not_proceeding,
            "reviewed": passed + not_proceeding,
        }

    advanced = sum(
        candidate.get("recruiter_decision") == "advance"
        for candidate in candidates
    )
    stopped = sum(
        candidate.get("decision_status") == "Not proceeding (recruiter decision)"
        for candidate in candidates
    )
    hired = sum(
        candidate.get("decision_status") == "Hired by recruiter"
        for candidate in candidates
    )
    return {
        "screened": len(candidates),
        "advanced_after_screening": advanced,
        "not_proceeding_total": stopped,
        "hired": hired,
        "screen_to_advance_rate_percent": (
            round(advanced / len(candidates) * 100, 1) if candidates else None
        ),
        "interview_rounds": round_outcomes,
        "recruiting_source_data_available": any(
            candidate.get("source") for candidate in candidates
        ),
        "market_salary_data_available": False,
    }


def build_candidate_profile_sources(
    github_url: str = "",
    linkedin_url: str = "",
    portfolio_url: str = "",
    candidate_submitted_work: str = "",
    university: str = "",
    referral: str = "",
) -> list[dict[str, str]]:
    """Build a profile source list without fetching or verifying external URLs."""
    sources = []
    for source_type, source_ref, value in (
        ("GitHub", "github", github_url),
        ("LinkedIn", "linkedin", linkedin_url),
        ("Portfolio", "portfolio", portfolio_url),
    ):
        url = value.strip()
        if not url:
            continue
        parsed = urlsplit(url)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
        ):
            raise ValueError(f"{source_type} must be a valid HTTPS URL.")
        sources.append(
            {
                "source_type": source_type,
                "source_ref": source_ref,
                "source_location": url,
                "content": "Candidate-provided link only; page content was not accessed or verified.",
            }
        )
    submitted_work = candidate_submitted_work.strip()
    if submitted_work:
        sources.append(
            {
                "source_type": "Candidate-submitted work highlights",
                "source_ref": "candidate_submitted_work",
                "source_location": "",
                "content": submitted_work[:6000],
            }
        )
    for source_ref, source_type, value in (
        ("candidate_university", "Candidate-stated university", university),
        ("candidate_referral", "Candidate-stated referral", referral),
    ):
        details = value.strip()
        if details:
            sources.append(
                {
                    "source_type": source_type,
                    "source_ref": source_ref,
                    "source_location": "",
                    "content": details[:500],
                }
            )
    return sources


def build_workforce_graph(
    job: dict[str, Any] | None,
    candidates: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build a descriptive, active-role graph; it is not a scoring or ranking input."""
    nodes: dict[tuple[str, str], str] = {}
    edges: list[tuple[str, str, str]] = []

    def add_node(kind: str, label: str) -> str:
        key = (kind, label)
        if key not in nodes:
            nodes[key] = f"n{len(nodes)}"
        return nodes[key]

    def connect(source_id: str, target_id: str, relationship: str) -> None:
        edge = (source_id, target_id, relationship)
        if edge not in edges:
            edges.append(edge)

    def add_role_and_candidate(role: dict[str, Any], candidate: dict[str, Any]) -> None:
        company_name = str(role.get("company_name") or "").strip()
        job_title = str(role.get("job_title") or "").strip()
        company_id = add_node("company", company_name) if company_name else None
        role_id = add_node("role", job_title) if job_title else None
        if company_id and role_id:
            connect(company_id, role_id, "open role")
        memory_id = candidate.get("_memory_id")
        candidate_id = str(
            f"Candidate {memory_id[:8]}" if memory_id else candidate.get("candidate_id") or ""
        ).strip()
        if not candidate_id:
            return
        person_id = add_node("person", candidate_id)
        if role_id:
            connect(person_id, role_id, "candidate for")

        for skill in candidate.get("skill_scores", {}):
            skill_name = str(skill).strip()
            if skill_name:
                connect(person_id, add_node("skill", skill_name), "resume skill evidence")

        for source in candidate.get("digital_profile_sources", []):
            if not isinstance(source, dict):
                continue
            source_ref = source.get("source_ref")
            content = str(source.get("content") or "").strip()
            if source_ref == "candidate_submitted_work" and content:
                project_lines = [
                    line.strip(" -*\t")
                    for line in content.splitlines()
                    if line.strip(" -*\t")
                ][:6]
                for project in project_lines:
                    connect(person_id, add_node("project", project[:100]), "submitted work")
            elif source_ref == "candidate_university" and content:
                connect(
                    person_id,
                    add_node("university", content[:100]),
                    "candidate-stated affiliation",
                )
            elif source_ref == "candidate_referral" and content:
                connect(
                    person_id,
                    add_node("referral", content[:100]),
                    "candidate-stated referral",
                )

        for round_name, round_data in candidate.get("rounds", {}).items():
            decision = round_data.get("decision")
            if decision not in {"pass", "not_proceeding"}:
                continue
            outcome_label = f"{round_name.title()} round: {decision.replace('_', ' ')}"
            connect(person_id, add_node("outcome", outcome_label), "recruiter-recorded outcome")

    job = job or {}
    for candidate in candidates:
        add_role_and_candidate(job, candidate)
        memory = candidate.get("organizational_memory")
        if not isinstance(memory, dict):
            continue
        for entry in memory.get("history", []):
            try:
                snapshot = json.loads(entry.get("snapshot_json", "{}"))
            except (TypeError, json.JSONDecodeError):
                continue
            historical_candidate = snapshot.get("candidate", {})
            if not isinstance(historical_candidate, dict):
                continue
            historical_candidate = {
                **historical_candidate,
                "_memory_id": memory.get("memory_id"),
            }
            add_role_and_candidate(snapshot.get("job", {}), historical_candidate)

    palette = {
        "company": "#dbeafe",
        "role": "#ede9fe",
        "person": "#dcfce7",
        "skill": "#fef3c7",
        "project": "#ffedd5",
        "university": "#f3e8ff",
        "referral": "#e0f2fe",
        "outcome": "#fee2e2",
    }
    lines = [
        "digraph Workforce {",
        '  graph [rankdir="LR", bgcolor="transparent", overlap=false, splines=true];',
        '  node [shape="box", style="rounded,filled", fontname="Arial", fontsize=10];',
        '  edge [fontname="Arial", fontsize=8, color="#64748b"];',
    ]
    for (kind, label), node_id in nodes.items():
        lines.append(
            f"  {node_id} [label={json.dumps(label)}, fillcolor={json.dumps(palette[kind])}];"
        )
    for source_id, target_id, relationship in edges:
        lines.append(
            f"  {source_id} -> {target_id} [label={json.dumps(relationship)}];"
        )
    lines.append("}")
    return {
        "dot": "\n".join(lines),
        "node_count": len(nodes),
        "relationship_count": len(edges),
        "candidate_count": sum(kind == "person" for kind, _ in nodes),
        "university_relationships": sum(
            kind == "university" for kind, _ in nodes
        ),
        "performance_data_available": False,
    }


def record_recruiter_decision(
    candidate: dict[str, Any],
    action: str,
) -> dict[str, Any]:
    if action not in {"advance", "not_proceeding"}:
        raise ValueError("Recruiter action must be 'advance' or 'not_proceeding'.")
    if candidate.get("decision_status") != "Pending recruiter review":
        raise ValueError("This candidate already has a recorded recruiter decision.")

    updated = dict(candidate)
    updated["recruiter_decision"] = action
    updated["decision_status"] = (
        "Coding round pending"
        if action == "advance"
        else "Not proceeding (recruiter decision)"
    )
    if action == "advance":
        updated["current_round"] = "coding"
        updated.setdefault("rounds", {})
    return updated


ROUND_ORDER = ("coding", "technical", "hr")

VERIFICATION_CHECKS = {
    "education": "Education / institution",
    "employment": "Past employment",
    "references": "Professional references",
    "identity": "Identity (authorized provider only)",
    "government": "Government record (where legally available)",
    "police": "Police / background vendor (where lawful)",
}
DOCUMENT_VALIDATION_TYPES = {
    "degree": "Degree / university certificate",
    "pan": "PAN card (authorized provider only)",
    "aadhaar": "Aadhaar (lawful, compliant integration only)",
    "passport": "Passport (authorized provider only)",
    "driving_licence": "Driving licence (authorized provider only)",
    "certificates": "Professional certificates",
}
ONBOARDING_TASKS = {
    "email": "Create company email account",
    "slack": "Create Slack account and assign approved workspace access",
    "laptop": "Submit laptop / equipment request",
    "payroll": "Set up payroll using the approved secure process",
    "training": "Assign role-specific training",
    "documents": "Collect required employment documents after acceptance",
}
ONBOARDING_STATUSES = (
    "Draft — approval required",
    "Approved — integration required",
    "In progress",
    "Completed",
    "Blocked",
    "Not applicable",
)
ONBOARDING_TRANSITIONS = {
    "Draft — approval required": {
        "Approved — integration required",
        "Blocked",
        "Not applicable",
    },
    "Approved — integration required": {"In progress", "Blocked", "Not applicable"},
    "In progress": {"Completed", "Blocked", "Not applicable"},
    "Blocked": {"Approved — integration required", "In progress", "Not applicable"},
    "Completed": set(),
    "Not applicable": set(),
}
VERIFICATION_STATUSES = {
    "Not started",
    "Requested",
    "In progress",
    "Verified",
    "Needs review",
    "Unable to verify",
    "Not applicable",
}
VERIFICATION_TRANSITIONS = {
    "Not started": {"Requested", "Not applicable"},
    "Requested": {"In progress", "Verified", "Needs review", "Unable to verify", "Not applicable"},
    "In progress": {"Verified", "Needs review", "Unable to verify", "Not applicable"},
    "Verified": set(),
    "Needs review": set(),
    "Unable to verify": set(),
    "Not applicable": set(),
}


def record_round_decision(
    candidate: dict[str, Any],
    round_name: str,
    action: str,
    notes: str = "",
) -> dict[str, Any]:
    if round_name not in ROUND_ORDER:
        raise ValueError("Round must be coding, technical, or hr.")
    if action not in {"pass", "not_proceeding"}:
        raise ValueError("Recruiter action must be 'pass' or 'not_proceeding'.")
    round_label = "HR" if round_name == "hr" else round_name.title()
    expected_status = f"{round_label} round pending"
    if candidate.get("decision_status") != expected_status:
        raise ValueError(f"Candidate is not awaiting a {round_name} round decision.")

    updated = dict(candidate)
    rounds = dict(updated.get("rounds", {}))
    round_result = dict(rounds.get(round_name, {}))
    round_result.update(
        {
            "decision": action,
            "recruiter_notes": notes.strip(),
            "reviewed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
    )
    rounds[round_name] = round_result
    updated["rounds"] = rounds

    if action == "not_proceeding":
        updated["decision_status"] = "Not proceeding (recruiter decision)"
        updated["current_round"] = None
    elif round_name == "hr":
        updated["decision_status"] = "Final recruiter decision pending"
        updated["current_round"] = None
    else:
        next_round = ROUND_ORDER[ROUND_ORDER.index(round_name) + 1]
        next_label = "HR" if next_round == "hr" else next_round.title()
        updated["decision_status"] = f"{next_label} round pending"
        updated["current_round"] = next_round
    return updated


def record_final_hiring_decision(
    candidate: dict[str, Any],
    action: str,
    notes: str = "",
) -> dict[str, Any]:
    if action not in {"hire", "not_proceeding"}:
        raise ValueError("Final recruiter decision must be 'hire' or 'not_proceeding'.")
    if candidate.get("decision_status") != "Final recruiter decision pending":
        raise ValueError("Candidate is not awaiting a final hiring decision.")
    updated = dict(candidate)
    updated["decision_status"] = (
        "Hired by recruiter"
        if action == "hire"
        else "Not proceeding (recruiter decision)"
    )
    updated["final_decision"] = action
    updated["final_decision_notes"] = notes.strip()
    return updated


def _create_consent_gated_check_plan(
    candidate: dict[str, Any],
    plan_key: str,
    checks: list[str],
    available_checks: dict[str, str],
    offer_accepted: bool,
    candidate_consent: bool,
    additional_confirmation: bool = True,
) -> dict[str, Any]:
    if candidate.get("decision_status") != "Hired by recruiter":
        raise ValueError("A recruiter must approve the hire before checks can be planned.")
    if offer_accepted is not True:
        raise ValueError("Confirm the offer was issued and accepted before checks can be planned.")
    if candidate_consent is not True:
        raise ValueError("Candidate consent is required before checks can be planned.")
    if additional_confirmation is not True:
        raise ValueError("The required compliant verification integration must be confirmed.")
    if candidate.get(plan_key):
        raise ValueError(f"A {plan_key.replace('_', ' ')} plan already exists for this candidate.")
    if not isinstance(checks, list) or not checks:
        raise ValueError("Select at least one check.")
    if any(
        not isinstance(check, str) or check not in available_checks
        for check in checks
    ):
        raise ValueError("Select only supported verification or document checks.")

    updated = dict(candidate)
    updated[plan_key] = {
        "status": "In progress",
        "consent_confirmed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "checks": {
            check: {
                "label": available_checks[check],
                "status": "Not started",
                "notes": "",
            }
            for check in dict.fromkeys(checks)
        },
    }
    return updated


def create_verification_plan(
    candidate: dict[str, Any],
    checks: list[str],
    offer_accepted: bool,
    candidate_consent: bool,
) -> dict[str, Any]:
    return _create_consent_gated_check_plan(
        candidate,
        "verification",
        checks,
        VERIFICATION_CHECKS,
        offer_accepted,
        candidate_consent,
    )


def create_document_validation_plan(
    candidate: dict[str, Any],
    document_types: list[str],
    offer_accepted: bool,
    candidate_consent: bool,
    aadhaar_compliant_integration_confirmed: bool = False,
) -> dict[str, Any]:
    if not isinstance(document_types, list):
        raise ValueError("Select one or more supported document types.")
    if (
        "aadhaar" in document_types
        and aadhaar_compliant_integration_confirmed is not True
    ):
        raise ValueError(
            "Aadhaar validation requires confirmation of a lawful, compliant, authorized integration."
        )
    return _create_consent_gated_check_plan(
        candidate,
        "document_validation",
        document_types,
        DOCUMENT_VALIDATION_TYPES,
        offer_accepted,
        candidate_consent,
        additional_confirmation=(
            "aadhaar" not in document_types
            or aadhaar_compliant_integration_confirmed is True
        ),
    )


def _update_check_plan(
    candidate: dict[str, Any],
    plan_key: str,
    check: str,
    status: str,
    notes: str = "",
) -> dict[str, Any]:
    plan = candidate.get(plan_key)
    if not isinstance(plan, dict) or not isinstance(plan.get("checks"), dict):
        raise ValueError(f"Create a consented {plan_key.replace('_', ' ')} plan first.")
    if not isinstance(check, str) or check not in plan["checks"]:
        raise ValueError(f"This check is not part of the candidate's {plan_key.replace('_', ' ')} plan.")
    if not isinstance(status, str) or status not in VERIFICATION_STATUSES:
        raise ValueError("Choose a supported verification status.")
    if not isinstance(notes, str) or len(notes) > 1000:
        raise ValueError("Keep the non-sensitive outcome summary under 1,000 characters.")

    check_result = plan["checks"][check]
    current_status = check_result["status"]
    if status != current_status and status not in VERIFICATION_TRANSITIONS[current_status]:
        raise ValueError(f"Cannot change verification status from {current_status} to {status}.")

    updated = dict(candidate)
    updated_plan = dict(plan)
    updated_checks = dict(plan["checks"])
    updated_check = dict(check_result)
    updated_check.update(
        {
            "status": status,
            "notes": notes.strip(),
            "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
    )
    updated_checks[check] = updated_check
    updated_plan["checks"] = updated_checks
    terminal_statuses = {"Verified", "Needs review", "Unable to verify", "Not applicable"}
    statuses = [item["status"] for item in updated_checks.values()]
    if all(item in terminal_statuses for item in statuses):
        updated_plan["status"] = (
            "Needs recruiter review"
            if "Needs review" in statuses or "Unable to verify" in statuses
            else "Checks completed"
        )
    else:
        updated_plan["status"] = "In progress"
    updated[plan_key] = updated_plan
    return updated


def update_verification_check(
    candidate: dict[str, Any],
    check: str,
    status: str,
    notes: str = "",
) -> dict[str, Any]:
    return _update_check_plan(candidate, "verification", check, status, notes)


def update_document_validation_check(
    candidate: dict[str, Any],
    document_type: str,
    status: str,
) -> dict[str, Any]:
    return _update_check_plan(
        candidate,
        "document_validation",
        document_type,
        status,
        "",
    )


def create_onboarding_plan(
    candidate: dict[str, Any],
    offer_accepted: bool,
    candidate_consent: bool,
) -> dict[str, Any]:
    if candidate.get("decision_status") != "Hired by recruiter":
        raise ValueError("A recruiter must approve the hire before onboarding tasks are created.")
    if offer_accepted is not True:
        raise ValueError("Confirm the offer was formally issued and accepted before onboarding.")
    if candidate_consent is not True:
        raise ValueError("Candidate consent is required before preparing onboarding tasks.")
    if candidate.get("onboarding"):
        raise ValueError("An onboarding plan already exists for this candidate.")

    updated = dict(candidate)
    updated["onboarding"] = {
        "status": "Draft — approval required",
        "accepted_offer_confirmed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "tasks": {
            task: {
                "label": label,
                "status": "Draft — approval required",
                "notes": "",
            }
            for task, label in ONBOARDING_TASKS.items()
        },
    }
    return updated


def update_onboarding_task(
    candidate: dict[str, Any],
    task: str,
    status: str,
    notes: str = "",
) -> dict[str, Any]:
    onboarding = candidate.get("onboarding")
    if not isinstance(onboarding, dict) or not isinstance(onboarding.get("tasks"), dict):
        raise ValueError("Create an onboarding plan after accepted offer and consent first.")
    if not isinstance(task, str) or task not in onboarding["tasks"]:
        raise ValueError("This task is not part of the candidate's onboarding plan.")
    if not isinstance(status, str) or status not in ONBOARDING_STATUSES:
        raise ValueError("Choose a supported onboarding task status.")
    if not isinstance(notes, str) or len(notes) > 500:
        raise ValueError("Keep onboarding notes non-sensitive and under 500 characters.")

    current = onboarding["tasks"][task]["status"]
    if status != current and status not in ONBOARDING_TRANSITIONS[current]:
        raise ValueError(f"Cannot change onboarding task from {current} to {status}.")

    updated = dict(candidate)
    updated_onboarding = dict(onboarding)
    updated_tasks = dict(onboarding["tasks"])
    updated_task = dict(updated_tasks[task])
    updated_task.update(
        {
            "status": status,
            "notes": notes.strip(),
            "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
    )
    updated_tasks[task] = updated_task
    updated_onboarding["tasks"] = updated_tasks
    terminal_statuses = {"Completed", "Not applicable"}
    statuses = [item["status"] for item in updated_tasks.values()]
    if all(item in terminal_statuses for item in statuses):
        updated_onboarding["status"] = "Completed"
    elif any(item == "Blocked" for item in statuses):
        updated_onboarding["status"] = "Needs review"
    elif all(item != "Draft — approval required" for item in statuses):
        updated_onboarding["status"] = "In progress"
    else:
        updated_onboarding["status"] = "Draft — approval required"
    updated["onboarding"] = updated_onboarding
    return updated


def append_audit_event(
    events: list[dict[str, str]],
    action: str,
    subject: str,
) -> list[dict[str, str]]:
    return [
        *events,
        {
            "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "actor": "AI workflow" if action.startswith("AI ") else "Recruiter",
            "action": action,
            "subject": subject,
        },
    ]


def create_interview_invitation_draft(
    candidate: dict[str, Any],
    job_title: str,
    email: str,
    availability: str,
    interview_format: str,
    round_name: str = "interview",
    phone: str = "",
    candidate_name: str = "",
    contact_authorized: bool = False,
) -> dict[str, Any]:
    if candidate.get("recruiter_decision") != "advance":
        raise ValueError("A recruiter must advance the candidate before outreach is drafted.")
    if not contact_authorized:
        raise ValueError("Confirm that you are authorized to contact this candidate.")
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email.strip()):
        raise ValueError("Enter a valid candidate email address.")
    if not availability.strip():
        raise ValueError("Add at least one suggested interview availability window.")
    if interview_format not in {"Video interview", "Phone interview"}:
        raise ValueError("Choose a supported interview format.")
    if interview_format == "Phone interview" and not phone.strip():
        raise ValueError("A phone number is required for a phone interview.")

    display_name = candidate_name.strip() or candidate["candidate_id"]
    round_label = (
        "HR"
        if round_name.lower() == "hr"
        else round_name.replace("_", " ").title()
    )
    subject = f"{round_label} invitation: {job_title}"
    body = (
        f"Hello {display_name},\n\n"
        f"We'd like to invite you to the {round_label.lower()} round for the {job_title} role. "
        f"The proposed format is {interview_format.lower()}.\n\n"
        "Please let us know which of these suggested times works for you:\n"
        f"{availability.strip()}\n\n"
        "No meeting has been scheduled yet. Please reply with your preferred time "
        "and any accessibility or accommodation needs.\n\n"
        "Best,\nRecruiting Team"
    )
    return {
        "candidate_id": candidate["candidate_id"],
        "candidate_email": email.strip(),
        "candidate_phone": phone.strip(),
        "job_title": job_title,
        "interview_format": interview_format,
        "availability": availability.strip(),
        "subject": subject,
        "body": body,
        "call_script": (
            f"Hello {display_name}, this is the recruiting team about the {job_title} role. "
            f"We'd like to invite you to the {round_label.lower()} round. "
            f"The proposed format is {interview_format.lower()}. "
            f"Would any of these times work for you: {availability.strip()}? "
            "No interview is booked until we confirm a time with you."
        ),
        "status": "Draft — not sent or scheduled",
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def create_rejection_message_draft(
    candidate: dict[str, Any],
    job_title: str,
    email: str,
    phone: str = "",
    candidate_name: str = "",
    contact_authorized: bool = False,
) -> dict[str, Any]:
    if candidate.get("decision_status") != "Not proceeding (recruiter decision)":
        raise ValueError("A recruiter must record a not-proceeding decision first.")
    if not contact_authorized:
        raise ValueError("Confirm that you are authorized to contact this candidate.")
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email.strip()):
        raise ValueError("Enter a valid candidate email address.")
    display_name = candidate_name.strip() or candidate["candidate_id"]
    return {
        "candidate_id": candidate["candidate_id"],
        "candidate_email": email.strip(),
        "candidate_phone": phone.strip(),
        "job_title": job_title,
        "subject": f"Update on your {job_title} application",
        "body": (
            f"Hello {display_name},\n\n"
            f"Thank you for taking the time to interview for the {job_title} role. "
            "After careful review, we will not be moving forward with your application "
            "for this position. We appreciate your interest and wish you the best in "
            "your search.\n\nBest,\nRecruiting Team"
        ),
        "call_script": (
            f"Hello {display_name}, this is the recruiting team calling about your "
            f"{job_title} application. Thank you for your time. After careful review, "
            "we will not be moving forward for this role. I appreciate your interest "
            "and am happy to answer process-related questions."
        ),
        "status": "Draft — not sent or scheduled",
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def create_offer_letter_draft(
    candidate: dict[str, Any],
    job_title: str,
    candidate_name: str,
    company_name: str,
    annual_salary_lpa: float,
    joining_date: str,
    documents: list[str],
    salary_budget: str,
    budget_confirmed: bool,
) -> dict[str, Any]:
    if candidate.get("decision_status") != "Hired by recruiter":
        raise ValueError("A recruiter must approve the hire before preparing an offer.")
    if not budget_confirmed:
        raise ValueError("Confirm the salary is approved and within the authorized compensation band.")
    try:
        salary = float(annual_salary_lpa)
    except (TypeError, ValueError) as exc:
        raise ValueError("Annual salary must be a positive number in LPA.") from exc
    if not math.isfinite(salary) or salary <= 0:
        raise ValueError("Annual salary must be a positive number in LPA.")

    salary_values = [
        float(value)
        for value in re.findall(
            r"(?:₹|INR|Rs\.?\s*)?\s*(\d+(?:\.\d+)?)\s*(?:LPA|lakhs?|lakh per annum)",
            salary_budget,
            re.IGNORECASE,
        )
    ]
    if salary_values and salary > max(salary_values):
        raise ValueError("Annual salary exceeds the salary budget stated for this role.")

    try:
        start_date = datetime.strptime(joining_date, "%Y-%m-%d").date()
    except (TypeError, ValueError) as exc:
        raise ValueError("Joining date must be a valid YYYY-MM-DD date.") from exc
    if start_date <= date.today():
        raise ValueError("Joining date must be in the future.")
    if not candidate_name.strip() or not company_name.strip():
        raise ValueError("Candidate name and company name are required for an offer draft.")
    if not isinstance(documents, list) or not any(
        isinstance(document, str) and document.strip()
        for document in documents
    ):
        raise ValueError("Select at least one document for the post-acceptance checklist.")

    document_list = list(
        dict.fromkeys(
            document.strip()
            for document in documents
            if isinstance(document, str) and document.strip()
        )
    )
    salary_display = f"INR {salary:g} LPA gross annual compensation"
    letter = (
        f"PRIVATE AND CONFIDENTIAL — OFFER DRAFT (NOT ISSUED)\n\n"
        f"Date: {datetime.now(timezone.utc).date().isoformat()}\n"
        f"To: {candidate_name.strip()}\n\n"
        f"Dear {candidate_name.strip()},\n\n"
        f"{company_name.strip()} is pleased to present this draft offer for the "
        f"position of {job_title}. The proposed gross annual compensation is "
        f"{salary_display}. Your proposed joining date is {start_date.isoformat()}.\n\n"
        "This document is a draft for recruiter and authorized company review. It is "
        "not an employment contract, does not create an employment relationship, and "
        "is not valid until reviewed and formally issued by an authorized company "
        "representative in accordance with applicable law and company policy. "
        "Benefits, work location, probation, terms, and other conditions are not "
        "specified here and must be reviewed and completed by HR/legal before issuance.\n\n"
        "Documents to request after candidate acceptance (subject to applicable law, "
        "necessity, secure handling, and candidate consent):\n"
        + "\n".join(f"- {document}" for document in document_list)
        + "\n\nSincerely,\nRecruiting Team\n"
    )
    return {
        "candidate_id": candidate["candidate_id"],
        "candidate_name": candidate_name.strip(),
        "company_name": company_name.strip(),
        "job_title": job_title,
        "annual_salary_lpa": salary,
        "salary_budget": salary_budget,
        "joining_date": start_date.isoformat(),
        "documents": document_list,
        "letter": letter,
        "status": "Draft — not approved or issued",
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
