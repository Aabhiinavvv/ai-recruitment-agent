from fastapi import APIRouter, HTTPException

from app.verification.schemas import (
    VerificationCaseRequest,
    VerificationCaseResponse,
    VerificationReviewRequest,
    VerificationReviewResponse,
)
from app.verification.service import create_verification_case, record_verification_review

router = APIRouter(prefix="/api/v1/verification", tags=["Background Verification Agent"])


@router.post(
    "/cases",
    response_model=VerificationCaseResponse,
    summary="Create a consent-gated background verification checklist",
)
async def create_case(request: VerificationCaseRequest) -> VerificationCaseResponse:
    return create_verification_case(request)


@router.post(
    "/reviews",
    response_model=VerificationReviewResponse,
    summary="Validate a human-reviewed verification result",
)
async def create_review(request: VerificationReviewRequest) -> VerificationReviewResponse:
    try:
        return record_verification_review(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
