from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agent import JobIntelligenceAgent
from app.communication.router import router as communication_router
from app.interview.router import router as interview_router
from app.verification.router import router as verification_router
from app.onboarding.router import router as onboarding_router
from app.analytics.router import router as analytics_router
from app.candidate_intelligence.router import router as candidate_intelligence_router
from app.matching.router import router as matching_router
from app.config import get_settings
from app.schemas import JobIntelligenceResponse, JobRequirementInput

settings = get_settings()

app = FastAPI(
    title="AI Recruitment Platform API",
    version="0.7.0",
    description="Recruiter-supervised APIs for the agentic recruitment platform.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

job_intelligence_agent = JobIntelligenceAgent(settings)
app.include_router(candidate_intelligence_router)
app.include_router(matching_router)
app.include_router(communication_router)
app.include_router(interview_router)
app.include_router(verification_router)
app.include_router(onboarding_router)
app.include_router(analytics_router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "ai-recruitment-backend",
        "agents": ["job-intelligence", "candidate-intelligence", "matching-ranking", "communication", "interview", "background-verification", "offer-onboarding", "recruitment-analytics"],
    }


@app.post(
    "/api/v1/job-intelligence/draft",
    response_model=JobIntelligenceResponse,
    summary="Generate a recruiter-reviewable job description and evaluation rubric",
)
async def create_job_draft(brief: JobRequirementInput) -> JobIntelligenceResponse:
    return await job_intelligence_agent.draft(brief)
