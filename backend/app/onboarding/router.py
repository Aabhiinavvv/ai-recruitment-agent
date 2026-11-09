from fastapi import APIRouter, HTTPException

from app.onboarding.schemas import (
    OfferDraftRequest,
    OfferDraftResponse,
    OfferEventRequest,
    OfferEventResponse,
    OnboardingPlanRequest,
    OnboardingPlanResponse,
    OnboardingTaskEventRequest,
    OnboardingTaskEventResponse,
)
from app.onboarding.service import (
    create_offer_draft,
    create_onboarding_plan,
    record_offer_event,
    record_onboarding_task_event,
)

router = APIRouter(prefix="/api/v1/onboarding", tags=["Offer Management & Onboarding Agent"])


@router.post("/offers/drafts", response_model=OfferDraftResponse)
async def create_offer(request: OfferDraftRequest) -> OfferDraftResponse:
    return create_offer_draft(request)


@router.post("/offers/events", response_model=OfferEventResponse)
async def record_offer_status_event(request: OfferEventRequest) -> OfferEventResponse:
    try:
        return record_offer_event(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/plans", response_model=OnboardingPlanResponse)
async def create_plan(request: OnboardingPlanRequest) -> OnboardingPlanResponse:
    return create_onboarding_plan(request)


@router.post("/tasks/events", response_model=OnboardingTaskEventResponse)
async def record_task_event(request: OnboardingTaskEventRequest) -> OnboardingTaskEventResponse:
    try:
        return record_onboarding_task_event(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
