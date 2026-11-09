from fastapi import APIRouter

from app.orchestrator.schemas import (
    OrchestrationPlanRequest,
    OrchestrationPlanResponse,
)
from app.orchestrator.service import build_orchestration_plan

router = APIRouter(
    prefix="/api/v1/orchestrator",
    tags=["AI Recruitment Orchestrator"],
)


@router.post(
    "/plan",
    response_model=OrchestrationPlanResponse,
    summary="Build a dependency-aware plan across recruitment agents",
)
async def create_orchestration_plan(
    request: OrchestrationPlanRequest,
) -> OrchestrationPlanResponse:
    return build_orchestration_plan(request)
