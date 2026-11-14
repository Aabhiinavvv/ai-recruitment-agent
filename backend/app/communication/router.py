from fastapi import APIRouter

from app.communication.agent import build_communication_draft
from app.communication.schemas import CommunicationDraftRequest, CommunicationDraftResponse

router = APIRouter(prefix="/api/v1/communication", tags=["Communication Agent"])


@router.post(
    "/drafts",
    response_model=CommunicationDraftResponse,
    summary="Draft candidate communication for mandatory recruiter review",
)
async def create_communication_draft(
    request: CommunicationDraftRequest,
) -> CommunicationDraftResponse:
    return build_communication_draft(request)
