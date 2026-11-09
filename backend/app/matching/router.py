from fastapi import APIRouter, HTTPException

from app.matching.engine import match_candidate_batch
from app.matching.schemas import CandidateMatchBatchRequest, CandidateMatchBatchResponse

router = APIRouter(prefix="/api/v1/matching", tags=["Matching and Ranking"])


@router.post(
    "/candidates",
    response_model=CandidateMatchBatchResponse,
    summary="Compare parsed candidate profiles with an approved job rubric",
)
async def match_candidates(
    request: CandidateMatchBatchRequest,
) -> CandidateMatchBatchResponse:
    try:
        return match_candidate_batch(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
