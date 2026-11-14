from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.candidate_intelligence.schemas import (
    CandidateIntelligenceBatchResponse,
    SavedCandidateProfile,
)
from app.candidate_intelligence.service import process_resume_batch
from app.candidate_intelligence.storage import list_candidate_profiles

router = APIRouter(prefix="/api/v1/candidate-intelligence", tags=["Candidate Intelligence"])


@router.get(
    "/resumes",
    response_model=list[SavedCandidateProfile],
    summary="List saved candidate profiles",
)
async def get_saved_resumes() -> list[SavedCandidateProfile]:
    records = await run_in_threadpool(list_candidate_profiles)
    return [
        SavedCandidateProfile(candidate_profile=profile, uploaded_at=uploaded_at)
        for profile, uploaded_at in records
    ]


@router.post(
    "/resumes/batch",
    response_model=CandidateIntelligenceBatchResponse,
    summary="Upload multiple resumes and extract evidence-backed candidate profiles",
)
async def upload_resumes(
    files: list[UploadFile] = File(..., description="PDF, DOCX or TXT resumes (max 15 files)"),
    consent_confirmed: bool = Form(..., description="Confirm that candidates have been informed and authorised processing"),
) -> CandidateIntelligenceBatchResponse:
    try:
        return await process_resume_batch(files, consent_confirmed)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
