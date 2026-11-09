from fastapi import APIRouter

from app.analytics.schemas import (
    RecruitmentAnalyticsRequest,
    RecruitmentAnalyticsResponse,
)
from app.analytics.service import build_recruitment_analytics

router = APIRouter(prefix="/api/v1/analytics", tags=["Recruitment Analytics Agent"])


@router.post(
    "/recruitment",
    response_model=RecruitmentAnalyticsResponse,
    summary="Calculate privacy-minimised recruitment and workforce analytics",
)
async def recruitment_analytics(
    request: RecruitmentAnalyticsRequest,
) -> RecruitmentAnalyticsResponse:
    return build_recruitment_analytics(request)
