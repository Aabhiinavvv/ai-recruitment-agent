from fastapi import APIRouter

from app.interview.schemas import (
    InterviewAnswerEvaluationResponse,
    InterviewAnswerRequest,
    InterviewPlanRequest,
    InterviewPlanResponse,
)
from app.interview.service import create_interview_plan, evaluate_interview_answer

router = APIRouter(prefix="/api/v1/interviews", tags=["AI Interview Agent"])


@router.post(
    "/plan",
    response_model=InterviewPlanResponse,
    summary="Prepare job-related interview questions for recruiter-led interview",
)
async def prepare_interview_plan(
    request: InterviewPlanRequest,
) -> InterviewPlanResponse:
    return await create_interview_plan(request)


@router.post(
    "/evaluate",
    response_model=InterviewAnswerEvaluationResponse,
    summary="Evaluate one consented interview answer for human review",
)
async def evaluate_answer(
    request: InterviewAnswerRequest,
) -> InterviewAnswerEvaluationResponse:
    return await evaluate_interview_answer(request)
