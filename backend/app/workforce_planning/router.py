from fastapi import APIRouter

from app.workforce_planning.schemas import (
    WorkforcePlanningRequest,
    WorkforcePlanningResponse,
)
from app.workforce_planning.service import build_workforce_forecast

router = APIRouter(
    prefix="/api/v1/workforce-planning",
    tags=["Workforce Planning & Predictive Hiring Agent"],
)


@router.post(
    "/forecast",
    response_model=WorkforcePlanningResponse,
    summary="Forecast hiring demand, recruiting capacity and workforce gaps",
)
async def workforce_forecast(
    request: WorkforcePlanningRequest,
) -> WorkforcePlanningResponse:
    return build_workforce_forecast(request)
