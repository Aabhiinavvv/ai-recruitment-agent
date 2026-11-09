from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.verification.schemas import (
    VerificationCaseRequest,
    VerificationCaseResponse,
    VerificationCheck,
    VerificationReviewRequest,
    VerificationReviewResponse,
)


CHECK_CATALOG: dict[str, dict[str, object]] = {
    "identity": {
        "title": "Identity verification",
        "purpose": "Confirm identity through a lawful, authorised process using only the minimum required information.",
        "evidence": [
            "Use a candidate-provided document only through an approved secure channel.",
            "Compare the document with the candidate using the authorised process.",
            "Store only an opaque evidence reference here; do not enter document numbers or upload document images.",
        ],
    },
    "employment": {
        "title": "Employment history",
        "purpose": "Confirm role-relevant employer, title and dates through an authorised source.",
        "evidence": [
            "Confirm the employer and role with an authorised employer contact or licensed provider.",
            "Record only the job-relevant confirmation and an opaque report reference.",
            "Do not record salary history or unrelated performance/personal details.",
        ],
    },
    "education": {
        "title": "Education verification",
        "purpose": "Confirm the qualification or institution requirement that is relevant to this role.",
        "evidence": [
            "Use an authorised institution or licensed verification provider.",
            "Record the qualification and verification outcome, not student identifiers.",
            "Keep a secure source reference outside this prototype.",
        ],
    },
    "address": {
        "title": "Address verification",
        "purpose": "Use only where role-related, proportionate and lawful in the applicable jurisdiction.",
        "evidence": [
            "Confirm that this check is necessary and permitted before proceeding.",
            "Use an authorised source and the least intrusive available method.",
            "Do not put a full residential address or document number in this API.",
        ],
    },
    "professional_license": {
        "title": "Professional licence or certification",
        "purpose": "Confirm a role-required professional credential and current status with the issuing body or authorised provider.",
        "evidence": [
            "Check only credentials required for the role.",
            "Confirm validity and scope with an authorised issuer or provider.",
            "Do not store licence numbers or copies in this prototype.",
        ],
    },
    "reference": {
        "title": "Professional reference",
        "purpose": "Obtain factual, role-related confirmation from a referee with candidate authorisation.",
        "evidence": [
            "Contact only referees the candidate has authorised.",
            "Ask consistent, role-related questions and avoid protected or personal topics.",
            "Record a concise factual summary and an opaque evidence reference.",
        ],
    },
}

CHECK_CODES = {
    "identity": "ID",
    "employment": "EMP",
    "education": "EDU",
    "address": "ADDR",
    "professional_license": "LIC",
    "reference": "REF",
}


def create_verification_case(
    request: VerificationCaseRequest,
) -> VerificationCaseResponse:
    case_id = "BGC-" + uuid4().hex[:12].upper()
    checks: list[VerificationCheck] = []
    for check_type in request.check_types:
        item = CHECK_CATALOG[check_type]
        checks.append(
            VerificationCheck(
                check_id=f"{case_id}-{CHECK_CODES[check_type]}",
                check_type=check_type,
                title=str(item["title"]),
                purpose=str(item["purpose"]),
                evidence_to_review=list(item["evidence"]),  # type: ignore[arg-type]
            )
        )
    return VerificationCaseResponse(
        case_id=case_id,
        candidate_id=request.candidate_id,
        job_title=request.job_title,
        jurisdiction=request.jurisdiction,
        checks=checks,
    )


def record_verification_review(
    request: VerificationReviewRequest,
) -> VerificationReviewResponse:
    expected_code = CHECK_CODES[request.check_type]
    if not request.check_id.endswith("-" + expected_code):
        raise ValueError("The check ID does not match the supplied verification check type.")
    if not request.check_id.startswith(request.case_id + "-"):
        raise ValueError("The check ID does not belong to the supplied verification case.")

    return VerificationReviewResponse(
        case_id=request.case_id,
        candidate_id=request.candidate_id,
        check_id=request.check_id,
        check_type=request.check_type,
        outcome=request.outcome,
        evidence_source_type=request.evidence_source_type,
        evidence_reference=request.evidence_reference,
        evidence_summary=request.evidence_summary,
        reviewer_note=request.reviewer_note,
        reviewed_at=datetime.now(timezone.utc).isoformat(),
    )
