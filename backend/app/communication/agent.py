from __future__ import annotations

import re
from uuid import uuid4

from app.communication.schemas import (
    CommunicationDraftRequest,
    CommunicationDraftResponse,
)


SENSITIVE_OR_UNSUPPORTED = re.compile(
    r"\b(?:age|aged|young|old|gender|male|female|pregnan\w*|marital|married|"
    r"religion|religious|caste|ethnic\w*|race|disabilit\w*|medical|health|"
    r"ulcerative|diagnos\w*|salary history|nationality|political|union member|"
    r"score|scored|rank|ranking|percentile|cutoff|cut-off)\b",
    re.IGNORECASE,
)


def _safe_context(request: CommunicationDraftRequest) -> tuple[str, list[str]]:
    context = " ".join(request.recruiter_context.split()).strip()
    if not context:
        return "", []
    if SENSITIVE_OR_UNSUPPORTED.search(context):
        return "", [
            "Recruiter context was omitted because it may disclose sensitive personal information "
            "or automated score/rank details. The draft uses neutral wording instead."
        ]
    return context, []


def _greeting(name: str) -> str:
    return f"Hello {name.split()[0]}," if name.strip() else "Hello,"


def build_communication_draft(
    request: CommunicationDraftRequest,
) -> CommunicationDraftResponse:
    context, warnings = _safe_context(request)
    greeting = _greeting(request.candidate_name)
    role = request.job_title
    company = request.company_name or "the recruitment team"
    call_script = ""

    if request.communication_type == "application_acknowledgement":
        subject = f"We received your application — {role}"
        body = (
            f"{greeting}\n\n"
            f"Thank you for applying for the {role} position. We have received your application "
            f"and the recruitment team will review it. We will contact you if there is an update "
            f"or a next step to discuss.\n\n"
            f"Thank you,\n{company}"
        )
    elif request.communication_type == "interview_invitation":
        subject = f"Interview invitation — {role}"
        body = (
            f"{greeting}\n\n"
            f"We would like to invite you to the {request.interview_round} stage for the {role} "
            f"position. Please reply to this email with a few time windows that work for you"
            + (f", or use this scheduling link: {request.meeting_url}" if request.meeting_url else "")
            + ". We will confirm the interview details with you.\n\n"
            f"We look forward to speaking with you.\n\n{company}"
        )
        call_script = (
            f"Hello {request.candidate_name}, this is {company} calling about your application "
            f"for the {role} position. The recruiter would like to invite you to the "
            f"{request.interview_round} stage. Is this a convenient time to discuss availability?"
        )
    elif request.communication_type == "scheduling_request":
        subject = f"Availability for your {request.interview_round} — {role}"
        body = (
            f"{greeting}\n\n"
            f"We are arranging the {request.interview_round} for the {role} position. "
            f"Could you share two or three date and time windows that suit you, including your "
            f"time zone? We will check interviewer availability and confirm a slot with you.\n\n"
            f"Thank you,\n{company}"
        )
        call_script = (
            f"Hello {request.candidate_name}, we are coordinating your {request.interview_round} "
            f"for the {role} role. Could you share a few suitable time windows and your time zone?"
        )
    elif request.communication_type == "schedule_confirmation":
        subject = f"Interview confirmed — {role} ({request.interview_date})"
        meeting = f"\nMeeting link: {request.meeting_url}" if request.meeting_url else ""
        body = (
            f"{greeting}\n\n"
            f"This is to confirm your {request.interview_round} for the {role} position:\n\n"
            f"Date: {request.interview_date}\n"
            f"Time: {request.interview_time} ({request.timezone})\n"
            f"Format: {request.interview_format}{meeting}\n\n"
            f"Please reply to confirm that you have received these details. If you need an "
            f"accommodation or a change to the time, please let us know and we will coordinate.\n\n"
            f"Best regards,\n{company}"
        )
        call_script = (
            f"Hello {request.candidate_name}, I am calling to confirm your {request.interview_round} "
            f"for {request.interview_date} at {request.interview_time} {request.timezone}. "
            "Would you like me to repeat any of the details?"
        )
    elif request.communication_type == "not_selected":
        subject = f"Update on your application — {role}"
        body = (
            f"{greeting}\n\n"
            f"Thank you for the time and effort you invested in the {role} recruitment process. "
            f"After a recruiter review, we will not be moving forward with your application for "
            f"this particular position.\n\n"
            f"We appreciate your interest in {company} and wish you the very best in your search.\n\n"
            f"Kind regards,\n{company}"
        )
    elif request.communication_type == "status_update":
        subject = f"An update on your application — {role}"
        body = (
            f"{greeting}\n\n"
            f"We wanted to share an update regarding your application for the {role} position."
            + (f"\n\n{context}" if context else
               "\n\nYour application is still being reviewed by the recruitment team. We will contact you when there is a further update.")
            + f"\n\nThank you for your patience,\n{company}"
        )
    else:  # follow_up
        subject = f"Following up on your application — {role}"
        body = (
            f"{greeting}\n\n"
            f"We are following up regarding your application for the {role} position. "
            f"Please let us know if you have any questions or if there is anything you would "
            f"like the recruitment team to know.\n\n"
            f"Thank you,\n{company}"
        )

    # Keep permitted recruiter-provided context out of rejection/scheduling templates by
    # default. Only status updates accept custom context, and only after the safety check.
    if request.communication_type == "status_update" and context and warnings:
        pass

    return CommunicationDraftResponse(
        draft_id="COM-" + uuid4().hex[:12].upper(),
        communication_type=request.communication_type,
        candidate_id=request.candidate_id,
        recipient_email=request.recipient_email,
        subject=subject,
        body=body,
        call_script=call_script,
        warnings=warnings,
    )
